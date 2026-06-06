import { randomUUID } from 'node:crypto';
import type { PipelinePayload, Expense } from '../lib/types';
import { putExpense } from '../lib/dynamo';

/**
 * Step 4: persist the finished expense and (when auto-approved) submit it to the
 * downstream expense system. Items needing review are saved but not submitted.
 */
export async function handler(payload: PipelinePayload): Promise<Expense> {
  if (!payload.extracted || !payload.policyVerdict) {
    throw new Error('submit: pipeline payload incomplete');
  }

  const now = new Date().toISOString();
  const expense: Expense = {
    id: randomUUID(),
    userId: payload.userId,
    merchant: payload.extracted.merchant,
    date: payload.extracted.date,
    amount: payload.extracted.amount,
    currency: payload.extracted.currency,
    category: payload.category ?? 'Uncategorised',
    status: payload.policyVerdict.status,
    source: payload.source,
    lineItems: payload.extracted.lineItems,
    confidence: payload.extracted.confidence,
    policyNote: payload.policyVerdict.note,
    createdAt: now,
    updatedAt: now,
  };

  await putExpense(expense);

  if (expense.status === 'auto_approved') {
    await submitToExpenseSystem(expense);
    expense.status = 'submitted';
    await putExpense(expense);
  }

  return expense;
}

/**
 * Placeholder for the external integration (QuickBooks / Xero / Concur). Creds
 * would be read from SSM Parameter Store at runtime (free secrets, see COSTS.md).
 */
async function submitToExpenseSystem(expense: Expense): Promise<void> {
  console.log(`[submit] would push expense ${expense.id} to expense system`);
}
