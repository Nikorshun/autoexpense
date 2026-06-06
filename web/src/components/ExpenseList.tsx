import { SOURCE_LABELS, type Expense } from '../types';
import { formatDate, formatMoney } from '../utils/format';
import { StatusBadge } from './StatusBadge';

interface Props {
  expenses: Expense[];
  onApprove: (e: Expense) => void;
  onDelete: (id: string) => void;
}

export function ExpenseList({ expenses, onApprove, onDelete }: Props) {
  if (expenses.length === 0) {
    return <p className="empty">No expenses yet. Simulate one to see the pipeline.</p>;
  }

  return (
    <ul className="list" aria-label="Expenses">
      {expenses.map((e) => (
        <li key={e.id} className="row">
          <div className="row__main">
            <div className="row__title">
              <span className="row__merchant">{e.merchant}</span>
              <StatusBadge status={e.status} />
            </div>
            <div className="row__meta">
              <span>{formatDate(e.date)}</span>
              <span className="dot" aria-hidden="true">•</span>
              <span>{e.category}</span>
              <span className="dot" aria-hidden="true">•</span>
              <span className="source">{SOURCE_LABELS[e.source]}</span>
            </div>
            {e.policyNote && <p className="row__note">{e.policyNote}</p>}
          </div>
          <div className="row__side">
            <span className="row__amount">{formatMoney(e.amount, e.currency)}</span>
            <div className="row__actions">
              {e.status === 'needs_review' && (
                <button className="btn btn--small" onClick={() => onApprove(e)}>
                  Approve
                </button>
              )}
              <button
                className="btn btn--small btn--ghost"
                onClick={() => onDelete(e.id)}
                aria-label={`Delete ${e.merchant}`}
              >
                Delete
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
