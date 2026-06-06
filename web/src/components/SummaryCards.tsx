import { formatMoney } from '../utils/format';

interface Props {
  total: number;
  count: number;
  needsReview: number;
  automationRate: number;
}

export function SummaryCards({ total, count, needsReview, automationRate }: Props) {
  return (
    <section className="cards" aria-label="Summary">
      <div className="card">
        <span className="card__label">Tracked this period</span>
        <span className="card__value">{formatMoney(total)}</span>
        <span className="card__hint">{count} expenses</span>
      </div>
      <div className="card">
        <span className="card__label">Captured automatically</span>
        <span className="card__value">{automationRate}%</span>
        <span className="card__hint">email + Open Banking</span>
      </div>
      <div className="card">
        <span className="card__label">Needs your review</span>
        <span className={`card__value ${needsReview ? 'card__value--warn' : ''}`}>
          {needsReview}
        </span>
        <span className="card__hint">
          {needsReview ? 'tap to resolve' : 'all clear'}
        </span>
      </div>
    </section>
  );
}
