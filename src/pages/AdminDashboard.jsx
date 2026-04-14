import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getNextSunday, formatDate, formatCurrency } from '../lib/utils';
import { PageHeader, StatCard, StatusPill, PaymentPill, LoadingSpinner } from '../components/ui';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ workers: 0, thisWeek: 0, pending: 0, totalValue: 0, cardCount: 0, otherCount: 0 });
  const [recent, setRecent] = useState([]);
  const [incompleteProfiles, setIncompleteProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const weekEnding = getNextSunday();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    // Active workers
    const { count: workerCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'worker')
      .eq('status', 'active');

    // This week's timesheets
    const { data: weekTimesheets } = await supabase
      .from('timesheets')
      .select('*')
      .eq('week_ending', weekEnding);

    const thisWeek = weekTimesheets || [];
    const pending = thisWeek.filter(t => t.status === 'submitted').length;
    const totalValue = thisWeek.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);
    const cardCount = thisWeek.filter(t => t.payment_method === 'card').length;
    const otherCount = thisWeek.filter(t => t.payment_method === 'other').length;

    setStats({
      workers: workerCount || 0,
      thisWeek: thisWeek.length,
      pending,
      totalValue,
      cardCount,
      otherCount,
    });

    // Recent 10 timesheets
    const { data: recentData } = await supabase
      .from('timesheets')
      .select('*, profiles(full_name, trade), sites(site_name)')
      .order('submitted_at', { ascending: false })
      .limit(10);
    setRecent(recentData || []);

    // Incomplete profiles
    const { data: incomplete } = await supabase
      .from('profiles')
      .select('id, full_name, email, payment_info_complete')
      .eq('role', 'worker')
      .eq('status', 'active')
      .eq('payment_info_complete', false)
      .limit(5);
    setIncompleteProfiles(incomplete || []);

    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Week ending ${formatDate(weekEnding)}`}
      />

      {/* Stats Row */}
      <div className="stats-grid">
        <StatCard
          label="Active Workers"
          value={stats.workers}
          color="var(--green)"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
        />
        <StatCard
          label="This Week"
          value={stats.thisWeek}
          sub="timesheets submitted"
          color="#378ADD"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
          }
        />
        <StatCard
          label="Pending Review"
          value={stats.pending}
          color="#BA7517"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          }
        />
        <StatCard
          label="Total Value"
          value={formatCurrency(stats.totalValue)}
          sub="this week"
          color="var(--green)"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
        />
      </div>

      {/* Payment Method Breakdown */}
      <div className="section">
        <h3 className="section__title">Payment Method Breakdown</h3>
        <div className="payment-breakdown">
          <div className="payment-bar">
            {stats.thisWeek > 0 ? (
              <>
                <div
                  className="payment-bar__segment payment-bar__segment--card"
                  style={{ width: `${(stats.cardCount / stats.thisWeek) * 100}%` }}
                >
                  {stats.cardCount > 0 && `Card (${stats.cardCount})`}
                </div>
                <div
                  className="payment-bar__segment payment-bar__segment--other"
                  style={{ width: `${(stats.otherCount / stats.thisWeek) * 100}%` }}
                >
                  {stats.otherCount > 0 && `Other (${stats.otherCount})`}
                </div>
              </>
            ) : (
              <div className="payment-bar__empty">No submissions this week</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="section">
        <div className="section__header">
          <h3 className="section__title">Recent Submissions</h3>
          <Link to="/admin/timesheets" className="section__link">View All &rarr;</Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-muted">No timesheets submitted yet.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Week Ending</th>
                  <th>Site</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(ts => (
                  <tr key={ts.id}>
                    <td>
                      <strong>{ts.profiles?.full_name}</strong>
                      <br /><span className="text-muted text-sm">{ts.profiles?.trade}</span>
                    </td>
                    <td>{formatDate(ts.week_ending)}</td>
                    <td>{ts.sites?.site_name}</td>
                    <td><strong>{formatCurrency(ts.total_amount)}</strong></td>
                    <td><PaymentPill method={ts.payment_method} /></td>
                    <td><StatusPill status={ts.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          /* Mobile card version */
        )}
        {recent.length > 0 && (
          <div className="admin-cards-mobile">
            {recent.map(ts => (
              <div key={ts.id} className="timesheet-card">
                <div className="timesheet-card__top">
                  <strong>{ts.profiles?.full_name}</strong>
                  <StatusPill status={ts.status} />
                </div>
                <div className="timesheet-card__details">
                  <span>{formatDate(ts.week_ending)} &mdash; {ts.sites?.site_name}</span>
                  <PaymentPill method={ts.payment_method} />
                </div>
                <div className="timesheet-card__amount">{formatCurrency(ts.total_amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incomplete Profiles */}
      {incompleteProfiles.length > 0 && (
        <div className="section">
          <h3 className="section__title">Workers Needing Attention</h3>
          <div className="card-list">
            {incompleteProfiles.map(w => (
              <div key={w.id} className="worker-alert-card">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>
                  <strong>{w.full_name}</strong>
                  <span className="text-muted"> &mdash; Payment details incomplete</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
