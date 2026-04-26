import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { PageHeader, LoadingSpinner } from '../components/ui';

export default function AdminPaymentDates() {
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ payment_date: '', cutoff_date: '', label: '' });

  useEffect(() => { fetchDates(); }, []);

  const fetchDates = async () => {
    const { data } = await supabase.from('payment_dates').select('*').order('payment_date', { ascending: true });
    setDates(data || []);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await supabase.from('payment_dates').insert(form);
    setForm({ payment_date: '', cutoff_date: '', label: '' });
    setShowForm(false);
    fetchDates();
  };

  const handleDelete = async (id) => {
    await supabase.from('payment_dates').delete().eq('id', id);
    fetchDates();
  };

  // Auto-calculate cutoff (2 days before payment)
  const handlePaymentDateChange = (val) => {
    const d = new Date(val + 'T00:00:00');
    const cutoff = new Date(d);
    cutoff.setDate(cutoff.getDate() - 2);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    setForm({ payment_date: val, cutoff_date: cutoffStr, label });
  };

  const today = new Date().toISOString().split('T')[0];
  const upcoming = dates.filter(d => d.payment_date >= today);
  const past = dates.filter(d => d.payment_date < today);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader
        title="Payment Dates"
        subtitle="Manage payment schedule — workers see the next payment date on their dashboard"
        actions={!showForm && <button className="btn btn--sm btn--primary" onClick={() => setShowForm(true)}>+ Add Date</button>}
      />

      {showForm && (
        <form onSubmit={handleSave} className="form-section form-section--bordered">
          <h3 className="form-section__title">Add Payment Date</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Payment Date *</label>
              <input type="date" value={form.payment_date} onChange={(e) => handlePaymentDateChange(e.target.value)} className="form-input" required />
            </div>
            <div className="form-group">
              <label className="form-label">Cutoff Date (submit by)</label>
              <input type="date" value={form.cutoff_date} onChange={(e) => setForm(f => ({ ...f, cutoff_date: e.target.value }))} className="form-input" required />
              <span className="text-muted text-sm">Auto-set to 2 days before payment</span>
            </div>
            <div className="form-group form-group--full">
              <label className="form-label">Label</label>
              <input type="text" value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} className="form-input" placeholder="e.g. Friday 17 April" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary">Add</button>
            <button type="button" className="btn btn--outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="section">
        <h3 className="section__title">Upcoming Payments</h3>
        {upcoming.length === 0 ? <p className="text-muted">No upcoming payment dates. Add one above.</p> : (
          <div className="card-list">
            {upcoming.map(d => (
              <div key={d.id} className="payment-date-card">
                <div className="payment-date-card__info">
                  <strong>{formatDate(d.payment_date)}</strong>
                  <span className="text-muted">{d.label}</span>
                  <span className="text-sm">Cutoff: {formatDate(d.cutoff_date)}</span>
                </div>
                <button className="btn btn--sm btn--outline-red" onClick={() => handleDelete(d.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="section">
          <h3 className="section__title">Past Payments</h3>
          <div className="card-list">
            {past.map(d => (
              <div key={d.id} className="payment-date-card payment-date-card--past">
                <div className="payment-date-card__info">
                  <strong>{formatDate(d.payment_date)}</strong>
                  <span className="text-muted">{d.label}</span>
                </div>
                <button className="btn btn--sm btn--outline" onClick={() => handleDelete(d.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
