// Shared types for the processing pipeline. Kept in sync with web/src/types.ts.

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
  userId: string;
  merchant: string;
  date: string;
  amount: number;
  currency: string;
  category: string;
  status: ExpenseStatus;
  source: ExpenseSource;
  lineItems?: LineItem[];
  confidence: number;
  policyNote?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The object passed between Step Functions states. Each state enriches it and
 * passes it on; the shape grows as it moves through extract -> enrich -> match.
 */
export interface PipelinePayload {
  userId: string;
  source: ExpenseSource;
  /** S3 location of the raw artefact (email MIME, image, or PDF). */
  s3Bucket?: string;
  s3Key?: string;
  /** Populated by the extract step. */
  extracted?: {
    merchant: string;
    date: string;
    amount: number;
    currency: string;
    lineItems: LineItem[];
    /** Extraction confidence from Textract / email parsing. */
    confidence: number;
  };
  /** Populated by the enrich step. */
  category?: string;
  /** Populated by the match-policy step. */
  policyVerdict?: {
    status: ExpenseStatus;
    note: string;
  };
}
