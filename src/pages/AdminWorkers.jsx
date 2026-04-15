import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDate, ROLES, ROLE_LIST, TRADES } from '../lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '../components/ui';

export default function AdminWorkers() {
  const { profile: adminProfile } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', trade: '', role: 'worker' });
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    // All users (not just workers)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (data) {
      const enriched = await Promise.all(data.map(async (w) => {
        const { data: lastTs } = await supabase
          .from('timesheets')
          .select('week_ending')
          .eq('worker_id', w.id)
          .order('week_ending', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ...w, lastSubmission: lastTs?.week_ending };
      }));

      // Split pending vs approved
      setPendingUsers(enriched.filter(w => w.approval_status === 'pending'));
      setWorkers(enriched.filter(w => w.approval_status !== 'pending'));
    }
    setLoading(false);
  };

  const toggleStatus = async (worker) => {
    const newStatus = worker.status === 'active' ? 'inactive' : 'active';
    await supabase.from('profiles').update({ status: newStatus }).eq('id', worker.id);
    fetchAll();
  };

  const approveUser = async (userId) => {
    await supabase.from('profiles').update({
      approval_status: 'approved',
      approved_by: adminProfile.id,
      approved_at: new Date().toISOString(),
    }).eq('id', userId);

    // Create alert for user
    await supabase.from('alerts').insert({
      worker_id: userId,
      type: 'general',
      title: 'Account Approved',
      message: 'Your account has been approved. You can now log in and submit timesheets.',
      created_by: adminProfile.id,
    });

    fetchAll();
  };

  const rejectUser = async (userId) => {
    await supabase.from('profiles').update({
      approval_status: 'rejected',
      approved_by: adminProfile.id,
      approved_at: new Date().toISOString(),
      status: 'inactive',
    }).eq('id', userId);
    fetchAll();
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setInviting(true);
    setInviteMessage('');

    try {
      // Use Supabase admin invite (sends magic link email)
      // Since we're on the client, we'll use signUp with a random password
      // then immediately send a password reset email
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'A1!';

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: inviteForm.email,
        password: tempPassword,
        options: {
          data: {
            full_name: inviteForm.full_name,
            trade: inviteForm.trade,
          },
        },
      });

      if (signUpError) {
        setInviteMessage('Error: ' + signUpError.message);
        setInviting(false);
        return;
      }

      // Update the profile with the correct role and auto-approve
      if (signUpData?.user?.id) {
        // Small delay to ensure trigger has created the profile
        await new Promise(r => setTimeout(r, 1000));

        await supabase.from('profiles').update({
          role: inviteForm.role,
          approval_status: 'approved',
          approved_by: adminProfile.id,
          approved_at: new Date().toISOString(),
          invited_by: adminProfile.id,
        }).eq('id', signUpData.user.id);
      }

      // Send password reset so the user can set their own password
      await supabase.auth.resetPasswordForEmail(inviteForm.email, {
        redirectTo: window.location.origin + '/login',
      });

      setInviteMessage(`Invite sent to ${inviteForm.email}. They'll receive an email to set their password.`);
      setInviteForm({ email: '', full_name: '', trade: '', role: 'worker' });
      setShowInvite(false);
      fetchAll();
    } catch (err) {
      setInviteMessage('Error: ' + err.message);
    }
    setInviting(false);
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Trade', 'Role', 'NI', 'UTR', 'Status', 'CIS Rate', 'CIS Verified', 'Last Submission'];
    const rows = workers.map(w => [
      w.full_name, w.email, w.phone || '', w.trade || '', ROLES[w.role] || w.role,
      w.national_insurance || '', w.utr_number || '',
      w.status, w.cis_rate || '20', w.cis_verified ? 'Yes' : 'No',
      w.lastSubmission || 'Never',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'workers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = workers.filter(w => {
    if (!search) return true;
    const q = search.toLowerCase();
    return w.full_name?.toLowerCase().includes(q) || w.email?.toLowerCase().includes(q) || w.trade?.toLowerCase().includes(q);
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader
        title="User Management"
        subtitle={`${workers.filter(w => w.status === 'active').length} active, ${pendingUsers.length} pending approval`}
        actions={
          <div className="action-btns">
            <button className="btn btn--sm btn--primary" onClick={() => setShowInvite(!showInvite)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Invite User
            </button>
            <button className="btn btn--sm btn--outline" onClick={handleExportCSV}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>
        }
      />

      {/* Invite Message */}
      {inviteMessage && (
        <div className={`alert ${inviteMessage.startsWith('Error') ? 'alert--warning' : 'alert--success'}`}>
          <div><strong>{inviteMessage}</strong></div>
        </div>
      )}

      {/* Invite User Form */}
      {showInvite && (
        <form onSubmit={handleInviteUser} className="form-section form-section--bordered">
          <h3 className="form-section__title">Invite New User</h3>
          <p className="form-section__help">They'll receive an email to set their password and access the system.</p>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input type="text" value={inviteForm.full_name} onChange={(e) => setInviteForm(f => ({...f, full_name: e.target.value}))} className="form-input" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm(f => ({...f, email: e.target.value}))} className="form-input" required />
            </div>
            <div className="form-group">
              <label className="form-label">Trade / Role</label>
              <select value={inviteForm.trade} onChange={(e) => setInviteForm(f => ({...f, trade: e.target.value}))} className="form-input">
                <option value="">Select trade...</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">System Role</label>
              <select value={inviteForm.role} onChange={(e) => setInviteForm(f => ({...f, role: e.target.value}))} className="form-input">
                {ROLE_LIST.map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={inviting}>
              {inviting ? 'Sending Invite...' : 'Send Invite'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setShowInvite(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Pending Approvals Banner */}
      {pendingUsers.length > 0 && (
        <div className="pending-users-section">
          <h3 className="section__title">
            <span className="query-badge" style={{marginRight: 8}}>{pendingUsers.length}</span>
            New Users — Pending Approval
          </h3>
          <div className="card-list">
            {pendingUsers.map(u => (
              <div key={u.id} className="pending-user-card">
                <div className="pending-user-card__info">
                  <strong>{u.full_name}</strong>
                  <span className="text-muted">{u.email}</span>
                  <span className="text-sm">{u.trade || 'No trade selected'}</span>
                </div>
                <div className="pending-user-card__actions">
                  <button className="btn btn--sm btn--green" onClick={() => approveUser(u.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    Grant Access
                  </button>
                  <button className="btn btn--sm btn--outline-red" onClick={() => rejectUser(u.id)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="filters">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input form-input--sm" placeholder="Search by name, email, or trade..." />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users found" message="No users match your search." />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Trade</th><th>Role</th><th>NI</th><th>CIS</th><th>Status</th><th>Last Submission</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => (
                  <tr key={w.id} className={w.status === 'inactive' ? 'row-inactive' : ''}>
                    <td>
                      <strong>{w.full_name}</strong>
                      <br /><span className="text-muted text-sm">{w.email}</span>
                    </td>
                    <td>{w.trade || '-'}</td>
                    <td>
                      <span className={`role-badge role-badge--${w.role}`}>{ROLES[w.role] || w.role}</span>
                    </td>
                    <td>{w.national_insurance || '-'}</td>
                    <td>
                      {w.cis_verified ?
                        <span className="status-badge status-badge--green">{w.cis_rate}%</span> :
                        <span className="status-badge status-badge--amber">Unverified</span>
                      }
                    </td>
                    <td>
                      <span className={`status-badge ${w.status === 'active' ? 'status-badge--green' : 'status-badge--grey'}`}>{w.status}</span>
                    </td>
                    <td>{w.lastSubmission ? formatDate(w.lastSubmission) : 'Never'}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn--sm btn--outline" onClick={() => navigate(`/admin/workers/${w.id}`)}>View</button>
                        <button className={`btn btn--sm ${w.status === 'active' ? 'btn--outline-red' : 'btn--green'}`} onClick={() => toggleStatus(w)}>
                          {w.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="admin-cards-mobile">
            {filtered.map(w => (
              <div key={w.id} className="worker-card" onClick={() => navigate(`/admin/workers/${w.id}`)}>
                <div className="worker-card__top">
                  <div className="worker-card__avatar">{w.full_name?.charAt(0)?.toUpperCase()}</div>
                  <div>
                    <strong>{w.full_name}</strong>
                    <span className="text-muted text-sm">{w.trade || 'No trade'}</span>
                  </div>
                  <div style={{display:'flex', gap: 4, flexDirection:'column', alignItems:'flex-end'}}>
                    <span className={`role-badge role-badge--${w.role}`}>{ROLES[w.role] || w.role}</span>
                    <span className={`status-badge ${w.status === 'active' ? 'status-badge--green' : 'status-badge--grey'}`}>{w.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
