import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getNextSunday, formatDate, formatCurrency } from '../lib/utils';
import { PageHeader, StatusPill, ApprovalPipeline, PaymentPill, LoadingSpinner } from '../components/ui';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [timesheets, setTimesheets] = useState([]);
  const [paymentDates, setPaymentDates] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [nextPayment, setNextPayment] = useState(null);
  const [queriedCount, setQueriedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const weekEnding = getNextSunday();

  useEffect(() => {
    if (!profile) { setLoading(false); return; }
    fetchAll();
  }, [profile]);

  const fetchAll = async () => {
    try {
      const { data: ts } = await supabase
        .from('timesheets')
        .select('*, sites(site_name)')
        .eq('worker_id', profile.id)
        .order('week_ending', { ascending: false });
      setTimesheets(ts || []);

      const { data: payDates } = await supabase
        .from('payment_dates')
        .select('*')
        .order('payment_date', { ascending: true });
      setPaymentDates(payDates || []);

      const today = new Date().toISOString().split('T')[0];
      const upcoming = (payDates || []).filter(d => d.payment_date >= today);
      setNextPayment(upcoming[0] || null);

      const { data: alertData } = await supabase
        .from('alerts')
        .select('*')
        .eq('worker_id', profile.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5);
      setAlerts(alertData || []);

      const queried = (ts || []).filter(t => t.status === 'queried').length;
      setQueriedCount(queried);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = async (alertId) => {
    await supabase.from('alerts').update({ read: true }).eq('id', alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    window.dispatchEvent(new Event('badges-refresh'));
  };

  // ==== STATS ====
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.toISOString().substring(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().substring(0, 7);
    const thisYear = now.getFullYear().toString();

    const totalPaid = timesheets.filter(t => t.status === 'paid').reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);
    const outstanding = timesheets.filter(t => t.status !== 'paid').reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);
    const thisMonthTotal = timesheets.filter(t => t.week_ending.startsWith(thisMonth)).reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);
    const lastMonthTotal = timesheets.filter(t => t.week_ending.startsWith(lastMonth)).reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);
    const ytdTotal = timesheets.filter(t => t.week_ending.startsWith(thisYear)).reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);

    return { totalPaid, outstanding, thisMonthTotal, lastMonthTotal, ytdTotal, count: timesheets.length };
  }, [timesheets]);

  // ==== MONTHLY CHART (last 6 months) ====
  const monthlyData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-GB', { month: 'short' });
      const total = timesheets.filter(t => t.week_ending.startsWith(key)).reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);
      months.push({ key, label, total, year: d.getFullYear() });
    }
    const max = Math.max(...months.map(m => m.total), 1);
    return { months, max };
  }, [timesheets]);

  // ==== SITES WORKED ====
  const sitesData = useMemo(() => {
    const map = {};
    const thisYear = new Date().getFullYear().toString();
    timesheets.filter(t => t.week_ending.startsWith(thisYear)).forEach(t => {
      const name = t.sites?.site_name || 'Unknown';
      if (!map[name]) map[name] = { count: 0, total: 0 };
      map[name].count++;
      map[name].total += parseFloat(t.total_amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  }, [timesheets]);

  // Find payment date for a timesheet
  const getPaymentDateForTimesheet = (ts) => paymentDates.find(pd => pd.cutoff_date >= ts.week_ending);

  if (loading) return <LoadingSpinner />;

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const daysUntilCutoff = nextPayment?.cutoff_date
    ? Math.ceil((new Date(nextPayment.cutoff_date + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const monthDiff = stats.thisMonthTotal - stats.lastMonthTotal;
  const monthPercent = stats.lastMonthTotal > 0 ? Math.round((monthDiff / stats.lastMonthTotal) * 100) : 0;

  return (
    <div className="page">
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle={profile?.trade ? `${profile.trade} at City Construction` : 'Submit and track your weekly timesheets'}
      />

      {/* Alerts */}
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

      {/* Queried warning */}
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

      {/* Key stats */}
      <div className="dash-stats-grid">
        <div className="dash-stat-card dash-stat-card--primary">
          <div className="dash-stat-card__label">This Month</div>
          <div className="dash-stat-card__value">{formatCurrency(stats.thisMonthTotal)}</div>
          {stats.lastMonthTotal > 0 && (
            <div className={`dash-stat-card__trend ${monthDiff >= 0 ? 'dash-stat-card__trend--up' : 'dash-stat-card__trend--down'}`}>
              {monthDiff >= 0 ? '↑' : '↓'} {Math.abs(monthPercent)}% vs last month
            </div>
          )}
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-card__label">Outstanding</div>
          <div className="dash-stat-card__value dash-stat-card__value--red">{formatCurrency(stats.outstanding)}</div>
          <div className="dash-stat-card__sub">awaiting payment</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-card__label">Year to Date</div>
          <div className="dash-stat-card__value">{formatCurrency(stats.ytdTotal)}</div>
          <div className="dash-stat-card__sub">{stats.count} timesheet{stats.count !== 1 ? 's' : ''}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-card__label">Total Paid</div>
          <div className="dash-stat-card__value dash-stat-card__value--green">{formatCurrency(stats.totalPaid)}</div>
          <div className="dash-stat-card__sub">all-time</div>
        </div>
      </div>

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
              Submit by <strong>{formatDate(nextPayment.cutoff_date)}</strong> (
              {daysUntilCutoff !== null && daysUntilCutoff >= 0
                ? daysUntilCutoff === 0 ? 'today!' : daysUntilCutoff === 1 ? 'tomorrow!' : `${daysUntilCutoff} days left`
                : 'cutoff passed'
              }) to be included.
            </p>
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => navigate('/submit')}>
            Submit Timesheet
          </button>
        </div>
      )}

      {/* Monthly earnings chart */}
      {monthlyData.months.some(m => m.total > 0) && (
        <div className="dash-card">
          <div className="dash-card__header">
            <h3>Earnings — Last 6 Months</h3>
          </div>
          <div className="earnings-chart">
            {monthlyData.months.map(m => {
              const heightPct = (m.total / monthlyData.max) * 100;
              return (
                <div key={m.key} className="earnings-chart__col">
                  <div className="earnings-chart__value">{m.total > 0 ? formatCurrency(m.total) : ''}</div>
                  <div className="earnings-chart__bar-wrap">
                    <div className="earnings-chart__bar" style={{height: `${heightPct}%`}} />
                  </div>
                  <div className="earnings-chart__label">{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sites worked & profile complete side by side */}
      <div className="dash-two-col">
        {sitesData.length > 0 && (
          <div className="dash-card">
            <div className="dash-card__header">
              <h3>Sites Worked This Year</h3>
            </div>
            <div className="sites-list">
              {sitesData.map(([name, data]) => (
                <div key={name} className="site-row">
                  <div className="site-row__info">
                    <strong>{name}</strong>
                    <span className="text-muted text-sm">{data.count} week{data.count !== 1 ? 's' : ''}</span>
                  </div>
                  <strong className="site-row__total">{formatCurrency(data.total)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {!profile?.payment_info_complete && (
          <div className="dash-card dash-card--warning">
            <div className="dash-card__header">
              <h3>Complete Your Profile</h3>
            </div>
            <p>Add your payment details to enable &ldquo;Pay by Bank Transfer&rdquo; option.</p>
            <Link to="/profile" className="btn btn--primary btn--sm">Go to Profile &rarr;</Link>
          </div>
        )}
      </div>

      {/* Recent submissions — matches My Timesheets style */}
      <div className="section">
        <div className="section__header">
          <h3 className="section__title">Recent Submissions</h3>
          <Link to="/timesheets" className="section__link">View All &rarr;</Link>
        </div>
        {timesheets.length === 0 ? (
          <p className="text-muted">No timesheets submitted yet.</p>
        ) : (
          <div className="my-ts-month__items">
            {timesheets.slice(0, 5).map(ts => {
              const pd = getPaymentDateForTimesheet(ts);
              return (
                <div key={ts.id} className={`my-ts-row ${ts.status === 'queried' ? 'my-ts-row--queried' : ''}`}>
                  <div className="my-ts-row__main">
                    <div className="my-ts-row__left">
                      <span className="my-ts-row__date">{formatDate(ts.week_ending)}</span>
                      <span className="my-ts-row__site">{ts.sites?.site_name}</span>
                    </div>
                    <div className="my-ts-row__amount-block">
                      <span className={`my-ts-row__amount-label ${ts.status === 'paid' ? 'my-ts-row__amount-label--paid' : 'my-ts-row__amount-label--due'}`}>
                        {ts.status === 'paid' ? 'Total Paid:' : 'Total Due:'}
                      </span>
                      <span className={`my-ts-row__amount ${ts.status === 'paid' ? 'my-ts-row__amount--paid' : 'my-ts-row__amount--due'}`}>
                        {formatCurrency(ts.total_amount)}
                      </span>
                    </div>
                  </div>
                  <div className="my-ts-row__meta">
                    <div className="my-ts-row__field">
                      <span className="my-ts-row__label">Status:</span>
                      <StatusPill status={ts.status} />
                    </div>
                    <div className="my-ts-row__field">
                      <span className="my-ts-row__label">Approval:</span>
                      <ApprovalPipeline status={ts.status} />
                    </div>
                    <div className="my-ts-row__field">
                      <span className="my-ts-row__label">Payment:</span>
                      <PaymentPill method={ts.payment_method} />
                    </div>
                  </div>
                  {ts.status === 'paid' ? (
                    <div className="my-ts-row__paydate my-ts-row__paydate--paid">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span>Paid</span>
                    </div>
                  ) : pd ? (
                    <div className="my-ts-row__paydate">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>Will be paid on the <strong>{formatDate(pd.payment_date)}</strong> payment run</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
