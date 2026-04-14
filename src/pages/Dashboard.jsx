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

  const weekEnding = getNextSunday();

  useEffect(() => {
    if (!profile) return;
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    // Check current week
    const { data: currentWeek } = await supabase
      .from('timesheets')
      .select('*, sites(site_name)')
      .eq('worker_id', profile.id)
      .eq('week_ending', weekEnding)
      .single();

    setCurrentWeekSubmitted(currentWeek);

    // Recent timesheets
    const { data: recent } = await supabase
      .from('timesheets')
      .select('*, sites(site_name)')
      .eq('worker_id', profile.id)
      .order('week_ending', { ascending: false })
      .limit(5);

    setRecentTimesheets(recent || []);
    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const profileComplete = profile?.payment_info_complete;

  return (
    <div className="page">
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle="Submit and track your weekly timesheets"
      />

      {!profileComplete && (
        <div className="alert alert--warning">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <strong>Complete your profile</strong>
            <p>Add your payment details to enable &ldquo;Pay by Card&rdquo; option.</p>
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
