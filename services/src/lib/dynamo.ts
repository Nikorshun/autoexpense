import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Expense } from './types';

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.TABLE_NAME ?? 'AutoExpense';

/**
 * Single-table design:
 *   PK = USER#<userId>   SK = EXPENSE#<date>#<id>
 * This supports the primary access pattern "all expenses for a user, newest first".
 */
export async function putExpense(expense: Expense): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${expense.userId}`,
        SK: `EXPENSE#${expense.date}#${expense.id}`,
        ...expense,
      },
    }),
  );
}
