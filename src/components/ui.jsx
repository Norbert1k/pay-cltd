import { STATUS_COLORS, PAYMENT_COLORS, STATUS_LABELS, PAYMENT_LABELS } from '../lib/utils';

export function StatusPill({ status, paymentMethod }) {
  const color = STATUS_COLORS[status] || '#808080';
  let label = STATUS_LABELS[status] || status;
  const isPaid = status === 'paid';

  // When paid, show "Paid via Bank Transfer" / "Paid via Other" if we know the method
  if (isPaid && paymentMethod) {
    const methodLabel = PAYMENT_LABELS[paymentMethod] || paymentMethod;
    label = `Paid via ${methodLabel}`;
  }

  return (
    <span className="pill" style={{ background: color + '18', color, borderColor: color + '40' }}>
      {isPaid && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 3 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {label}
    </span>
  );
}

/**
 * Owed / Settled tile — replaces the approval pipeline.
 * - Outstanding (status !== 'paid'): amber tile labelled "Owed".
 * - Paid: green tile labelled "Settled".
 * - Queried: red tile labelled "Queried".
 * - Optional `breakdown` shows per-week split ("£780 / £910").
 */
export function OwedTile({ paid, total, breakdown, queried }) {
  const tone = queried ? 'queried' : (paid ? 'paid' : 'owed');
  const label = queried ? 'Queried' : (paid ? '✓ Settled' : 'Owed');
  return (
    <div className={`owed-tile owed-tile--${tone}`}>
      <div className="owed-tile__main">
        <div className="owed-tile__label">{label}</div>
        <div className="owed-tile__amount">{total}</div>
      </div>
      {breakdown && <div className="owed-tile__breakdown">{breakdown}</div>}
    </div>
  );
}

export function PaymentPill({ method }) {
  const color = PAYMENT_COLORS[method] || '#808080';
  const label = PAYMENT_LABELS[method] || method;
  return (
    <span className="pill" style={{ background: color + '18', color, borderColor: color + '40' }}>
      {label}
    </span>
  );
}

export function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color || 'var(--green)' }}>
      {icon && <div className="stat-card__icon" style={{ color: color || 'var(--green)' }}>{icon}</div>}
      <div className="stat-card__content">
        <span className="stat-card__value">{value}</span>
        <span className="stat-card__label">{label}</span>
        {sub && <span className="stat-card__sub">{sub}</span>}
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return <div className="loading-spinner"><div className="spinner" /></div>;
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon">{icon}</div>}
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export function QueryBadge({ count }) {
  if (!count) return null;
  return <span className="query-badge">{count}</span>;
}

// ============================================================
// Backwards-compat stubs — render nothing, but keep imports valid.
// Safe to remove once every caller has been updated.
// ============================================================
export function ApprovalPipeline() { return null; }
export function ApprovalControls() { return null; }
