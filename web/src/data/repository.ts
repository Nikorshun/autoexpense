import type { Expense } from '../types';

/**
 * Storage abstraction. The offline tier uses {@link LocalExpenseRepository}
 * (IndexedDB). The online tier will provide an AppSync-backed implementation of
 * this same interface, so the UI never has to know which one it is talking to.
 */
export interface ExpenseRepository {
  list(): Promise<Expense[]>;
  get(id: string): Promise<Expense | undefined>;
  save(expense: Expense): Promise<Expense>;
  remove(id: string): Promise<void>;
}
