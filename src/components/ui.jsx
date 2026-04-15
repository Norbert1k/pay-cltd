import { STATUS_COLORS, PAYMENT_COLORS, STATUS_LABELS } from '../lib/utils';

export function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || '#808080';
  const label = STATUS_LABELS[status] || status;
  const isApproved = status === 'approved';
  return (
    <span className="pill" style={{ background: color + '18', color, borderColor: color + '40' }}>
      {isApproved && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 3 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {label}
    </span>
  );
}

export function PaymentPill({ method }) {
  const color = PAYMENT_COLORS[method] || '#808080';
  const label = method === 'card' ? 'Card' : 'Other';
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
  return (
    <div className="loading-spinner">
      <div className="spinner" />
    </div>
  );
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

export function MobileBottomNav({ isAdmin }) {
  return null; // Bottom nav is handled via CSS on mobile using the sidebar links
}
