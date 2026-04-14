import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDate, formatCurrency } from '../lib/utils';
import { PageHeader, StatusPill, PaymentPill, LoadingSpinner, EmptyState } from '../components/ui';
import { generateTimesheetPDF } from '../components/TimesheetPDF';

export default function MyTimesheets() {
  const { profile } = useAuth();
  const location = useLocation();
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', month: '' });
  const [justSubmitted, setJustSubmitted] = useState(location.state?.submitted);

  useEffect(() => {
    if (profile) fetchTimesheets();
  }, [profile]);

  useEffect(() => {
    if (justSubmitted) {
      const timer = setTimeout(() => setJustSubmitted(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [justSubmitted]);

  const fetchTimesheets = async () => {
    const { data } = await supabase
      .from('timesheets')
      .select('*, sites(site_name)')
      .eq('worker_id', profile.id)
      .order('week_ending', { ascending: false });
    setTimesheets(data || []);
    setLoading(false);
  };

  const handleDownloadPDF = async (ts) => {
    const { data: days } = await supabase
      .from('timesheet_days')
      .select('*')
      .eq('timesheet_id', ts.id);

    const { data: site } = await supabase
      .from('sites')
      .select('*')
      .eq('id', ts.site_id)
      .single();

    generateTimesheetPDF(ts, profile, site, days || []);
  };

  const filtered = timesheets.filter(ts => {
    if (filter.status && ts.status !== filter.status) return false;
    if (filter.month) {
      const tsMonth = ts.week_ending.substring(0, 7);
      if (tsMonth !== filter.month) return false;
    }
    return true;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader
        title="My Timesheets"
        subtitle={`${timesheets.length} total submissions`}
      />

      {justSubmitted && (
        <div className="alert alert--success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div>
            <strong>Timesheet submitted successfully!</strong>
            <p>Your timesheet has been received and is pending review.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <select
          value={filter.status}
          onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}
          className="form-input form-input--sm"
        >
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
          <option value="paid">Paid</option>
          <option value="queried">Queried</option>
        </select>
        <input
          type="month"
          value={filter.month}
          onChange={(e) => setFilter(f => ({ ...f, month: e.target.value }))}
          className="form-input form-input--sm"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No timesheets found"
          message={timesheets.length === 0
            ? "You haven't submitted any timesheets yet."
            : "No timesheets match your filters."
          }
        />
      ) : (
        <div className="card-list">
          {filtered.map(ts => (
            <div key={ts.id} className="timesheet-card">
              <div className="timesheet-card__top">
                <span className="timesheet-card__date">{formatDate(ts.week_ending)}</span>
                <StatusPill status={ts.status} />
              </div>
              <div className="timesheet-card__details">
                <span>{ts.sites?.site_name}</span>
                <PaymentPill method={ts.payment_method} />
              </div>
              <div className="timesheet-card__bottom">
                <span className="timesheet-card__amount">{formatCurrency(ts.total_amount)}</span>
                <button
                  className="btn btn--sm btn--outline"
                  onClick={() => handleDownloadPDF(ts)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  PDF
                </button>
              </div>
              {ts.status === 'queried' && ts.admin_notes && (
                <div className="timesheet-card__notes">
                  <strong>Admin Note:</strong> {ts.admin_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
