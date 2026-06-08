import type { ResourcesConfig } from 'aws-amplify';

// Public client configuration for the deployed AutoExpense backend.
// These are NOT secrets — user pool / client IDs and the AppSync endpoint are
// shipped to browsers by design. Generated from the CDK stack outputs.
export const awsConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'eu-west-2_Nw01Db1X0',
      userPoolClientId: '1dltes96j73psgrfm1ivlhg5ki',
    },
  },
  API: {
    GraphQL: {
      endpoint:
        'https://3vay6u6zrrdbbdhvxkhkylgrfm.appsync-api.eu-west-2.amazonaws.com/graphql',
      region: 'eu-west-2',
      defaultAuthMode: 'userPool',
    },
  },
};
