import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PageHeader, LoadingSpinner } from '../components/ui';

export default function AdminSites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ site_name: '', project_ref: '', site_address: '', city: '', postcode: '', status: 'active' });

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    const { data } = await supabase.from('sites').select('*').order('site_name');
    setSites(data || []);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (editId) {
      await supabase.from('sites').update(form).eq('id', editId);
    } else {
      await supabase.from('sites').insert(form);
    }
    setForm({ site_name: '', project_ref: '', site_address: '', city: '', postcode: '', status: 'active' });
    setShowForm(false);
    setEditId(null);
    fetchSites();
  };

  const handleEdit = (site) => {
    setForm({
      site_name: site.site_name,
      project_ref: site.project_ref || '',
      site_address: site.site_address || '',
      city: site.city || '',
      postcode: site.postcode || '',
      status: site.status,
    });
    setEditId(site.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setForm({ site_name: '', project_ref: '', site_address: '', city: '', postcode: '', status: 'active' });
    setShowForm(false);
    setEditId(null);
  };

  const handleDelete = async (site) => {
    if (!confirm(`Delete site "${site.site_name}"?\n\nAny timesheets linked to this site will keep their data but the site reference will be removed. This cannot be undone.`)) return;
    await supabase.from('sites').delete().eq('id', site.id);
    fetchSites();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader
        title="Sites"
        subtitle={`${sites.filter(s => s.status === 'active').length} active sites`}
        actions={
          !showForm && (
            <button className="btn btn--sm btn--primary" onClick={() => setShowForm(true)}>
              + Add Site
            </button>
          )
        }
      />

      {showForm && (
        <form onSubmit={handleSave} className="form-section form-section--bordered">
          <h3 className="form-section__title">{editId ? 'Edit Site' : 'Add New Site'}</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Site Name <span className="required">*</span></label>
              <input type="text" value={form.site_name} onChange={(e) => setForm(f => ({ ...f, site_name: e.target.value }))} className="form-input" required />
            </div>
            <div className="form-group">
              <label className="form-label">Project Reference <span className="required">*</span></label>
              <input type="text" value={form.project_ref} onChange={(e) => setForm(f => ({ ...f, project_ref: e.target.value }))} className="form-input" placeholder="e.g. PRJ-2026-001" required />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input type="text" value={form.site_address} onChange={(e) => setForm(f => ({ ...f, site_address: e.target.value }))} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input type="text" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Postcode</label>
              <input type="text" value={form.postcode} onChange={(e) => setForm(f => ({ ...f, postcode: e.target.value }))} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="form-input">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary">{editId ? 'Update' : 'Add'} Site</button>
            <button type="button" className="btn btn--outline" onClick={handleCancel}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card-list">
        {sites.map(site => (
          <div key={site.id} className={`site-card ${site.status !== 'active' ? 'site-card--inactive' : ''}`}>
            <div className="site-card__top">
              <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <strong>{site.site_name}</strong>
                  {site.project_ref && <span className="week-tag">{site.project_ref}</span>}
                </div>
                <span className="text-muted text-sm">
                  {[site.site_address, site.city, site.postcode].filter(Boolean).join(', ')}
                </span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <span className={`status-badge ${site.status === 'active' ? 'status-badge--green' : site.status === 'completed' ? 'status-badge--blue' : 'status-badge--grey'}`}>
                  {site.status}
                </span>
                <button className="btn btn--sm btn--outline" onClick={() => handleEdit(site)}>Edit</button>
                <button className="btn btn--sm btn--danger" onClick={() => handleDelete(site)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
