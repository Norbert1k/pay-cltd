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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const initialExpanded = useRef(false);

  useEffect(() => { fetchWorker(); }, [id]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be under 5MB');
      return;
    }

    setUploadingPhoto(true);
    setPhotoError('');

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      await supabase.from('profiles').update({ profile_picture_url: publicUrl }).eq('id', id);
      fetchWorker();
    } catch (err) {
      setPhotoError('Upload failed: ' + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Remove profile photo?')) return;
    await supabase.from('profiles').update({ profile_picture_url: null }).eq('id', id);
    fetchWorker();
  };

  const handleGenerateIdCard = () => {
    const workerId = `CLTD-${worker.id.substring(0, 8).toUpperCase()}`;
    const issueDate = new Date().toLocaleDateString('en-GB');
    const expiryDate = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toLocaleDateString('en-GB');

    const cardHtml = `<!DOCTYPE html>
<html>
<head>
<title>ID Card — ${worker.full_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: #e5e5e5;
    padding: 40px 20px;
    min-height: 100vh;
  }
  .page-header {
    max-width: 850px;
    margin: 0 auto 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .page-header h1 { font-size: 1.25rem; color: #111; }
  .print-btn {
    background: #448a40;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }
  .print-btn:hover { background: #2d6329; }
  .cards-wrap {
    display: flex;
    gap: 30px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .id-card {
    width: 340px;
    height: 215px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    overflow: hidden;
    position: relative;
    color: #111;
  }
  /* FRONT */
  .id-card--front { background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%); }
  .id-card__strip {
    height: 36px;
    background: linear-gradient(90deg, #448a40 0%, #2d6329 100%);
    display: flex;
    align-items: center;
    padding: 0 14px;
    color: white;
  }
  .id-card__strip img { height: 20px; margin-right: 10px; filter: brightness(0) invert(1); }
  .id-card__strip-text {
    font-family: 'Fahkwang', sans-serif;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .id-card__body {
    display: flex;
    padding: 14px;
    gap: 14px;
    height: calc(100% - 36px);
  }
  .id-card__photo {
    width: 90px;
    height: 115px;
    border-radius: 6px;
    background: #f0f0f0;
    border: 2px solid #ddd;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .id-card__photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .id-card__photo-placeholder {
    font-size: 2rem;
    font-weight: 700;
    color: #999;
    font-family: 'Fahkwang', sans-serif;
  }
  .id-card__info {
    flex: 1;
    min-width: 0;
    padding-top: 2px;
  }
  .id-card__name {
    font-family: 'Fahkwang', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.15;
    color: #111;
    margin-bottom: 3px;
    word-wrap: break-word;
  }
  .id-card__role {
    font-size: 0.78rem;
    color: #448a40;
    font-weight: 600;
    margin-bottom: 10px;
  }
  .id-card__detail {
    font-size: 0.68rem;
    color: #666;
    margin-bottom: 2px;
  }
  .id-card__detail strong { color: #111; letter-spacing: 0.3px; }

  /* BACK */
  .id-card--back { background: #1a1a1a; color: white; }
  .id-card__back-header {
    padding: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.15);
  }
  .id-card__back-header h2 {
    font-family: 'Fahkwang', sans-serif;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6bbd66;
  }
  .id-card__back-body {
    padding: 12px 14px;
    font-size: 0.7rem;
    line-height: 1.5;
  }
  .id-card__back-body p { margin-bottom: 6px; opacity: 0.85; }
  .id-card__back-footer {
    position: absolute;
    bottom: 12px;
    left: 14px;
    right: 14px;
    display: flex;
    justify-content: space-between;
    font-size: 0.6rem;
    opacity: 0.5;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  @media print {
    body { background: white; padding: 0; }
    .page-header { display: none; }
    .cards-wrap { gap: 20px; padding: 20px; }
    .id-card { box-shadow: none; border: 1px solid #ddd; }
  }
</style>
</head>
<body>
  <div class="page-header">
    <h1>ID Card — ${worker.full_name}</h1>
    <button class="print-btn" onclick="window.print()">🖨️ Print</button>
  </div>

  <div class="cards-wrap">
    <!-- FRONT -->
    <div class="id-card id-card--front">
      <div class="id-card__strip">
        <span class="id-card__strip-text">City Construction Ltd</span>
      </div>
      <div class="id-card__body">
        <div class="id-card__photo">
          ${worker.profile_picture_url
            ? `<img src="${worker.profile_picture_url}" alt="${worker.full_name}" />`
            : `<div class="id-card__photo-placeholder">${(worker.full_name || '?').charAt(0).toUpperCase()}</div>`
          }
        </div>
        <div class="id-card__info">
          <div class="id-card__name">${worker.full_name || 'Unknown'}</div>
          <div class="id-card__role">${worker.trade || 'Worker'}</div>
          <div class="id-card__detail"><strong>ID:</strong> ${workerId}</div>
          ${worker.national_insurance ? `<div class="id-card__detail"><strong>NI:</strong> ${worker.national_insurance}</div>` : ''}
          <div class="id-card__detail"><strong>Issued:</strong> ${issueDate}</div>
          <div class="id-card__detail"><strong>Valid until:</strong> ${expiryDate}</div>
        </div>
      </div>
    </div>

    <!-- BACK -->
    <div class="id-card id-card--back">
      <div class="id-card__back-header">
        <h2>City Construction</h2>
      </div>
      <div class="id-card__back-body">
        <p>This card remains the property of City Construction Ltd.</p>
        <p>If found, please return to:</p>
        <p style="opacity:1; color:#6bbd66; font-weight:600;">City Construction Ltd<br>office@cltd.co.uk</p>
        <p style="margin-top:8px;">The holder of this card is authorised personnel working on behalf of City Construction Ltd.</p>
      </div>
      <div class="id-card__back-footer">
        <span>${workerId}</span>
        <span>cltd.co.uk</span>
      </div>
    </div>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(cardHtml);
      w.document.close();
    } else {
      alert('Please allow pop-ups to generate the ID card.');
    }
  };

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

  const handleDeleteWorker = async () => {
    const name = worker.full_name || 'this worker';
    if (!confirm(`Are you sure you want to permanently delete ${name}?\n\nThis will delete:\n• All their timesheets and day entries\n• All their alerts\n• Their profile\n\nThis action cannot be undone.`)) return;
    if (!confirm(`FINAL WARNING: You are about to permanently delete ${name} and all their data. Type YES to confirm.`)) return;

    try {
      // Delete day entries for all their timesheets
      const { data: workerTs } = await supabase.from('timesheets').select('id').eq('worker_id', id);
      if (workerTs && workerTs.length > 0) {
        const tsIds = workerTs.map(t => t.id);
        await supabase.from('timesheet_days').delete().in('timesheet_id', tsIds);
      }
      // Delete timesheets
      await supabase.from('timesheets').delete().eq('worker_id', id);
      // Delete alerts
      await supabase.from('alerts').delete().eq('worker_id', id);
      // Delete profile
      await supabase.from('profiles').delete().eq('id', id);
      // Delete auth user via admin (this may fail without service role — profile deletion is enough)
      navigate('/admin/workers', { state: { deleted: true } });
    } catch (err) {
      alert('Error deleting worker: ' + err.message);
    }
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

  const [resending, setResending] = useState(false);

  const handleResendPassword = async () => {
    if (!worker.email) return;
    setResending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(worker.email, {
      redirectTo: window.location.origin + '/login?reset=true',
    });
    if (error) {
      alert('Failed to send: ' + error.message);
    } else {
      alert(`Password reset link sent to ${worker.email}`);
    }
    setResending(false);
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
            <button className="btn btn--sm btn--primary" onClick={handleGenerateIdCard}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" />
                <path d="M15 8h2M15 12h2M7 15h10" />
              </svg>
              ID Card
            </button>
            <button className="btn btn--sm btn--outline" onClick={handleResendPassword} disabled={resending}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {resending ? 'Sending...' : 'Resend Password'}
            </button>
            <button className={`btn btn--sm ${worker.status === 'active' ? 'btn--outline-red' : 'btn--green'}`} onClick={toggleStatus}>
              {worker.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
            {['admin', 'director'].includes(adminProfile?.role) && (
              <button className="btn btn--sm btn--danger" onClick={handleDeleteWorker}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete
              </button>
            )}
          </div>
        }
      />

      {/* Profile Photo */}
      <div className="photo-section">
        <div className="photo-section__avatar">
          {worker.profile_picture_url ? (
            <img src={worker.profile_picture_url} alt={worker.full_name} />
          ) : (
            <div className="photo-section__placeholder">
              {worker.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="photo-section__info">
          <h4>Profile Photo</h4>
          <p className="text-muted text-sm">Photo will appear on worker's profile and ID card. PNG/JPG under 5MB.</p>
          {photoError && <p className="text-red text-sm" style={{marginTop: 4}}>{photoError}</p>}
          <div className="photo-section__actions">
            <label className="btn btn--sm btn--primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {uploadingPhoto ? 'Uploading...' : worker.profile_picture_url ? 'Change Photo' : 'Upload Photo'}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                style={{display: 'none'}}
              />
            </label>
            {worker.profile_picture_url && (
              <button className="btn btn--sm btn--outline-red" onClick={handleRemovePhoto}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

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
            ) : worker.national_insurance && worker.utr_number && worker.sort_code && worker.account_number && worker.account_name ? (
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
