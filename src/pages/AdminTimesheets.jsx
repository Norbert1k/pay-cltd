import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDate, formatCurrency, getNextSunday } from '../lib/utils';
import { PageHeader, StatusPill, PaymentPill, LoadingSpinner, EmptyState } from '../components/ui';
import { generateTimesheetPDF } from '../components/TimesheetPDF';

export default function AdminTimesheets() {
  const { profile } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDays, setExpandedDays] = useState([]);
  const [statusNote, setStatusNote] = useState('');
  const [filter, setFilter] = useState({ status: '', week: '', payment: '', search: '' });

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const fetchTimesheets = async () => {
    const { data } = await supabase
      .from('timesheets')
      .select('*, profiles(id, full_name, trade, email, national_insurance, utr_number, sort_code, account_number, phone), sites(id, site_name, site_address, city, postcode)')
      .order('submitted_at', { ascending: false });
    setTimesheets(data || []);
    setLoading(false);
  };

  const handleStatusChange = async (tsId, newStatus) => {
    const updates = {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile.id,
    };
    if (statusNote) updates.admin_notes = statusNote;

    await supabase.from('timesheets').update(updates).eq('id', tsId);
    setStatusNote('');
    setExpandedId(null);
    fetchTimesheets();
  };

  const handleBulkStatus = async (newStatus) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await supabase.from('timesheets').update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile.id,
    }).in('id', ids);
    setSelected(new Set());
    fetchTimesheets();
  };

  const handleExpand = async (ts) => {
    if (expandedId === ts.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(ts.id);
    const { data } = await supabase
      .from('timesheet_days')
      .select('*')
      .eq('timesheet_id', ts.id)
      .order('day_of_week');
    setExpandedDays(data || []);
  };

  const handleDownloadPDF = async (ts) => {
    const { data: days } = await supabase
      .from('timesheet_days')
      .select('*')
      .eq('timesheet_id', ts.id);
    generateTimesheetPDF(ts, ts.profiles, ts.sites, days || []);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(t => t.id)));
    }
  };

  const filtered = timesheets.filter(ts => {
    if (filter.status && ts.status !== filter.status) return false;
    if (filter.payment && ts.payment_method !== filter.payment) return false;
    if (filter.week && ts.week_ending !== filter.week) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const name = ts.profiles?.full_name?.toLowerCase() || '';
      const site = ts.sites?.site_name?.toLowerCase() || '';
      if (!name.includes(q) && !site.includes(q)) return false;
    }
    return true;
  });

  const DAY_LABELS_MAP = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
    friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader
        title="All Timesheets"
        subtitle={`${timesheets.length} total`}
        actions={
          selected.size > 0 && (
            <div className="bulk-actions">
              <span>{selected.size} selected</span>
              <button className="btn btn--sm btn--green" onClick={() => handleBulkStatus('reviewed')}>Mark Reviewed</button>
              <button className="btn btn--sm btn--green" onClick={() => handleBulkStatus('paid')}>Mark Paid</button>
            </div>
          )
        }
      />

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          value={filter.search}
          onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
          className="form-input form-input--sm"
          placeholder="Search worker or site..."
        />
        <select value={filter.status} onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))} className="form-input form-input--sm">
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
          <option value="paid">Paid</option>
          <option value="queried">Queried</option>
        </select>
        <select value={filter.payment} onChange={(e) => setFilter(f => ({ ...f, payment: e.target.value }))} className="form-input form-input--sm">
          <option value="">All Payments</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
        <input
          type="date"
          value={filter.week}
          onChange={(e) => setFilter(f => ({ ...f, week: e.target.value }))}
          className="form-input form-input--sm"
          title="Filter by week ending"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No timesheets found" message="Try adjusting your filters." />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /></th>
                  <th>Worker</th>
                  <th>Week Ending</th>
                  <th>Site</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ts => (
                  <>
                    <tr key={ts.id} className={expandedId === ts.id ? 'row-expanded' : ''}>
                      <td><input type="checkbox" checked={selected.has(ts.id)} onChange={() => toggleSelect(ts.id)} /></td>
                      <td>
                        <strong>{ts.profiles?.full_name}</strong>
                        <br /><span className="text-muted text-sm">{ts.profiles?.trade}</span>
                      </td>
                      <td>{formatDate(ts.week_ending)}</td>
                      <td>{ts.sites?.site_name}</td>
                      <td><strong>{formatCurrency(ts.total_amount)}</strong></td>
                      <td><PaymentPill method={ts.payment_method} /></td>
                      <td><StatusPill status={ts.status} /></td>
                      <td>
                        <div className="action-btns">
                          <button className="btn btn--sm btn--outline" onClick={() => handleExpand(ts)} title="View details">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button className="btn btn--sm btn--outline" onClick={() => handleDownloadPDF(ts)} title="Download PDF">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === ts.id && (
                      <tr key={ts.id + '-detail'} className="detail-row">
                        <td colSpan={8}>
                          <div className="detail-panel">
                            <div className="detail-panel__days">
                              <h4>Daily Breakdown</h4>
                              <table className="mini-table">
                                <thead>
                                  <tr><th>Day</th><th>Start</th><th>End</th><th>Type</th><th>Gross</th><th>Ded.</th><th>Net</th></tr>
                                </thead>
                                <tbody>
                                  {expandedDays.map(d => (
                                    <tr key={d.id}>
                                      <td>{DAY_LABELS_MAP[d.day_of_week]}</td>
                                      <td>{d.start_time || '-'}</td>
                                      <td>{d.end_time || '-'}</td>
                                      <td>{d.work_type || '-'}</td>
                                      <td>{formatCurrency(d.gross_amount)}</td>
                                      <td>{formatCurrency(d.deductions)}</td>
                                      <td>{formatCurrency(d.net_amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="detail-panel__actions">
                              <h4>Update Status</h4>
                              <div className="status-btns">
                                {['submitted', 'reviewed', 'paid', 'queried'].map(s => (
                                  <button
                                    key={s}
                                    className={`btn btn--sm ${ts.status === s ? 'btn--active' : 'btn--outline'}`}
                                    onClick={() => handleStatusChange(ts.id, s)}
                                  >
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={statusNote}
                                onChange={(e) => setStatusNote(e.target.value)}
                                placeholder="Admin notes (visible to worker if queried)..."
                                className="form-input"
                                rows={2}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="admin-cards-mobile">
            {filtered.map(ts => (
              <div key={ts.id} className="timesheet-card timesheet-card--admin" onClick={() => handleExpand(ts)}>
                <div className="timesheet-card__top">
                  <strong>{ts.profiles?.full_name}</strong>
                  <StatusPill status={ts.status} />
                </div>
                <div className="timesheet-card__details">
                  <span>{formatDate(ts.week_ending)} &mdash; {ts.sites?.site_name}</span>
                  <PaymentPill method={ts.payment_method} />
                </div>
                <div className="timesheet-card__bottom">
                  <span className="timesheet-card__amount">{formatCurrency(ts.total_amount)}</span>
                  <button className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); handleDownloadPDF(ts); }}>PDF</button>
                </div>
                {expandedId === ts.id && (
                  <div className="timesheet-card__expanded">
                    {expandedDays.map(d => (
                      <div key={d.id} className="timesheet-card__day">
                        <span>{DAY_LABELS_MAP[d.day_of_week]}</span>
                        <span>{d.start_time || '-'} - {d.end_time || '-'}</span>
                        <span>{formatCurrency(d.net_amount)}</span>
                      </div>
                    ))}
                    <div className="timesheet-card__status-actions">
                      {['reviewed', 'paid', 'queried'].map(s => (
                        <button
                          key={s}
                          className={`btn btn--sm ${ts.status === s ? 'btn--active' : 'btn--outline'}`}
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(ts.id, s); }}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
