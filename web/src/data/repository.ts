import type { Expense } from '../types';

/**
 * Storage abstraction. The cloud tier uses {@link AppSyncExpenseRepository}
 * (GraphQL over Cognito-authenticated AppSync). The offline tier uses
 * {@link LocalExpenseRepository} (IndexedDB). Both implement this same
 * interface, so the UI never has to know which one it is talking to.
 */
export interface ExpenseRepository {
  list(): Promise<Expense[]>;
  create(expense: Expense): Promise<Expense>;
  update(expense: Expense): Promise<Expense>;
  remove(expense: Expense): Promise<void>;
}
