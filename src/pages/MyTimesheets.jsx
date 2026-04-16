import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDate, formatCurrency, STATUSES, STATUS_LABELS } from '../lib/utils';
import { PageHeader, StatusPill, ApprovalPipeline, PaymentPill, LoadingSpinner, EmptyState } from '../components/ui';
import { generateTimesheetPDF } from '../components/TimesheetPDF';

export default function MyTimesheets() {
  const { profile } = useAuth();
  const location = useLocation();
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', month: '' });
  const [justSubmitted, setJustSubmitted] = useState(location.state?.submitted);
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const initialExpanded = useRef(false);

  useEffect(() => {
    if (profile) {
      fetchTimesheets();
    } else {
      setLoading(false);
    }
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
      .maybeSingle();

    generateTimesheetPDF(ts, profile, site, days || []);
  };

  // Build month options from timesheets
  const monthOptions = useMemo(() => {
    const months = new Set();
    timesheets.forEach(ts => {
      const d = new Date(ts.week_ending + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    });
    return Array.from(months).sort().reverse().map(m => {
      const [year, month] = m.split('-');
      const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      return { value: m, label };
    });
  }, [timesheets]);

  const filtered = timesheets.filter(ts => {
    if (filter.status && ts.status !== filter.status) return false;
    if (filter.month) {
      const tsMonth = ts.week_ending.substring(0, 7);
      if (tsMonth !== filter.month) return false;
    }
    return true;
  });

  // Group filtered timesheets by month for display
  const groupedByMonth = useMemo(() => {
    const groups = {};
    filtered.forEach(ts => {
      const d = new Date(ts.week_ending + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { label, timesheets: [], total: 0 };
      groups[key].timesheets.push(ts);
      groups[key].total += parseFloat(ts.total_amount || 0);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  // Auto-expand the most recent month on first load only
  useEffect(() => {
    if (groupedByMonth.length > 0 && !initialExpanded.current) {
      setExpandedMonths(new Set([groupedByMonth[0][0]]));
      initialExpanded.current = true;
    }
  }, [groupedByMonth]);

  const toggleMonth = (key) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader
        title="My Timesheets"
        subtitle={`${timesheets.length} total submission${timesheets.length !== 1 ? 's' : ''}`}
      />

      {justSubmitted && (
        <div className="alert alert--success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div>
            <strong>Timesheet submitted!</strong>
            <p>Your timesheet has been received and is pending approval.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <select
          value={filter.month}
          onChange={(e) => setFilter(f => ({ ...f, month: e.target.value }))}
          className="form-input form-input--sm"
        >
          <option value="">All Months</option>
          {monthOptions.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}
          className="form-input form-input--sm"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
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
        <div className="my-ts-list">
          {groupedByMonth.map(([key, group]) => {
            const isOpen = expandedMonths.has(key);
            return (
              <div key={key} className="my-ts-month">
                <div className="my-ts-month__header" onClick={() => toggleMonth(key)}>
                  <div className="my-ts-month__left">
                    <svg className={`my-ts-month__chevron ${isOpen ? 'my-ts-month__chevron--open' : ''}`}
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <h3>{group.label}</h3>
                    <span className="my-ts-month__count">{group.timesheets.length} timesheet{group.timesheets.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="my-ts-month__total">{formatCurrency(group.total)}</span>
                </div>
                {isOpen && (
                  <div className="my-ts-month__items">
                    {group.timesheets.map(ts => (
                      <div key={ts.id} className={`my-ts-row ${ts.status === 'queried' ? 'my-ts-row--queried' : ''}`}>
                        <div className="my-ts-row__main">
                          <div className="my-ts-row__left">
                            <span className="my-ts-row__date">{formatDate(ts.week_ending)}</span>
                            <span className="my-ts-row__site">{ts.sites?.site_name}</span>
                          </div>
                          <div className="my-ts-row__amount">{formatCurrency(ts.total_amount)}</div>
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
                          <button className="btn btn--sm btn--outline" onClick={() => handleDownloadPDF(ts)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                          </button>
                        </div>
                        {ts.status === 'queried' && ts.admin_notes && (
                          <div className="my-ts-row__query">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span><strong>Query:</strong> {ts.admin_notes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
