import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

// SVG Icons as components
const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconSubmit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12l7-7 7 7" />
  </svg>
);

const IconHistory = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
);

const IconProfile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const IconTimesheets = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);

const IconWorkers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconSites = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconLogout = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function Sidebar({ open, onClose }) {
  const { isAdmin, profile, signOut } = useAuth();
  const location = useLocation();
  const [badges, setBadges] = useState({ alerts: 0, pendingUsers: 0, queriedTimesheets: 0 });

  // Fetch notification counts
  useEffect(() => {
    if (!profile) return;
    fetchBadges();
    // Refresh badges every 30 seconds
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  const fetchBadges = async () => {
    if (!profile) return;

    // Worker: unread alerts
    const { count: alertCount } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('worker_id', profile.id)
      .eq('read', false);

    // Worker: queried timesheets
    const { count: queriedCount } = await supabase
      .from('timesheets')
      .select('*', { count: 'exact', head: true })
      .eq('worker_id', profile.id)
      .eq('status', 'queried');

    let pendingCount = 0;
    if (['admin', 'accountant', 'director'].includes(profile.role)) {
      // Admin: pending user approvals
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending');
      pendingCount = count || 0;
    }

    setBadges({
      alerts: (alertCount || 0) + (queriedCount || 0),
      pendingUsers: pendingCount,
      queriedTimesheets: queriedCount || 0,
    });
  };

  const workerLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: <IconDashboard />, badge: badges.alerts },
    { to: '/submit', label: 'Submit Timesheet', icon: <IconSubmit /> },
    { to: '/timesheets', label: 'My Timesheets', icon: <IconHistory />, badge: badges.queriedTimesheets },
    { to: '/profile', label: 'My Profile', icon: <IconProfile /> },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: <IconDashboard /> },
    { to: '/admin/timesheets', label: 'All Timesheets', icon: <IconTimesheets /> },
    { to: '/admin/workers', label: 'User Management', icon: <IconWorkers />, badge: badges.pendingUsers },
    { to: '/admin/sites', label: 'Sites', icon: <IconSites /> },
    { to: '/admin/payments', label: 'Payment Dates', icon: <IconCalendar /> },
    { to: '/admin/calendar', label: 'Calendar', icon: <IconCalendar /> },
  ];

  const links = isAdmin ? adminLinks : workerLinks;

  const roleLabel = profile?.role === 'admin' ? 'Admin' : profile?.role === 'accountant' ? 'Accountant' : profile?.role === 'director' ? 'Director' : profile?.trade || 'Worker';

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <img src="/logo-white.png" alt="City Construction" className="sidebar__logo" />
          <span className="sidebar__title">PAY</span>
        </div>

        <nav className="sidebar__nav">
          {isAdmin && (
            <div className="sidebar__section-label">Admin</div>
          )}
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/admin'}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              onClick={onClose}
            >
              {link.icon}
              <span>{link.label}</span>
              {link.badge > 0 && (
                <span className="sidebar__badge">{link.badge}</span>
              )}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="sidebar__divider" />
              <div className="sidebar__section-label">Worker View</div>
              {workerLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `sidebar__link sidebar__link--secondary ${isActive ? 'sidebar__link--active' : ''}`
                  }
                  onClick={onClose}
                >
                  {link.icon}
                  <span>{link.label}</span>
                  {link.badge > 0 && (
                    <span className="sidebar__badge">{link.badge}</span>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{profile?.full_name || 'User'}</span>
              <span className="sidebar__user-role">
                {roleLabel}
              </span>
            </div>
          </div>
          <div className="sidebar__actions">
            <button className="sidebar__theme-toggle" onClick={() => {
              const current = document.documentElement.getAttribute('data-theme');
              const next = current === 'dark' ? 'light' : 'dark';
              document.documentElement.setAttribute('data-theme', next);
              localStorage.setItem('theme', next);
            }} title="Toggle dark/light mode">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </button>
            <button className="sidebar__logout" onClick={signOut}>
              <IconLogout />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
