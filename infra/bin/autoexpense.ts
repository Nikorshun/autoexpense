#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AutoExpenseStack } from '../lib/autoexpense-stack';

const app = new cdk.App();

new AutoExpenseStack(app, 'AutoExpenseStack', {
  // Budget alarm email (optional). Pass with: cdk deploy -c notifyEmail=you@example.com
  notifyEmail: app.node.tryGetContext('notifyEmail'),
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-1',
  },
  description: 'AutoExpense — serverless receipt-to-expense pipeline (free-tier optimised).',
});
