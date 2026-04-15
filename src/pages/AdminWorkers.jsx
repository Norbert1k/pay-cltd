import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '../components/ui';

export default function AdminWorkers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'worker')
      .order('full_name');

    // Get last submission for each worker
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
      setWorkers(enriched);
    }
    setLoading(false);
  };

  const toggleStatus = async (worker) => {
    const newStatus = worker.status === 'active' ? 'inactive' : 'active';
    await supabase.from('profiles').update({ status: newStatus }).eq('id', worker.id);
    fetchWorkers();
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Trade', 'NI', 'UTR', 'Sort Code', 'Account Number', 'Status', 'Payment Complete', 'Last Submission'];
    const rows = workers.map(w => [
      w.full_name, w.email, w.phone || '', w.trade || '',
      w.national_insurance || '', w.utr_number || '',
      w.sort_code || '', w.account_number || '',
      w.status, w.payment_info_complete ? 'Yes' : 'No',
      w.lastSubmission || 'Never',
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = workers.filter(w => {
    if (!search) return true;
    const q = search.toLowerCase();
    return w.full_name?.toLowerCase().includes(q) ||
           w.email?.toLowerCase().includes(q) ||
           w.trade?.toLowerCase().includes(q);
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader
        title="Workers"
        subtitle={`${workers.filter(w => w.status === 'active').length} active, ${workers.filter(w => w.status === 'inactive').length} inactive`}
        actions={
          <button className="btn btn--sm btn--outline" onClick={handleExportCSV}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        }
      />

      <div className="filters">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input form-input--sm"
          placeholder="Search by name, email, or trade..."
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No workers found" message="No workers match your search." />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Trade</th>
                  <th>NI</th>
                  <th>CIS</th>
                  <th>Status</th>
                  <th>Payment Info</th>
                  <th>Last Submission</th>
                  <th>Actions</th>
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
                    <td>{w.national_insurance || '-'}</td>
                    <td>
                      {w.cis_verified ? (
                        <span className="status-badge status-badge--green">{w.cis_rate}%</span>
                      ) : (
                        <span className="status-badge status-badge--amber">Unverified</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${w.status === 'active' ? 'status-badge--green' : 'status-badge--grey'}`}>
                        {w.status}
                      </span>
                    </td>
                    <td>
                      {w.payment_info_complete ? (
                        <span className="status-badge status-badge--green">Complete</span>
                      ) : (
                        <span className="status-badge status-badge--amber">Incomplete</span>
                      )}
                    </td>
                    <td>{w.lastSubmission ? formatDate(w.lastSubmission) : 'Never'}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn--sm btn--outline" onClick={() => navigate(`/admin/workers/${w.id}`)}>View</button>
                        <button
                          className={`btn btn--sm ${w.status === 'active' ? 'btn--outline-red' : 'btn--green'}`}
                          onClick={() => toggleStatus(w)}
                        >
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
                  <span className={`status-badge ${w.status === 'active' ? 'status-badge--green' : 'status-badge--grey'}`}>
                    {w.status}
                  </span>
                </div>
                <div className="worker-card__details">
                  <span>Payment: {w.payment_info_complete ? 'Complete' : 'Incomplete'}</span>
                  <span>Last: {w.lastSubmission ? formatDate(w.lastSubmission) : 'Never'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
