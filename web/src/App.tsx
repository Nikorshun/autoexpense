import { useExpenses } from './hooks/useExpenses';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { SummaryCards } from './components/SummaryCards';
import { ExpenseList } from './components/ExpenseList';
import { simulateIncomingExpense } from './utils/simulate';
import type { Expense } from './types';

export default function App() {
  const online = useOnlineStatus();
  const { expenses, loading, save, remove, stats } = useExpenses();

  const handleSimulate = async () => {
    await save(simulateIncomingExpense());
  };

  const handleApprove = async (e: Expense) => {
    await save({ ...e, status: 'submitted', policyNote: 'Approved by user.' });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" className="brand__logo" width={28} height={28} />
          <span className="brand__name">AutoExpense</span>
        </div>
        <div className={`conn ${online ? 'conn--online' : 'conn--offline'}`}>
          <span className="conn__dot" aria-hidden="true" />
          {online ? 'Online · synced' : 'Offline · changes saved locally'}
        </div>
      </header>

      <main className="content">
        <div className="content__head">
          <div>
            <h1>Expenses</h1>
            <p className="subtitle">
              Captured automatically from email receipts and linked accounts. You
              only handle the exceptions.
            </p>
          </div>
          <button className="btn" onClick={handleSimulate}>
            Simulate incoming receipt
          </button>
        </div>

        <SummaryCards
          total={stats.total}
          count={stats.count}
          needsReview={stats.needsReview}
          automationRate={stats.automationRate}
        />

        {loading ? (
          <p className="empty">Loading your offline store…</p>
        ) : (
          <ExpenseList
            expenses={expenses}
            onApprove={handleApprove}
            onDelete={remove}
          />
        )}
      </main>

      <footer className="footer">
        <span>
          Offline-first PWA · data stored on-device, syncs via AWS AppSync when
          online.
        </span>
      </footer>
    </div>
  );
}
