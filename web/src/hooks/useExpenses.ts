import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppSyncExpenseRepository } from '../data/appsyncRepository';
import type { Expense } from '../types';

const repo = new AppSyncExpenseRepository();

/**
 * Loads expenses from the live AppSync/DynamoDB backend and exposes the
 * mutations the UI needs. Each call is authenticated as the signed-in Cognito
 * user, so the list only ever contains that user's data.
 */
export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await repo.list();
      setExpenses(list);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('Could not reach the cloud. Check your connection and try again.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const add = useCallback(
    async (expense: Expense) => {
      await repo.create(expense);
      await refresh();
    },
    [refresh],
  );

  const update = useCallback(
    async (expense: Expense) => {
      await repo.update(expense);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (expense: Expense) => {
      await repo.remove(expense);
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

  return { expenses, loading, error, add, update, remove, refresh, stats };
}
