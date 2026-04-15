import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate, formatCurrency, TRADES } from '../lib/utils';
import { PageHeader, StatusPill, PaymentPill, LoadingSpinner } from '../components/ui';
import { generateTimesheetPDF } from '../components/TimesheetPDF';

export default function AdminWorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

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
              <div className="role-selector">
                <button className={`btn btn--sm ${worker.role === 'worker' ? 'btn--active' : 'btn--outline'}`} onClick={() => handleRoleChange('worker')}>Worker</button>
                <button className={`btn btn--sm ${worker.role === 'admin' ? 'btn--active' : 'btn--outline'}`} onClick={() => handleRoleChange('admin')}>Admin</button>
              </div>
            </div>
            <div className="detail-item"><span>Total Timesheets</span><strong>{timesheets.length}</strong></div>
            <div className="detail-item"><span>Total Paid</span><strong className="text-green">{formatCurrency(totalPaid)}</strong></div>
            <div className="detail-item"><span>Member Since</span><strong>{formatDate(worker.created_at?.split('T')[0])}</strong></div>
          </div>
        </div>
      </div>

      {/* Timesheet History */}
      <div className="section">
        <h3 className="section__title">Submission History</h3>
        {timesheets.length === 0 ? (
          <p className="text-muted">No timesheets submitted.</p>
        ) : (
          <div className="card-list">
            {timesheets.map(ts => (
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
                  <button className="btn btn--sm btn--outline" onClick={() => handleDownloadPDF(ts)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
