import { useEffect, useState } from 'react';
import { useExpenses } from './hooks/useExpenses';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { SummaryCards } from './components/SummaryCards';
import { ExpenseList } from './components/ExpenseList';
import { ConnectBankModal } from './components/ConnectBankModal';
import { simulateIncomingExpense } from './utils/simulate';
import { syncBank, takePendingRequisition } from './data/bankingService';
import type { Theme } from './hooks/useTheme';
import type { Expense } from './types';

interface AppProps {
  signOut?: () => void;
  userEmail?: string;
  theme?: Theme;
  onToggleTheme?: () => void;
}

export default function App({ signOut, userEmail, theme, onToggleTheme }: AppProps) {
  const online = useOnlineStatus();
  const { expenses, loading, error, add, update, remove, refresh, stats } = useExpenses();
  const [showConnect, setShowConnect] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // After a bank redirect, finish the Open Banking sync.
  useEffect(() => {
    const pending = takePendingRequisition();
    if (!pending) return;
    (async () => {
      setNotice('Importing transactions from your bank…');
      try {
        const imported = await syncBank(pending);
        setNotice(`Imported ${imported} transaction${imported === 1 ? '' : 's'} from your bank.`);
        await refresh();
        // tidy the ?ref=... the bank appended on redirect
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        console.error(e);
        setNotice('Bank import failed. Check the backend secrets and try again.');
      }
    })();
  }, [refresh]);

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
          {onToggleTheme && (
            <button
              className="btn btn--small btn--ghost btn--icon"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title="Toggle theme"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          )}
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
          <div className="head__actions">
            <button className="btn btn--ghost" onClick={() => setShowConnect(true)}>
              Connect bank
            </button>
            <button className="btn" onClick={handleSimulate}>
              Simulate incoming receipt
            </button>
          </div>
        </div>

        {notice && <p className="notice">{notice}</p>}

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

      {showConnect && <ConnectBankModal onClose={() => setShowConnect(false)} />}
    </div>
  );
}
