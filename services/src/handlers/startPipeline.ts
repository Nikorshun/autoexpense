import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import type { EventBridgeEvent } from 'aws-lambda';
import type { PipelinePayload, ExpenseSource } from '../lib/types';

const sfn = new SFNClient({});
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN ?? '';

interface S3ObjectCreatedDetail {
  bucket: { name: string };
  object: { key: string };
}

/**
 * Triggered by EventBridge when a new object lands in a receipt/email bucket.
 * Builds the initial pipeline payload and starts the Step Functions execution.
 *
 * Key convention: `<source>/<userId>/<messageId>` — e.g. `email/u-8a3f/abc123`.
 */
export async function handler(
  event: EventBridgeEvent<'Object Created', S3ObjectCreatedDetail>,
): Promise<void> {
  const bucket = event.detail.bucket.name;
  const key = decodeURIComponent(event.detail.object.key.replace(/\+/g, ' '));
  const [sourceSegment, userId] = key.split('/');

  const source: ExpenseSource =
    sourceSegment === 'upload' ? 'upload' : 'email';

  const payload: PipelinePayload = {
    userId: userId ?? 'unknown',
    source,
    s3Bucket: bucket,
    s3Key: key,
  };

  await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      input: JSON.stringify(payload),
    }),
  );
}
