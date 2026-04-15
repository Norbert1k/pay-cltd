import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getNextSunday, formatDate, formatCurrency } from '../lib/utils';
import { PageHeader, StatusPill, PaymentPill, LoadingSpinner } from '../components/ui';

export default function Dashboard() {
  const { profile } = useAuth();
  const [recentTimesheets, setRecentTimesheets] = useState([]);
  const [currentWeekSubmitted, setCurrentWeekSubmitted] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [nextPayment, setNextPayment] = useState(null);
  const [queriedCount, setQueriedCount] = useState(0);

  const weekEnding = getNextSunday();

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      // Check current week
      const { data: currentWeek } = await supabase
        .from('timesheets')
        .select('*, sites(site_name)')
        .eq('worker_id', profile.id)
        .eq('week_ending', weekEnding)
        .maybeSingle();
      setCurrentWeekSubmitted(currentWeek);

      // Recent timesheets
      const { data: recent } = await supabase
        .from('timesheets')
        .select('*, sites(site_name)')
        .eq('worker_id', profile.id)
        .order('week_ending', { ascending: false })
        .limit(5);
      setRecentTimesheets(recent || []);

      // Unread alerts
      const { data: alertData } = await supabase
        .from('alerts')
        .select('*')
        .eq('worker_id', profile.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5);
      setAlerts(alertData || []);

      // Count queried timesheets
      const { count: qCount } = await supabase
        .from('timesheets')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', profile.id)
        .eq('status', 'queried');
      setQueriedCount(qCount || 0);

      // Next payment date
      const today = new Date().toISOString().split('T')[0];
      const { data: payDates } = await supabase
        .from('payment_dates')
        .select('*')
        .gte('payment_date', today)
        .order('payment_date', { ascending: true })
        .limit(1);
      setNextPayment(payDates?.[0] || null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = async (alertId) => {
    await supabase.from('alerts').update({ read: true }).eq('id', alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setQueriedCount(prev => Math.max(0, prev - (alerts.find(a => a.id === alertId)?.type === 'query' ? 1 : 0)));
    window.dispatchEvent(new Event('badges-refresh'));
  };

  if (loading) return <LoadingSpinner />;

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const profileComplete = profile?.payment_info_complete;

  // Calculate days until cutoff
  const daysUntilCutoff = nextPayment?.cutoff_date
    ? Math.ceil((new Date(nextPayment.cutoff_date + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="page">
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle="Submit and track your weekly timesheets"
      />

      {/* Alerts / Notifications */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          {alerts.map(a => (
            <div key={a.id} className={`alert ${a.type === 'query' ? 'alert--warning' : a.type === 'status_change' ? 'alert--success' : 'alert--info'}`}>
              <div style={{flex: 1}}>
                <strong>{a.title}</strong>
                <p>{a.message}</p>
              </div>
              <button className="alert__dismiss" onClick={() => dismissAlert(a.id)} title="Dismiss">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Queried Timesheets Warning */}
      {queriedCount > 0 && (
        <div className="query-warning-banner">
          <div className="query-warning-banner__badge">{queriedCount}</div>
          <div>
            <strong>You have {queriedCount} queried timesheet{queriedCount !== 1 ? 's' : ''}</strong>
            <p>Please review and resubmit. Queried timesheets will not be processed for payment.</p>
            <Link to="/timesheets" className="alert__link">View My Timesheets &rarr;</Link>
          </div>
        </div>
      )}

      {/* Payment Date Banner */}
      {nextPayment && (
        <div className="payment-banner">
          <div className="payment-banner__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="payment-banner__content">
            <strong>Next Payment: {formatDate(nextPayment.payment_date)}</strong>
            <p>
              Submit your timesheet by <strong>{formatDate(nextPayment.cutoff_date)}</strong> (
              {daysUntilCutoff !== null && daysUntilCutoff >= 0
                ? daysUntilCutoff === 0 ? 'today!' : daysUntilCutoff === 1 ? 'tomorrow!' : `${daysUntilCutoff} days left`
                : 'cutoff passed'
              }
              ) to be included in this payment run.
            </p>
            <p className="payment-banner__note">Late submissions will go on the next payment run.</p>
          </div>
        </div>
      )}

      {!profileComplete && (
        <div className="alert alert--warning">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <strong>Complete your profile</strong>
            <p>Add your payment details to enable &ldquo;Pay by Bank Transfer&rdquo; option.</p>
            <Link to="/profile" className="alert__link">Go to Profile &rarr;</Link>
          </div>
        </div>
      )}

      {/* This Week Card */}
      <div className="dashboard-week-card">
        <div className="dashboard-week-card__header">
          <h3>This Week</h3>
          <span className="dashboard-week-card__date">Week ending {formatDate(weekEnding)}</span>
        </div>
        {currentWeekSubmitted ? (
          <div className="dashboard-week-card__submitted">
            <div className="dashboard-week-card__check">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <strong>Submitted</strong>
              <p>{currentWeekSubmitted.sites?.site_name} &mdash; {formatCurrency(currentWeekSubmitted.total_amount)}</p>
              <StatusPill status={currentWeekSubmitted.status} />
            </div>
          </div>
        ) : (
          <div className="dashboard-week-card__pending">
            <p>You haven&apos;t submitted a timesheet for this week yet.</p>
            <Link to="/submit" className="btn btn--primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
              Submit Timesheet
            </Link>
          </div>
        )}
      </div>

      {/* Quick Submit */}
      {!currentWeekSubmitted && (
        <Link to="/submit" className="quick-submit-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Submit Timesheet
        </Link>
      )}

      {/* Recent Submissions */}
      <div className="section">
        <h3 className="section__title">Recent Submissions</h3>
        {recentTimesheets.length === 0 ? (
          <p className="text-muted">No timesheets submitted yet.</p>
        ) : (
          <div className="card-list">
            {recentTimesheets.map(ts => (
              <div key={ts.id} className="timesheet-card">
                <div className="timesheet-card__top">
                  <span className="timesheet-card__date">{formatDate(ts.week_ending)}</span>
                  <StatusPill status={ts.status} />
                </div>
                <div className="timesheet-card__details">
                  <span>{ts.sites?.site_name}</span>
                  <PaymentPill method={ts.payment_method} />
                </div>
                <div className="timesheet-card__amount">{formatCurrency(ts.total_amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
