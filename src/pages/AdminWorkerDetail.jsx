import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDate, formatCurrency, TRADES } from '../lib/utils';
import { PageHeader, StatusPill, ApprovalPipeline, PaymentPill, LoadingSpinner } from '../components/ui';
import { generateTimesheetPDF } from '../components/TimesheetPDF';

export default function AdminWorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile: adminProfile } = useAuth();
  const [worker, setWorker] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const initialExpanded = useRef(false);

  useEffect(() => { fetchWorker(); }, [id]);

  const fetchWorker = async () => {
    const { data: w } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    setWorker(w);
    const { data: ts } = await supabase
      .from('timesheets')
      .select('*, sites(id, site_name, site_address, city, postcode)')
      .eq('worker_id', id)
      .order('week_ending', { ascending: false });
    setTimesheets(ts || []);
    setLoading(false);
  };

  const toggleStatus = async () => {
    const newStatus = worker.status === 'active' ? 'inactive' : 'active';
    await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
    fetchWorker();
  };

  const handleRoleChange = async (newRole) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', id);
    fetchWorker();
  };

  const handleCisVerify = async (rate) => {
    await supabase.from('profiles').update({ cis_rate: rate, cis_verified: true }).eq('id', id);
    fetchWorker();
  };

  const handleCisUnverify = async () => {
    await supabase.from('profiles').update({ cis_verified: false }).eq('id', id);
    fetchWorker();
  };

  const handleVerifyPayment = async () => {
    await supabase.from('profiles').update({
      payment_details_verified: true,
      payment_verified_by: adminProfile.id,
      payment_verified_at: new Date().toISOString(),
    }).eq('id', id);

    // Alert the worker
    await supabase.from('alerts').insert({
      worker_id: id,
      type: 'general',
      title: 'Payment Details Verified',
      message: 'Your payment details have been verified. You can now use "Pay by Bank Transfer" when submitting timesheets.',
      created_by: adminProfile.id,
    });

    fetchWorker();
  };

  const handleUnverifyPayment = async () => {
    await supabase.from('profiles').update({
      payment_details_verified: false,
    }).eq('id', id);
    fetchWorker();
  };

  const handleDownloadPDF = async (ts) => {
    const { data: days } = await supabase.from('timesheet_days').select('*').eq('timesheet_id', ts.id);
    generateTimesheetPDF(ts, worker, ts.sites, days || []);
  };

  const totalPaid = timesheets
    .filter(t => t.status === 'paid')
    .reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);

  if (loading) return <LoadingSpinner />;
  if (!worker) return <p>Worker not found.</p>;

  return (
    <div className="page">
      <PageHeader
        title={worker.full_name}
        subtitle={worker.trade || 'Worker'}
        actions={
          <div className="action-btns">
            <button className="btn btn--sm btn--outline" onClick={() => navigate('/admin/workers')}>&larr; Back</button>
            <button className={`btn btn--sm ${worker.status === 'active' ? 'btn--outline-red' : 'btn--green'}`} onClick={toggleStatus}>
              {worker.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        }
      />

      <div className="detail-grid">
        {/* Personal Details */}
        <div className="detail-section">
          <h3 className="detail-section__title">Personal Details</h3>
          <div className="detail-list">
            <div className="detail-item"><span>Email</span><strong>{worker.email}</strong></div>
            <div className="detail-item"><span>Phone</span><strong>{worker.phone || '-'}</strong></div>
            <div className="detail-item"><span>Trade</span><strong>{worker.trade || '-'}</strong></div>
            <div className="detail-item"><span>Address</span><strong>{[worker.address_line_1, worker.address_line_2, worker.city, worker.postcode].filter(Boolean).join(', ') || '-'}</strong></div>
            <div className="detail-item">
              <span>Status</span>
              <span className={`status-badge ${worker.status === 'active' ? 'status-badge--green' : 'status-badge--grey'}`}>{worker.status}</span>
            </div>
          </div>
        </div>

        {/* Payment & CIS Details */}
        <div className="detail-section">
          <h3 className="detail-section__title">Payment &amp; CIS</h3>
          <div className="detail-list">
            <div className="detail-item"><span>NI Number</span><strong>{worker.national_insurance || '-'}</strong></div>
            <div className="detail-item"><span>UTR</span><strong>{worker.utr_number || '-'}</strong></div>
            <div className="detail-item"><span>Sort Code</span><strong>{worker.sort_code || '-'}</strong></div>
            <div className="detail-item"><span>Account Number</span><strong>{worker.account_number || '-'}</strong></div>
            <div className="detail-item"><span>Account Name</span><strong>{worker.account_name || '-'}</strong></div>
            <div className="detail-item">
              <span>Payment Info</span>
              {worker.payment_info_complete ?
                <span className="status-badge status-badge--green">Complete</span> :
                <span className="status-badge status-badge--amber">Incomplete</span>
              }
            </div>
          </div>

          {/* Bank Transfer Verification */}
          <div className="cis-verify-section">
            <h4>Bank Transfer Verification</h4>
            {worker.payment_details_verified ? (
              <div className="cis-verify-status cis-verify-status--verified">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Verified — can pay by Bank Transfer</span>
                <button className="btn btn--sm btn--outline" onClick={handleUnverifyPayment}>Unverify</button>
              </div>
            ) : worker.national_insurance && worker.sort_code && worker.account_number && worker.account_name ? (
              <div className="cis-verify-status cis-verify-status--unverified">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                <span>Payment details complete — awaiting verification</span>
                <button className="btn btn--sm btn--green" onClick={handleVerifyPayment}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  Verify
                </button>
              </div>
            ) : (
              <div className="cis-verify-status cis-verify-status--unverified">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Cannot verify — worker has not completed payment details yet</span>
              </div>
            )}
          </div>

          {/* CIS Verification */}
          <div className="cis-verify-section">
            <h4>CIS Rate Verification</h4>
            {worker.cis_verified ? (
              <div className="cis-verify-status cis-verify-status--verified">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Verified at <strong>{worker.cis_rate}%</strong></span>
                <button className="btn btn--sm btn--outline" onClick={handleCisUnverify}>Unverify</button>
              </div>
            ) : (
              <div className="cis-verify-status cis-verify-status--unverified">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Not verified — confirm CIS rate:</span>
              </div>
            )}
            <div className="cis-verify-buttons">
              <button className={`btn btn--sm ${worker.cis_verified && worker.cis_rate === 20 ? 'btn--active' : 'btn--outline'}`} onClick={() => handleCisVerify(20)}>
                Verify 20% (Standard)
              </button>
              <button className={`btn btn--sm ${worker.cis_verified && worker.cis_rate === 30 ? 'btn--active' : 'btn--outline'}`} onClick={() => handleCisVerify(30)}>
                Verify 30% (Higher)
              </button>
              <button className={`btn btn--sm ${worker.cis_verified && worker.cis_rate === 0 ? 'btn--active' : 'btn--outline'}`} onClick={() => handleCisVerify(0)}>
                Verify 0% (Gross)
              </button>
            </div>
          </div>
        </div>

        {/* Role & Access Management */}
        <div className="detail-section">
          <h3 className="detail-section__title">Access &amp; Summary</h3>
          <div className="detail-list">
            <div className="detail-item">
              <span>Role</span>
              <select
                value={worker.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="form-input form-input--sm role-dropdown"
              >
                <option value="worker">Worker</option>
                <option value="accountant">Accountant</option>
                <option value="director">Director</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="detail-item">
              <span>Account Status</span>
              {worker.approval_status === 'pending' ? (
                <span className="status-badge status-badge--amber">Pending Approval</span>
              ) : worker.approval_status === 'approved' ? (
                <span className="status-badge status-badge--green">Approved</span>
              ) : (
                <span className="status-badge status-badge--grey">Rejected</span>
              )}
            </div>
            <div className="detail-item"><span>Total Timesheets</span><strong>{timesheets.length}</strong></div>
            <div className="detail-item"><span>Total Paid</span><strong className="text-green">{formatCurrency(totalPaid)}</strong></div>
            <div className="detail-item"><span>Member Since</span><strong>{formatDate(worker.created_at?.split('T')[0])}</strong></div>
          </div>
        </div>
      </div>

      {/* Timesheet History */}
      <TimesheetHistory
        timesheets={timesheets}
        expandedMonths={expandedMonths}
        setExpandedMonths={setExpandedMonths}
        initialExpanded={initialExpanded}
        onDownloadPDF={handleDownloadPDF}
      />
    </div>
  );
}

function TimesheetHistory({ timesheets, expandedMonths, setExpandedMonths, initialExpanded, onDownloadPDF }) {
  const groupedByMonth = useMemo(() => {
    const groups = {};
    timesheets.forEach(ts => {
      const d = new Date(ts.week_ending + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { label, timesheets: [], total: 0 };
      groups[key].timesheets.push(ts);
      groups[key].total += parseFloat(ts.total_amount || 0);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [timesheets]);

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

  return (
    <div className="section">
      <h3 className="section__title">Submission History</h3>
      {timesheets.length === 0 ? (
        <p className="text-muted">No timesheets submitted.</p>
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
                          <button className="btn btn--sm btn--outline" onClick={() => onDownloadPDF(ts)}>
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
