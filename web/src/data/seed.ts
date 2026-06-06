import type { Expense } from '../types';

/** Realistic sample data so the app demonstrates every status and source. */
function iso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export const SEED_EXPENSES: Expense[] = [
  {
    id: 'exp_001',
    merchant: 'Blue Bottle Coffee',
    date: iso(1),
    amount: 8.4,
    currency: 'GBP',
    category: 'Meals & Entertainment',
    status: 'auto_approved',
    source: 'email',
    confidence: 0.97,
    lineItems: [
      { description: 'Cortado', quantity: 1, amount: 3.9 },
      { description: 'Almond croissant', quantity: 1, amount: 4.5 },
    ],
    policyNote: 'Under £30 meal limit.',
    createdAt: iso(1),
    updatedAt: iso(1),
  },
  {
    id: 'exp_002',
    merchant: 'Uber',
    date: iso(2),
    amount: 23.1,
    currency: 'GBP',
    category: 'Travel',
    status: 'submitted',
    source: 'open_banking',
    confidence: 0.91,
    policyNote: 'Matched to client visit on calendar.',
    createdAt: iso(2),
    updatedAt: iso(2),
  },
  {
    id: 'exp_003',
    merchant: 'The Wine Library',
    date: iso(3),
    amount: 64.0,
    currency: 'GBP',
    category: 'Meals & Entertainment',
    status: 'needs_review',
    source: 'upload',
    confidence: 0.42,
    lineItems: [{ description: 'Bottle of Rioja', quantity: 2, amount: 32.0 }],
    policyNote: 'Possible alcohol — policy flags for manual approval.',
    createdAt: iso(3),
    updatedAt: iso(3),
  },
  {
    id: 'exp_004',
    merchant: 'Amazon Web Services',
    date: iso(5),
    amount: 12.73,
    currency: 'GBP',
    category: 'Software & Subscriptions',
    status: 'auto_approved',
    source: 'email',
    confidence: 0.99,
    policyNote: 'Recurring subscription, pre-approved vendor.',
    createdAt: iso(5),
    updatedAt: iso(5),
  },
  {
    id: 'exp_005',
    merchant: 'Pret A Manger',
    date: iso(6),
    amount: 9.85,
    currency: 'GBP',
    category: 'Meals & Entertainment',
    status: 'submitted',
    source: 'open_banking',
    confidence: 0.88,
    createdAt: iso(6),
    updatedAt: iso(6),
  },
];
