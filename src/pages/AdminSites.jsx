import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PageHeader, LoadingSpinner } from '../components/ui';

export default function AdminSites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ site_name: '', site_address: '', city: '', postcode: '', status: 'active' });

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
    setForm({ site_name: '', site_address: '', city: '', postcode: '', status: 'active' });
    setShowForm(false);
    setEditId(null);
    fetchSites();
  };

  const handleEdit = (site) => {
    setForm({
      site_name: site.site_name,
      site_address: site.site_address || '',
      city: site.city || '',
      postcode: site.postcode || '',
      status: site.status,
    });
    setEditId(site.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setForm({ site_name: '', site_address: '', city: '', postcode: '', status: 'active' });
    setShowForm(false);
    setEditId(null);
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
              <label className="form-label">Site Name *</label>
              <input type="text" value={form.site_name} onChange={(e) => setForm(f => ({ ...f, site_name: e.target.value }))} className="form-input" required />
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
                <strong>{site.site_name}</strong>
                <span className="text-muted text-sm">
                  {[site.site_address, site.city, site.postcode].filter(Boolean).join(', ')}
                </span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <span className={`status-badge ${site.status === 'active' ? 'status-badge--green' : site.status === 'completed' ? 'status-badge--blue' : 'status-badge--grey'}`}>
                  {site.status}
                </span>
                <button className="btn btn--sm btn--outline" onClick={() => handleEdit(site)}>Edit</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
