import type { Expense, ExpenseSource } from '../types';

const MERCHANTS = [
  { name: 'Starbucks', category: 'Meals & Entertainment', max: 12 },
  { name: 'Trainline', category: 'Travel', max: 90 },
  { name: 'Figma', category: 'Software & Subscriptions', max: 15 },
  { name: 'Pizza Express', category: 'Meals & Entertainment', max: 45 },
  { name: 'Shell', category: 'Travel', max: 70 },
  { name: 'WeWork', category: 'Office', max: 50 },
];

const SOURCES: ExpenseSource[] = ['email', 'open_banking', 'upload'];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Client-side stand-in for the cloud pipeline (extract -> enrich -> match).
 * Mirrors the real logic: confidence drives the status, and a low score routes
 * to "needs_review" — exactly what the Step Functions workflow does server-side.
 */
export function simulateIncomingExpense(): Expense {
  const merchant = rand(MERCHANTS);
  const source = rand(SOURCES);
  const amount = Math.round((Math.random() * merchant.max + 2) * 100) / 100;
  // Uploads (OCR) and unusual amounts get lower confidence.
  const confidence =
    source === 'upload'
      ? Math.random() * 0.5 + 0.3
      : Math.random() * 0.2 + 0.8;

  const status = confidence < 0.6 ? 'needs_review' : 'auto_approved';
  const now = new Date().toISOString();

  return {
    id: `exp_${Date.now()}`,
    merchant: merchant.name,
    date: now,
    amount,
    currency: 'GBP',
    category: merchant.category,
    status,
    source,
    confidence: Math.round(confidence * 100) / 100,
    policyNote:
      status === 'needs_review'
        ? 'Low extraction confidence — pipeline flagged for review.'
        : 'Within policy, auto-approved.',
    createdAt: now,
    updatedAt: now,
  };
}
