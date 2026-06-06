import { useCallback, useEffect, useMemo, useState } from 'react';
import { LocalExpenseRepository } from '../data/localRepository';
import { SEED_EXPENSES } from '../data/seed';
import type { Expense } from '../types';

const repo = new LocalExpenseRepository();

/**
 * Loads expenses from the offline store, seeding sample data on first run, and
 * exposes the mutations the UI needs. Swapping `repo` for an AppSync-backed
 * repository is all that's required to go from offline-only to fully synced.
 */
export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await repo.list();
    setExpenses(list);
  }, []);

  useEffect(() => {
    (async () => {
      const existing = await repo.list();
      if (existing.length === 0) {
        await Promise.all(SEED_EXPENSES.map((e) => repo.save(e)));
      }
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const save = useCallback(
    async (expense: Expense) => {
      await repo.save(expense);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await repo.remove(id);
      await refresh();
    },
    [refresh],
  );

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const needsReview = expenses.filter((e) => e.status === 'needs_review').length;
    const automated = expenses.filter(
      (e) => e.source === 'email' || e.source === 'open_banking',
    ).length;
    const automationRate = expenses.length
      ? Math.round((automated / expenses.length) * 100)
      : 0;
    return { total, needsReview, automationRate, count: expenses.length };
  }, [expenses]);

  return { expenses, loading, save, remove, refresh, stats };
}
