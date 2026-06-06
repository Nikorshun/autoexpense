// Domain model. This mirrors the shape stored in DynamoDB and exposed by the
// AppSync GraphQL API, so the same types serve the offline (local) and online paths.

export type ExpenseStatus =
  | 'auto_approved'
  | 'needs_review'
  | 'submitted'
  | 'rejected';

export type ExpenseSource = 'email' | 'open_banking' | 'upload';

export interface LineItem {
  description: string;
  quantity?: number;
  amount: number;
}

export interface Expense {
  id: string;
  merchant: string;
  /** ISO date string of the transaction. */
  date: string;
  amount: number;
  currency: string;
  category: string;
  status: ExpenseStatus;
  source: ExpenseSource;
  lineItems?: LineItem[];
  /** Pipeline confidence 0..1; low values route to "needs_review". */
  confidence: number;
  policyNote?: string;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<ExpenseStatus, string> = {
  auto_approved: 'Auto-approved',
  needs_review: 'Needs review',
  submitted: 'Submitted',
  rejected: 'Rejected',
};

export const SOURCE_LABELS: Record<ExpenseSource, string> = {
  email: 'Email receipt',
  open_banking: 'Open Banking',
  upload: 'Photo / PDF',
};
