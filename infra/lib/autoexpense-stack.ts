import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as budgets from 'aws-cdk-lib/aws-budgets';

export interface AutoExpenseStackProps extends cdk.StackProps {
  /** Optional email for the free-tier budget alarm. */
  notifyEmail?: string;
}

const HANDLERS = path.join(__dirname, '..', '..', 'services', 'src', 'handlers');

export class AutoExpenseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AutoExpenseStackProps = {}) {
    super(scope, id, props);

    // ---------------------------------------------------------------------
    // 1. State — DynamoDB single table (on-demand = scale to zero)
    // ---------------------------------------------------------------------
    const table = new dynamodb.Table(this, 'ExpensesTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // demo project; keep teardown clean
    });

    // ---------------------------------------------------------------------
    // 2. Storage — private bucket for raw emails & uploads (EventBridge on)
    // ---------------------------------------------------------------------
    const receiptsBucket = new s3.Bucket(this, 'ReceiptsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      eventBridgeEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        // Expense records must be retained for years; archive cheaply.
        { transitions: [{ storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(90) }] },
      ],
    });

    // ---------------------------------------------------------------------
    // 3. Pipeline Lambdas (bundled from ../services with esbuild)
    // ---------------------------------------------------------------------
    const makeFn = (
      name: string,
      entryFile: string,
      environment: Record<string, string> = {},
    ) =>
      new lambdaNode.NodejsFunction(this, name, {
        entry: path.join(HANDLERS, entryFile),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        tracing: lambda.Tracing.ACTIVE,
        bundling: { externalModules: ['@aws-sdk/*'], minify: true },
        environment,
      });

    const extractFn = makeFn('ExtractFn', 'extract.ts');
    const enrichFn = makeFn('EnrichFn', 'enrich.ts');
    const matchFn = makeFn('MatchPolicyFn', 'matchPolicy.ts');
    const submitFn = makeFn('SubmitFn', 'submit.ts', { TABLE_NAME: table.tableName });

    receiptsBucket.grantRead(extractFn);
    extractFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['textract:AnalyzeExpense'],
        resources: ['*'],
      }),
    );
    table.grantWriteData(submitFn);

    // ---------------------------------------------------------------------
    // 4. Orchestration — Step Functions state machine
    // ---------------------------------------------------------------------
    const extractTask = new tasks.LambdaInvoke(this, 'Extract', {
      lambdaFunction: extractFn,
      outputPath: '$.Payload',
    }).addRetry({ maxAttempts: 2, interval: cdk.Duration.seconds(2) });

    const enrichTask = new tasks.LambdaInvoke(this, 'Enrich', {
      lambdaFunction: enrichFn,
      outputPath: '$.Payload',
    }).addRetry({ maxAttempts: 2 });

    const matchTask = new tasks.LambdaInvoke(this, 'MatchPolicy', {
      lambdaFunction: matchFn,
      outputPath: '$.Payload',
    }).addRetry({ maxAttempts: 2 });

    const submitTask = new tasks.LambdaInvoke(this, 'Submit', {
      lambdaFunction: submitFn,
      outputPath: '$.Payload',
    }).addRetry({ maxAttempts: 2 });

    const definition = extractTask.next(enrichTask).next(matchTask).next(submitTask);

    const stateMachine = new sfn.StateMachine(this, 'Pipeline', {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(5),
      tracingEnabled: true,
    });

    // ---------------------------------------------------------------------
    // 5. Ingestion trigger — S3 object created -> start the pipeline
    // ---------------------------------------------------------------------
    const startFn = makeFn('StartPipelineFn', 'startPipeline.ts', {
      STATE_MACHINE_ARN: stateMachine.stateMachineArn,
    });
    stateMachine.grantStartExecution(startFn);

    new events.Rule(this, 'ReceiptCreatedRule', {
      description: 'Start the expense pipeline when a receipt/email lands in S3.',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: { bucket: { name: [receiptsBucket.bucketName] } },
      },
      targets: [new targets.LambdaFunction(startFn)],
    });

    // ---------------------------------------------------------------------
    // 6. Identity — Cognito user pool (federated Google/Apple added later)
    // ---------------------------------------------------------------------
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 8, requireDigits: true, requireLowercase: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: { userSrp: true },
    });

    // ---------------------------------------------------------------------
    // 7. API — AppSync GraphQL (real-time + offline sync) over the table
    // ---------------------------------------------------------------------
    const api = new appsync.GraphqlApi(this, 'Api', {
      name: 'autoexpense-api',
      definition: appsync.Definition.fromFile(
        path.join(__dirname, '..', 'schema', 'schema.graphql'),
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
      },
      xrayEnabled: true,
    });

    const expensesDs = api.addDynamoDbDataSource('ExpensesDataSource', table);
    expensesDs.createResolver('ListExpensesResolver', {
      typeName: 'Query',
      fieldName: 'listExpenses',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromInline(LIST_RESOLVER),
    });
    expensesDs.createResolver('CreateExpenseResolver', {
      typeName: 'Mutation',
      fieldName: 'createExpense',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromInline(CREATE_RESOLVER),
    });

    // ---------------------------------------------------------------------
    // 8. Web hosting — private S3 + CloudFront (1 TB/month always free)
    // ---------------------------------------------------------------------
    const siteBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'WebCdn', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        // SPA fallback so client-side routes resolve to the app shell.
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // ---------------------------------------------------------------------
    // 9. Cost guardrail — $1/month budget alarm (free-tier safety net)
    // ---------------------------------------------------------------------
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: 'autoexpense-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 1, unit: 'USD' },
      },
      notificationsWithSubscribers: props.notifyEmail
        ? [
            {
              notification: {
                notificationType: 'ACTUAL',
                comparisonOperator: 'GREATER_THAN',
                threshold: 80,
                thresholdType: 'PERCENTAGE',
              },
              subscribers: [{ subscriptionType: 'EMAIL', address: props.notifyEmail }],
            },
          ]
        : undefined,
    });

    // ---------------------------------------------------------------------
    // Outputs — everything the web app and ops need
    // ---------------------------------------------------------------------
    new cdk.CfnOutput(this, 'WebUrl', { value: `https://${distribution.domainName}` });
    new cdk.CfnOutput(this, 'GraphQlUrl', { value: api.graphqlUrl });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ReceiptsBucketName', { value: receiptsBucket.bucketName });
    new cdk.CfnOutput(this, 'WebBucketName', { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
  }
}

// -------------------------------------------------------------------------
// AppSync JS resolvers (kept as constants for readability)
// -------------------------------------------------------------------------
const LIST_RESOLVER = `
import { util } from '@aws-appsync/utils';
export function request(ctx) {
  const sub = ctx.identity.sub;
  return {
    operation: 'Query',
    query: {
      expression: '#pk = :pk',
      expressionNames: { '#pk': 'PK' },
      expressionValues: util.dynamodb.toMapValues({ ':pk': 'USER#' + sub }),
    },
    scanIndexForward: false,
  };
}
export function response(ctx) {
  return ctx.result.items;
}
`;

const CREATE_RESOLVER = `
import { util } from '@aws-appsync/utils';
export function request(ctx) {
  const sub = ctx.identity.sub;
  const id = util.autoId();
  const now = util.time.nowISO8601();
  const input = ctx.args.input;
  const item = Object.assign({}, input, { id: id, userId: sub, createdAt: now, updatedAt: now });
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ PK: 'USER#' + sub, SK: 'EXPENSE#' + input.date + '#' + id }),
    attributeValues: util.dynamodb.toMapValues(item),
  };
}
export function response(ctx) {
  return ctx.result;
}
`;
