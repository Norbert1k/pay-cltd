import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { TRADES } from '../lib/utils';
import { PageHeader, LoadingSpinner } from '../components/ui';

export default function MyProfile() {
  const { profile, fetchProfile } = useAuth();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        address_line_1: profile.address_line_1 || '',
        address_line_2: profile.address_line_2 || '',
        city: profile.city || '',
        postcode: profile.postcode || '',
        national_insurance: profile.national_insurance || '',
        utr_number: profile.utr_number || '',
        sort_code: profile.sort_code || '',
        account_number: profile.account_number || '',
        account_name: profile.account_name || '',
        trade: profile.trade || '',
      });
    }
  }, [profile]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update(form)
      .eq('id', profile.id);

    if (error) {
      setError(error.message);
    } else {
      await fetchProfile(profile.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  if (!profile) return (
    <div className="page">
      <PageHeader title="My Profile" subtitle="Manage your personal and payment details" />
      <LoadingSpinner />
    </div>
  );

  const paymentComplete = form.sort_code && form.account_number && form.national_insurance && form.utr_number;

  return (
    <div className="page">
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal and payment details"
      />

      {error && <div className="auth-error">{error}</div>}
      {saved && (
        <div className="alert alert--success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <strong>Profile saved successfully</strong>
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Personal Info */}
        <div className="form-section">
          <h3 className="form-section__title">Personal Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input type="text" value={form.full_name} onChange={(e) => handleChange('full_name', e.target.value)} className="form-input" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" value={profile.email} className="form-input" disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className="form-input" placeholder="07xxx xxx xxx" />
            </div>
            <div className="form-group">
              <label className="form-label">Trade / Role *</label>
              <select value={form.trade} onChange={(e) => handleChange('trade', e.target.value)} className="form-input" required>
                <option value="">Select your trade...</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="form-section">
          <h3 className="form-section__title">Address</h3>
          <div className="form-grid">
            <div className="form-group form-group--full">
              <label className="form-label">Address Line 1</label>
              <input type="text" value={form.address_line_1} onChange={(e) => handleChange('address_line_1', e.target.value)} className="form-input" />
            </div>
            <div className="form-group form-group--full">
              <label className="form-label">Address Line 2</label>
              <input type="text" value={form.address_line_2} onChange={(e) => handleChange('address_line_2', e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input type="text" value={form.city} onChange={(e) => handleChange('city', e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Postcode</label>
              <input type="text" value={form.postcode} onChange={(e) => handleChange('postcode', e.target.value)} className="form-input" />
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="form-section">
          <h3 className="form-section__title">
            Payment Details
            {profile?.payment_details_verified ? (
              <span className="form-section__badge form-section__badge--green">✓ Verified</span>
            ) : paymentComplete ? (
              <span className="form-section__badge form-section__badge--amber">Pending Verification</span>
            ) : (
              <span className="form-section__badge form-section__badge--amber">Incomplete</span>
            )}
          </h3>
          {!paymentComplete ? (
            <p className="form-section__help">Complete all required fields below. Your details will need verification by the accounts team before you can be paid by bank transfer.</p>
          ) : !profile?.payment_details_verified ? (
            <p className="form-section__help" style={{color: '#BA7517'}}>Your payment details have been saved and are awaiting verification by the accounts team. Until verified, you must use &ldquo;Pay by Other&rdquo; when submitting timesheets.</p>
          ) : (
            <p className="form-section__help" style={{color: 'var(--green)'}}>Your payment details have been verified. You can now use &ldquo;Pay by Bank Transfer&rdquo; on timesheets.</p>
          )}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">National Insurance Number <span className="required">*</span></label>
              <input type="text" value={form.national_insurance} onChange={(e) => handleChange('national_insurance', e.target.value.toUpperCase())} className="form-input" placeholder="AB123456C" />
            </div>
            <div className="form-group">
              <label className="form-label">UTR Number</label>
              <input type="text" value={form.utr_number} onChange={(e) => handleChange('utr_number', e.target.value)} className="form-input" placeholder="10-digit UTR" />
            </div>
            <div className="form-group">
              <label className="form-label">Account Name <span className="required">*</span></label>
              <input type="text" value={form.account_name} onChange={(e) => handleChange('account_name', e.target.value)} className="form-input" placeholder="Name on bank account" />
            </div>
            <div className="form-group">
              <label className="form-label">Sort Code <span className="required">*</span></label>
              <input type="text" value={form.sort_code} onChange={(e) => handleChange('sort_code', e.target.value)} className="form-input" placeholder="XX-XX-XX" />
            </div>
            <div className="form-group">
              <label className="form-label">Account Number <span className="required">*</span></label>
              <input type="text" value={form.account_number} onChange={(e) => handleChange('account_number', e.target.value)} className="form-input" placeholder="8-digit account number" />
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn--primary btn--full" disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
