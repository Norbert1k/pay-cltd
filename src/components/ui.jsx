import { STATUS_COLORS, PAYMENT_COLORS, STATUS_LABELS, PAYMENT_LABELS } from '../lib/utils';

export function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || '#808080';
  const label = STATUS_LABELS[status] || status;
  const isApproved = status === 'approved_accounts' || status === 'approved_director';
  const isPaid = status === 'paid';
  return (
    <span className="pill" style={{ background: color + '18', color, borderColor: color + '40' }}>
      {(isApproved || isPaid) && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 3 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {label}
    </span>
  );
}

// 3-stage approval pipeline — shows progress through stages
export function ApprovalPipeline({ status }) {
  const stages = [
    { key: 'approved_accounts', label: 'Accounts', color: '#BA7517' },
    { key: 'approved_director', label: 'Director', color: '#448a40' },
    { key: 'paid', label: 'Paid', color: '#2d6329' },
  ];

  const getStageStatus = (stageKey) => {
    if (status === 'queried') return 'queried';
    const order = ['submitted', 'approved_accounts', 'approved_director', 'paid'];
    const currentIdx = order.indexOf(status);
    const stageIdx = order.indexOf(stageKey);
    if (stageIdx <= currentIdx) return 'complete';
    if (stageIdx === currentIdx + 1) return 'current';
    return 'pending';
  };

  if (status === 'queried') {
    return (
      <div className="approval-pipeline">
        <div className="approval-stage approval-stage--queried">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Queried</span>
        </div>
      </div>
    );
  }

  return (
    <div className="approval-pipeline">
      {stages.map((stage) => {
        const stageStatus = getStageStatus(stage.key);
        return (
          <div key={stage.key} className={`approval-stage approval-stage--${stageStatus}`}>
            {stageStatus === 'complete' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <div className="approval-stage__dot" />
            )}
            <span>{stage.label}</span>
          </div>
        );
      })}
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

// Query badge — shows on worker dashboard when they have queries
export function QueryBadge({ count }) {
  if (!count) return null;
  return (
    <span className="query-badge">{count}</span>
  );
}
