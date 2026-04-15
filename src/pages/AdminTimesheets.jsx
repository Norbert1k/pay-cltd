import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDate, formatCurrency, STATUSES, STATUS_LABELS } from '../lib/utils';
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
  const [alertMessage, setAlertMessage] = useState('');
  const [sendingAlert, setSendingAlert] = useState(false);
  const [filter, setFilter] = useState({ status: '', week: '', payment: '', search: '' });

  useEffect(() => { fetchTimesheets(); }, []);

  const fetchTimesheets = async () => {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*, profiles!timesheets_worker_id_fkey(id, full_name, trade, email, national_insurance, utr_number, sort_code, account_number, phone, cis_rate, cis_verified), sites(id, site_name, site_address, city, postcode)')
      .order('submitted_at', { ascending: false });
    if (error) console.error('Fetch timesheets error:', error);
    setTimesheets(data || []);
    setLoading(false);
  };

  const handleStatusChange = async (tsId, newStatus) => {
    const ts = timesheets.find(t => t.id === tsId);
    const updates = { status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: profile.id };
    if (statusNote) updates.admin_notes = statusNote;

    await supabase.from('timesheets').update(updates).eq('id', tsId);

    if (ts && ['approved', 'paid', 'queried'].includes(newStatus)) {
      const titles = { approved: 'Timesheet Approved', paid: 'Payment Processed', queried: 'Timesheet Query' };
      const messages = {
        approved: `Your timesheet for week ending ${formatDate(ts.week_ending)} (${ts.sites?.site_name}) has been approved.`,
        paid: `Payment of ${formatCurrency(ts.total_amount)} for week ending ${formatDate(ts.week_ending)} has been processed.`,
        queried: `There is a query on your timesheet for week ending ${formatDate(ts.week_ending)}. ${statusNote ? 'Note: ' + statusNote : 'Please check your timesheet.'}`,
      };
      await supabase.from('alerts').insert({
        worker_id: ts.worker_id, timesheet_id: tsId,
        type: newStatus === 'queried' ? 'query' : 'status_change',
        title: titles[newStatus], message: messages[newStatus], created_by: profile.id,
      });
    }
    setStatusNote('');
    setExpandedId(null);
    fetchTimesheets();
  };

  const handleSendAlert = async (ts) => {
    if (!alertMessage.trim()) return;
    setSendingAlert(true);
    await supabase.from('alerts').insert({
      worker_id: ts.worker_id, timesheet_id: ts.id, type: 'general',
      title: 'Message from Admin', message: alertMessage, created_by: profile.id,
    });
    setAlertMessage('');
    setSendingAlert(false);
  };

  const handleBulkStatus = async (newStatus) => {
    if (selected.size === 0) return;
    await supabase.from('timesheets').update({
      status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: profile.id,
    }).in('id', Array.from(selected));
    setSelected(new Set());
    fetchTimesheets();
  };

  const handleExpand = async (ts) => {
    if (expandedId === ts.id) { setExpandedId(null); return; }
    setExpandedId(ts.id);
    const { data } = await supabase.from('timesheet_days').select('*').eq('timesheet_id', ts.id).order('day_of_week');
    setExpandedDays(data || []);
  };

  const handleDownloadPDF = async (ts) => {
    const { data: days } = await supabase.from('timesheet_days').select('*').eq('timesheet_id', ts.id);
    generateTimesheetPDF(ts, ts.profiles, ts.sites, days || []);
  };

  const toggleSelect = (id) => { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map(t => t.id))); };

  const filtered = timesheets.filter(ts => {
    if (filter.status && ts.status !== filter.status) return false;
    if (filter.payment && ts.payment_method !== filter.payment) return false;
    if (filter.week && ts.week_ending !== filter.week) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!(ts.profiles?.full_name?.toLowerCase() || '').includes(q) && !(ts.sites?.site_name?.toLowerCase() || '').includes(q)) return false;
    }
    return true;
  });

  const DL = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader title="All Timesheets" subtitle={`${timesheets.length} total`}
        actions={selected.size > 0 && (
          <div className="bulk-actions">
            <span>{selected.size} selected</span>
            <button className="btn btn--sm btn--green" onClick={() => handleBulkStatus('approved')}>Approve</button>
            <button className="btn btn--sm btn--green" onClick={() => handleBulkStatus('paid')}>Mark Paid</button>
          </div>
        )}
      />

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
        <input type="date" value={filter.week} onChange={(e) => setFilter(f => ({ ...f, week: e.target.value }))} className="form-input form-input--sm" />
      </div>

      {filtered.length === 0 ? <EmptyState title="No timesheets found" message="Try adjusting your filters." /> : (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /></th>
                  <th>Worker</th><th>Week Ending</th><th>Site</th><th>Amount</th><th>CIS</th><th>Payment</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ts => (
                  <>{/* eslint-disable-next-line react/jsx-key */}
                    <tr key={ts.id} className={expandedId === ts.id ? 'row-expanded' : ''}>
                      <td><input type="checkbox" checked={selected.has(ts.id)} onChange={() => toggleSelect(ts.id)} /></td>
                      <td>
                        <strong>{ts.profiles?.full_name}</strong>
                        <br /><span className="text-muted text-sm">{ts.profiles?.trade}</span>
                        {ts.profiles && !ts.profiles.cis_verified && (
                          <><br /><span className="text-sm" style={{color: '#BA7517'}}>CIS unverified</span></>
                        )}
                      </td>
                      <td>{formatDate(ts.week_ending)}</td>
                      <td>{ts.sites?.site_name}</td>
                      <td><strong>{formatCurrency(ts.total_amount)}</strong></td>
                      <td>{ts.cis_rate ? <span className="pill" style={{background:'#fef3c7',color:'#92400e',borderColor:'#fde68a'}}>{ts.cis_rate}%</span> : <span className="text-muted">-</span>}</td>
                      <td><PaymentPill method={ts.payment_method} /></td>
                      <td><StatusPill status={ts.status} /></td>
                      <td>
                        <div className="action-btns">
                          <button className="btn btn--sm btn--outline" onClick={() => handleExpand(ts)} title="View">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          </button>
                          <button className="btn btn--sm btn--outline" onClick={() => handleDownloadPDF(ts)} title="PDF">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === ts.id && (
                      <tr key={ts.id + '-d'} className="detail-row">
                        <td colSpan={9}>
                          <div className="detail-panel">
                            <div className="detail-panel__days">
                              <h4>Daily Breakdown</h4>
                              <table className="mini-table">
                                <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Type</th><th>Gross</th><th>Ded.</th><th>Net</th></tr></thead>
                                <tbody>
                                  {expandedDays.map(d => (
                                    <tr key={d.id}>
                                      <td>{DL[d.day_of_week]}</td><td>{d.start_time || '-'}</td><td>{d.end_time || '-'}</td>
                                      <td>{d.work_type || '-'}</td><td>{formatCurrency(d.gross_amount)}</td><td>{formatCurrency(d.deductions)}</td><td>{formatCurrency(d.net_amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {ts.cis_rate > 0 && (
                                <div className="cis-summary">
                                  <span>CIS Deduction ({ts.cis_rate}%)</span>
                                  <span>Net after CIS: <strong>{formatCurrency(ts.total_amount)}</strong></span>
                                </div>
                              )}
                              <div className="worker-cis-info">
                                <span>Worker CIS: <strong>{ts.profiles?.cis_rate || 20}%</strong></span>
                                <span>{ts.profiles?.cis_verified ? <span className="status-badge status-badge--green">Verified</span> : <span className="status-badge status-badge--amber">Unverified</span>}</span>
                              </div>
                            </div>
                            <div className="detail-panel__actions">
                              <h4>Update Status</h4>
                              <div className="status-btns">
                                {STATUSES.map(s => (
                                  <button key={s} className={`btn btn--sm ${ts.status === s ? 'btn--active' : 'btn--outline'}`} onClick={() => handleStatusChange(ts.id, s)}>
                                    {s === 'approved' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{marginRight:3}}><polyline points="20 6 9 17 4 12" /></svg>}
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                              </div>
                              <textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Admin notes (visible to worker if queried)..." className="form-input" rows={2} />
                              <h4 style={{marginTop:12}}>Send Alert to Worker</h4>
                              <textarea value={alertMessage} onChange={(e) => setAlertMessage(e.target.value)} placeholder="Message to send to worker..." className="form-input" rows={2} />
                              <button className="btn btn--sm btn--primary" style={{marginTop:6}} onClick={() => handleSendAlert(ts)} disabled={sendingAlert || !alertMessage.trim()}>
                                {sendingAlert ? 'Sending...' : 'Send Alert'}
                              </button>
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

          <div className="admin-cards-mobile">
            {filtered.map(ts => (
              <div key={ts.id} className="timesheet-card timesheet-card--admin" onClick={() => handleExpand(ts)}>
                <div className="timesheet-card__top"><strong>{ts.profiles?.full_name}</strong><StatusPill status={ts.status} /></div>
                <div className="timesheet-card__details">
                  <span>{formatDate(ts.week_ending)} &mdash; {ts.sites?.site_name}</span>
                  <PaymentPill method={ts.payment_method} />
                </div>
                <div className="timesheet-card__bottom">
                  <span className="timesheet-card__amount">{formatCurrency(ts.total_amount)}</span>
                  {ts.cis_rate > 0 && <span className="pill" style={{background:'#fef3c7',color:'#92400e',borderColor:'#fde68a',fontSize:'0.7rem'}}>{ts.cis_rate}% CIS</span>}
                  <button className="btn btn--sm btn--outline" onClick={(e) => { e.stopPropagation(); handleDownloadPDF(ts); }}>PDF</button>
                </div>
                {expandedId === ts.id && (
                  <div className="timesheet-card__expanded">
                    {expandedDays.map(d => (
                      <div key={d.id} className="timesheet-card__day"><span>{DL[d.day_of_week]}</span><span>{d.start_time||'-'} - {d.end_time||'-'}</span><span>{formatCurrency(d.net_amount)}</span></div>
                    ))}
                    <div className="timesheet-card__status-actions">
                      {STATUSES.filter(s => s !== 'submitted').map(s => (
                        <button key={s} className={`btn btn--sm ${ts.status === s ? 'btn--active' : 'btn--outline'}`} onClick={(e) => { e.stopPropagation(); handleStatusChange(ts.id, s); }}>{STATUS_LABELS[s]}</button>
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
