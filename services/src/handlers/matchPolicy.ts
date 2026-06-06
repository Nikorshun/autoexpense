import type { PipelinePayload, ExpenseStatus } from '../lib/types';

const MEAL_LIMIT = 30; // GBP
const EXTRACTION_CONFIDENCE_FLOOR = 0.6;

/**
 * Step 3: judge the expense against policy and decide its status.
 * Low extraction confidence or a policy breach routes to human review.
 */
export async function handler(payload: PipelinePayload): Promise<PipelinePayload> {
  if (!payload.extracted) {
    throw new Error('matchPolicy: payload not yet extracted');
  }

  const { extracted, category } = payload;
  let status: ExpenseStatus = 'auto_approved';
  let note = 'Within policy, auto-approved.';

  if (extracted.confidence < EXTRACTION_CONFIDENCE_FLOOR) {
    status = 'needs_review';
    note = 'Low extraction confidence — flagged for review.';
  } else if (
    category === 'Meals & Entertainment' &&
    extracted.amount > MEAL_LIMIT
  ) {
    status = 'needs_review';
    note = `Meal of £${extracted.amount.toFixed(2)} exceeds £${MEAL_LIMIT} limit.`;
  } else if (category === 'Uncategorised') {
    status = 'needs_review';
    note = 'Could not categorise — needs a human.';
  }

  return { ...payload, policyVerdict: { status, note } };
}
