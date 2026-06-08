import { useExpenses } from './hooks/useExpenses';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { SummaryCards } from './components/SummaryCards';
import { ExpenseList } from './components/ExpenseList';
import { simulateIncomingExpense } from './utils/simulate';
import type { Expense } from './types';

interface AppProps {
  signOut?: () => void;
  userEmail?: string;
}

export default function App({ signOut, userEmail }: AppProps) {
  const online = useOnlineStatus();
  const { expenses, loading, error, add, update, remove, stats } = useExpenses();

  const handleSimulate = async () => {
    await add(simulateIncomingExpense());
  };

  const handleApprove = async (e: Expense) => {
    await update({ ...e, status: 'submitted', policyNote: 'Approved by user.' });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" className="brand__logo" width={28} height={28} />
          <span className="brand__name">AutoExpense</span>
        </div>
        <div className="topbar__right">
          <div className={`conn ${online ? 'conn--online' : 'conn--offline'}`}>
            <span className="conn__dot" aria-hidden="true" />
            {online ? 'Online · synced' : 'Offline'}
          </div>
          {userEmail && <span className="user">{userEmail}</span>}
          {signOut && (
            <button className="btn btn--small btn--ghost" onClick={signOut}>
              Sign out
            </button>
          )}
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

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p className="empty">Loading your expenses from the cloud…</p>
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
          Live on AWS · Cognito auth, AppSync GraphQL, DynamoDB storage. Data is
          scoped to your account.
        </span>
      </footer>
    </div>
  );
}
