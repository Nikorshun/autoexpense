import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Expense } from '../types';
import type { ExpenseRepository } from './repository';

interface AutoExpenseDB extends DBSchema {
  expenses: {
    key: string;
    value: Expense;
    indexes: { 'by-date': string };
  };
}

const DB_NAME = 'autoexpense';
const DB_VERSION = 1;

/**
 * Offline-first repository backed by IndexedDB. This is what powers the paid
 * "Offline Pro" tier: all reads/writes happen locally and remain available with
 * no network. When online, an AppSync sync layer reconciles this store with the
 * cloud (see docs/ARCHITECTURE.md, section 4).
 */
export class LocalExpenseRepository implements ExpenseRepository {
  private dbPromise: Promise<IDBPDatabase<AutoExpenseDB>>;

  constructor() {
    this.dbPromise = openDB<AutoExpenseDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('expenses', { keyPath: 'id' });
        store.createIndex('by-date', 'date');
      },
    });
  }

  async list(): Promise<Expense[]> {
    const db = await this.dbPromise;
    const all = await db.getAll('expenses');
    // newest first
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }

  async create(expense: Expense): Promise<Expense> {
    return this.put(expense);
  }

  async update(expense: Expense): Promise<Expense> {
    return this.put(expense);
  }

  private async put(expense: Expense): Promise<Expense> {
    const db = await this.dbPromise;
    const next: Expense = { ...expense, updatedAt: new Date().toISOString() };
    await db.put('expenses', next);
    return next;
  }

  async remove(expense: Expense): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('expenses', expense.id);
  }

  async count(): Promise<number> {
    const db = await this.dbPromise;
    return db.count('expenses');
  }
}
