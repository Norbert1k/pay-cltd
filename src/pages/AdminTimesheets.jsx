import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDate, formatDateCompact, formatCurrency, STATUSES, STATUS_LABELS, groupTimesheetsByWorker, canApprove } from '../lib/utils';
import { PageHeader, ApprovalPipeline, ApprovalControls, PaymentPill, LoadingSpinner, EmptyState } from '../components/ui';
import { generateTimesheetPDF } from '../components/TimesheetPDF';

export default function AdminTimesheets() {
  const { profile } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWorker, setExpandedWorker] = useState(null);
  const [expandedDays, setExpandedDays] = useState({});
  const [statusNote, setStatusNote] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [sendingAlert, setSendingAlert] = useState(false);
  const [paymentDates, setPaymentDates] = useState([]);
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0);
  const [filter, setFilter] = useState({ status: '', payment: '', search: '' });

  useEffect(() => { fetchPaymentDates(); }, []);
  useEffect(() => { if (paymentDates.length > 0) fetchTimesheets(); }, [selectedPeriodIdx, paymentDates]);

  const fetchPaymentDates = async () => {
    const { data } = await supabase.from('payment_dates').select('*').order('payment_date', { ascending: true });
    const sorted = data || [];
    setPaymentDates(sorted);

    if (sorted.length === 0) {
      fetchAllTimesheets();
      return;
    }

    // Auto-select current period: find the next upcoming or most recent payment date
    const today = new Date().toISOString().split('T')[0];
    let currentIdx = sorted.findIndex(d => d.payment_date >= today);
    if (currentIdx === -1) currentIdx = sorted.length - 1; // all past, show latest
    setSelectedPeriodIdx(currentIdx);
  };

  // Calculate the 2 week-ending Sundays that fall within the selected period
  const getWeekEndingsForPeriod = () => {
    if (paymentDates.length === 0) return [];
    const current = paymentDates[selectedPeriodIdx];
    const previous = selectedPeriodIdx > 0 ? paymentDates[selectedPeriodIdx - 1] : null;
    if (!current) return [];

    const periodEnd = current.cutoff_date || current.payment_date;

    // If no previous payment date, default to 14 days before cutoff (2 weeks)
    let periodStart;
    if (previous) {
      periodStart = previous.payment_date;
    } else {
      const d = new Date(periodEnd + 'T00:00:00');
      d.setDate(d.getDate() - 15);
      periodStart = d.toISOString().split('T')[0];
    }

    // Find all Sundays between periodStart (exclusive) and periodEnd (inclusive)
    const sundays = [];
    const start = new Date(periodStart + 'T00:00:00');
    const end = new Date(periodEnd + 'T00:00:00');

    // Start from the Sunday after periodStart
    const d = new Date(start);
    d.setDate(d.getDate() + 1);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);

    while (d <= end) {
      sundays.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 7);
    }

    return sundays;
  };

  const periodWeekEndings = getWeekEndingsForPeriod();

  const fetchAllTimesheets = async () => {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*, profiles!timesheets_worker_id_fkey(id, full_name, trade, email, phone, cis_rate, cis_verified), sites(id, site_name)')
      .order('submitted_at', { ascending: false });
    if (error) console.error('Fetch error:', error);
    setTimesheets(data || []);
    setLoading(false);
  };

  const fetchTimesheets = async () => {
    if (paymentDates.length === 0) return;
    const current = paymentDates[selectedPeriodIdx];
    const previous = selectedPeriodIdx > 0 ? paymentDates[selectedPeriodIdx - 1] : null;
    if (!current) return;

    const periodEnd = current.cutoff_date || current.payment_date;
    let periodStart;
    if (previous) {
      periodStart = previous.payment_date;
    } else {
      const d = new Date(periodEnd + 'T00:00:00');
      d.setDate(d.getDate() - 15);
      periodStart = d.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('timesheets')
      .select('*, profiles!timesheets_worker_id_fkey(id, full_name, trade, email, phone, cis_rate, cis_verified), sites(id, site_name)')
      .gt('week_ending', periodStart)
      .lte('week_ending', periodEnd)
      .order('submitted_at', { ascending: false });
    if (error) console.error('Fetch error:', error);
    setTimesheets(data || []);
    setLoading(false);
  };

  const handleStatusChange = async (tsId, newStatus) => {
    const ts = timesheets.find(t => t.id === tsId);
    const updates = { status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: profile.id };
    if (statusNote) updates.admin_notes = statusNote;

    await supabase.from('timesheets').update(updates).eq('id', tsId);

    // Create alert for worker
    if (ts && ['approved_accounts', 'approved_director', 'paid', 'queried'].includes(newStatus)) {
      const titles = {
        approved_accounts: 'Accounts Approved',
        approved_director: 'Director Approved',
        paid: 'Payment Processed',
        queried: 'Timesheet Query — Action Required',
      };
      const messages = {
        approved_accounts: `Your timesheet for WE ${formatDate(ts.week_ending)} has been approved by Accounts.`,
        approved_director: `Your timesheet for WE ${formatDate(ts.week_ending)} has been approved by a Director.`,
        paid: `Payment of ${formatCurrency(ts.total_amount)} for WE ${formatDate(ts.week_ending)} has been processed.`,
        queried: `There is a query on your timesheet for WE ${formatDate(ts.week_ending)}. ${statusNote ? statusNote : 'Please review your submission.'}`,
      };
      await supabase.from('alerts').insert({
        worker_id: ts.worker_id, timesheet_id: tsId,
        type: newStatus === 'queried' ? 'query' : 'status_change',
        title: titles[newStatus], message: messages[newStatus], created_by: profile.id,
      });
    }
    setStatusNote('');
    fetchTimesheets();
    window.dispatchEvent(new Event('badges-refresh'));
  };

  const handleSendAlert = async (workerId) => {
    if (!alertMessage.trim()) return;
    setSendingAlert(true);
    await supabase.from('alerts').insert({
      worker_id: workerId, type: 'general',
      title: 'Message from Admin', message: alertMessage, created_by: profile.id,
    });
    setAlertMessage('');
    setSendingAlert(false);
    window.dispatchEvent(new Event('badges-refresh'));
  };

  const handleExpandWorker = async (workerId) => {
    if (expandedWorker === workerId) { setExpandedWorker(null); return; }
    setExpandedWorker(workerId);
    // Fetch day data for all timesheets of this worker in current period
    const workerTs = timesheets.filter(t => (t.worker_id || t.profiles?.id) === workerId);
    const dayMap = {};
    for (const ts of workerTs) {
      const { data } = await supabase.from('timesheet_days').select('*').eq('timesheet_id', ts.id).order('day_of_week');
      dayMap[ts.id] = data || [];
    }
    setExpandedDays(dayMap);
  };

  const handleDownloadPDF = async (ts) => {
    const { data: days } = await supabase.from('timesheet_days').select('*').eq('timesheet_id', ts.id);
    generateTimesheetPDF(ts, ts.profiles, ts.sites, days || []);
  };

  // Download all timesheets for period as individual PDFs (grouped)
  const handleDownloadAll = async () => {
    for (const ts of filtered) {
      const { data: days } = await supabase.from('timesheet_days').select('*').eq('timesheet_id', ts.id);
      generateTimesheetPDF(ts, ts.profiles, ts.sites, days || []);
    }
  };

  const filtered = timesheets.filter(ts => {
    if (filter.status && ts.status !== filter.status) return false;
    if (filter.payment && ts.payment_method !== filter.payment) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!(ts.profiles?.full_name?.toLowerCase() || '').includes(q) && !(ts.sites?.site_name?.toLowerCase() || '').includes(q)) return false;
    }
    return true;
  });

  const grouped = groupTimesheetsByWorker(filtered);
  const currentPayment = paymentDates[selectedPeriodIdx];

  const DL = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader title="All Timesheets" subtitle={`${filtered.length} timesheet${filtered.length !== 1 ? 's' : ''} this period`}
        actions={
          <div className="action-btns">
            {filtered.length > 0 && (
              <button className="btn btn--sm btn--outline" onClick={handleDownloadAll} title="Download all PDFs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download All PDFs
              </button>
            )}
          </div>
        }
      />

      {/* Period Navigation */}
      {paymentDates.length > 0 && (
        <div className="period-selector">
          <button className="btn btn--sm btn--outline" disabled={selectedPeriodIdx <= 0}
            onClick={() => { setSelectedPeriodIdx(i => i - 1); setLoading(true); }}>
            &larr; Previous
          </button>
          <div className="period-selector__center">
            <div className="period-selector__title">Payment Run: {formatDate(currentPayment?.payment_date)}</div>
            <div className="period-selector__weeks">
              {periodWeekEndings.length > 0 ? (
                <>
                  Covering week{periodWeekEndings.length > 1 ? 's' : ''} ending{' '}
                  {periodWeekEndings.map((we, i) => (
                    <span key={we}>
                      <strong>{formatDate(we)}</strong>
                      {i < periodWeekEndings.length - 1 && ' & '}
                    </span>
                  ))}
                </>
              ) : (
                <span>No weeks in this period</span>
              )}
            </div>
            <div className="period-selector__cutoff">
              Submit by: {formatDate(currentPayment?.cutoff_date)} &mdash; {(() => {
                const days = Math.ceil((new Date(currentPayment?.cutoff_date + 'T00:00:00') - new Date()) / 86400000);
                if (days < 0) return <span className="text-red">Cutoff passed</span>;
                if (days === 0) return <span className="text-red">Today!</span>;
                if (days === 1) return <span style={{color: '#BA7517'}}>Tomorrow</span>;
                return <span>{days} days left</span>;
              })()}
            </div>
          </div>
          <button className="btn btn--sm btn--outline" disabled={selectedPeriodIdx >= paymentDates.length - 1}
            onClick={() => { setSelectedPeriodIdx(i => i + 1); setLoading(true); }}>
            Next &rarr;
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <input type="text" value={filter.search} onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))} className="form-input form-input--sm" placeholder="Search worker or site..." />
        <select value={filter.status} onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))} className="form-input form-input--sm">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filter.payment} onChange={(e) => setFilter(f => ({ ...f, payment: e.target.value }))} className="form-input form-input--sm">
          <option value="">All Payments</option>
          <option value="card">Bank Transfer</option>
          <option value="other">Other</option>
        </select>
      </div>

      {grouped.length === 0 ? <EmptyState title="No timesheets found" message="Try adjusting your filters or period." /> : (
        <>
          {/* Desktop — Grouped by worker */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Worker</th><th>Trade</th><th>Weeks</th><th>Site(s)</th><th>Total</th><th>Payment</th><th>Approval</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(group => {
                  const isExpanded = expandedWorker === group.workerId;
                  // Get worst status (earliest in pipeline)
                  const statusOrder = ['queried', 'submitted', 'approved_accounts', 'approved_director', 'paid'];
                  const worstStatus = group.timesheets.reduce((worst, ts) => {
                    return statusOrder.indexOf(ts.status) < statusOrder.indexOf(worst) ? ts.status : worst;
                  }, 'paid');
                  const sites = [...new Set(group.timesheets.map(t => t.sites?.site_name).filter(Boolean))];

                  return (
                    <>{/* eslint-disable-next-line react/jsx-key */}
                      <tr key={group.workerId} className={`worker-group-row ${isExpanded ? 'row-expanded' : ''}`} onClick={() => handleExpandWorker(group.workerId)}>
                        <td>
                          <strong>{group.worker?.full_name}</strong>
                          {group.worker && !group.worker.cis_verified && <><br /><span className="text-sm" style={{color:'#BA7517'}}>CIS unverified</span></>}
                        </td>
                        <td><span className="text-muted">{group.worker?.trade || '-'}</span></td>
                        <td>
                          <div style={{display:'flex', gap: 4, flexWrap:'nowrap'}}>
                            {group.weekEndings.map((we, i) => (
                              <span key={we}>
                                <span className="week-tag">{formatDateCompact(we)}</span>
                                {i < group.weekEndings.length - 1 && <span style={{color:'var(--grey)', fontSize:'0.7rem'}}> &amp; </span>}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>{sites.join(', ')}</td>
                        <td><strong>{formatCurrency(group.totalAmount)}</strong></td>
                        <td>
                          {[...new Set(group.timesheets.map(t => t.payment_method))].map(m => (
                            <PaymentPill key={m} method={m} />
                          ))}
                        </td>
                        <td><ApprovalPipeline status={worstStatus} /></td>
                        <td>
                          <div className="action-btns" onClick={e => e.stopPropagation()}>
                            {group.timesheets.map(ts => (
                              <button key={ts.id} className="btn btn--sm btn--outline" onClick={() => handleDownloadPDF(ts)} title={`PDF WE ${formatDateCompact(ts.week_ending)}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={group.workerId + '-detail'} className="detail-row">
                          <td colSpan={8}>
                            <div className="worker-detail-expanded">
                              {group.timesheets.map(ts => (
                                <div key={ts.id} className="ts-detail-card">
                                  <div className="ts-detail-card__header">
                                    <strong>Week Ending: {formatDate(ts.week_ending)}</strong>
                                    <span>{ts.sites?.site_name} &mdash; {formatCurrency(ts.total_amount)}</span>
                                    <ApprovalPipeline status={ts.status} />
                                  </div>

                                  {expandedDays[ts.id] && expandedDays[ts.id].length > 0 && (
                                    <table className="mini-table">
                                      <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Type</th><th>Gross</th><th>Ded.</th><th>Net</th></tr></thead>
                                      <tbody>
                                        {expandedDays[ts.id].map(d => (
                                          <tr key={d.id}>
                                            <td>{DL[d.day_of_week]}</td><td>{d.start_time || '-'}</td><td>{d.end_time || '-'}</td>
                                            <td>{d.work_type || '-'}</td><td>{formatCurrency(d.gross_amount)}</td><td>{formatCurrency(d.deductions)}</td><td>{formatCurrency(d.net_amount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}

                                  {ts.cis_rate > 0 && (
                                    <div className="cis-summary">
                                      <span>CIS {ts.cis_rate}% applied</span>
                                      <span>Net: <strong>{formatCurrency(ts.total_amount)}</strong></span>
                                    </div>
                                  )}

                                  <div className="ts-detail-card__actions">
                                    <ApprovalControls
                                      status={ts.status}
                                      onStatusChange={(newStatus) => handleStatusChange(ts.id, newStatus)}
                                      canApproveAccounts={['admin', 'accountant', 'director'].includes(profile?.role)}
                                      canApproveDirector={['admin', 'director'].includes(profile?.role)}
                                      canMarkPaid={['admin', 'accountant', 'director'].includes(profile?.role)}
                                    />
                                    <textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
                                      placeholder="Notes (visible to worker if queried)..." className="form-input" rows={2} />
                                  </div>
                                </div>
                              ))}

                              {/* Send alert to worker */}
                              <div className="send-alert-section">
                                <h4>Send Message to {group.worker?.full_name}</h4>
                                <textarea value={alertMessage} onChange={(e) => setAlertMessage(e.target.value)}
                                  placeholder="Type a message..." className="form-input" rows={2} />
                                <button className="btn btn--sm btn--primary" onClick={() => handleSendAlert(group.workerId)}
                                  disabled={sendingAlert || !alertMessage.trim()}>
                                  {sendingAlert ? 'Sending...' : 'Send Alert'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="admin-cards-mobile">
            {grouped.map(group => (
              <div key={group.workerId} className="timesheet-card timesheet-card--admin" onClick={() => handleExpandWorker(group.workerId)}>
                <div className="timesheet-card__top">
                  <div>
                    <strong>{group.worker?.full_name}</strong>
                    <span className="text-muted text-sm"> &mdash; {group.worker?.trade || 'Worker'}</span>
                  </div>
                  <ApprovalPipeline status={group.timesheets[0]?.status} />
                </div>
                <div className="timesheet-card__details">
                  <span>{group.weekEndings.map(w => formatDateCompact(w)).join(' & ')}</span>
                  {[...new Set(group.timesheets.map(t => t.payment_method))].map(m => <PaymentPill key={m} method={m} />)}
                </div>
                <div className="timesheet-card__amount">{formatCurrency(group.totalAmount)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
