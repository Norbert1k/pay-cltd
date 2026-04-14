import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getNextSunday, DAYS, formatCurrency } from '../lib/utils';
import { PageHeader, LoadingSpinner } from '../components/ui';
import WeekPicker from '../components/WeekPicker';
import DayRow from '../components/DayRow';

const defaultDayData = () => ({
  active: false,
  start_time: '',
  end_time: '',
  work_type: 'daywork',
  gross_amount: '',
  deductions: '',
  notes: '',
});

export default function SubmitTimesheet() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [weekEnding, setWeekEnding] = useState(getNextSunday());
  const [siteId, setSiteId] = useState('');
  const [approvingManager, setApprovingManager] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('other');
  const [days, setDays] = useState(() => {
    const d = {};
    DAYS.forEach(day => { d[day] = defaultDayData(); });
    return d;
  });
  const [expandedDay, setExpandedDay] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingTimesheet, setExistingTimesheet] = useState(null);
  const [cisEnabled, setCisEnabled] = useState(false);
  const [cisRate, setCisRate] = useState(20);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (profile) checkExisting();
  }, [weekEnding, profile]);

  // Auto-save draft to localStorage
  useEffect(() => {
    const draft = { weekEnding, siteId, approvingManager, paymentMethod, days };
    localStorage.setItem('timesheet_draft', JSON.stringify(draft));
  }, [weekEnding, siteId, approvingManager, paymentMethod, days]);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem('timesheet_draft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.siteId) setSiteId(draft.siteId);
        if (draft.approvingManager) setApprovingManager(draft.approvingManager);
        if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
        if (draft.days) setDays(draft.days);
      } catch (e) {
        // ignore corrupt draft
      }
    }
  }, []);

  const fetchSites = async () => {
    const { data } = await supabase
      .from('sites')
      .select('*')
      .eq('status', 'active')
      .order('site_name');
    setSites(data || []);
    setLoading(false);
  };

  const checkExisting = async () => {
    const { data } = await supabase
      .from('timesheets')
      .select('*, sites(site_name)')
      .eq('worker_id', profile.id)
      .eq('week_ending', weekEnding)
      .single();
    setExistingTimesheet(data);
  };

  const handleDayChange = (day, data) => {
    setDays(prev => ({ ...prev, [day]: data }));
  };

  const totalGross = DAYS.reduce((sum, d) => sum + (parseFloat(days[d].gross_amount) || 0), 0);
  const totalManualDeductions = DAYS.reduce((sum, d) => sum + (parseFloat(days[d].deductions) || 0), 0);
  const cisDeduction = cisEnabled ? (totalGross * cisRate / 100) : 0;
  const totalDeductions = totalManualDeductions + cisDeduction;
  const totalNet = totalGross - totalDeductions;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!siteId) { setError('Please select a site'); return; }

    const activeDays = DAYS.filter(d => days[d].active);
    if (activeDays.length === 0) { setError('Please add at least one day'); return; }

    if (totalNet <= 0) { setError('Total amount must be greater than zero'); return; }

    setSubmitting(true);

    // Insert timesheet
    const { data: ts, error: tsError } = await supabase
      .from('timesheets')
      .insert({
        worker_id: profile.id,
        site_id: siteId,
        week_ending: weekEnding,
        approving_manager: approvingManager,
        payment_method: paymentMethod,
        total_amount: totalNet,
        cis_rate: cisEnabled ? cisRate : null,
      })
      .select()
      .single();

    if (tsError) {
      if (tsError.code === '23505') {
        setError('You have already submitted a timesheet for this week.');
      } else {
        setError(tsError.message);
      }
      setSubmitting(false);
      return;
    }

    // Insert day entries
    const dayRows = activeDays.map(day => ({
      timesheet_id: ts.id,
      day_of_week: day,
      start_time: days[day].start_time || null,
      end_time: days[day].end_time || null,
      work_type: days[day].work_type || 'daywork',
      gross_amount: parseFloat(days[day].gross_amount) || 0,
      deductions: parseFloat(days[day].deductions) || 0,
      net_amount: (parseFloat(days[day].gross_amount) || 0) - (parseFloat(days[day].deductions) || 0),
      notes: days[day].notes || null,
    }));

    const { error: daysError } = await supabase
      .from('timesheet_days')
      .insert(dayRows);

    if (daysError) {
      setError(daysError.message);
      setSubmitting(false);
      return;
    }

    // Clear draft
    localStorage.removeItem('timesheet_draft');

    // Navigate to success / history
    navigate('/timesheets', { state: { submitted: true } });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <PageHeader
        title="Submit Timesheet"
        subtitle="Enter your hours for the week"
      />

      {existingTimesheet && (
        <div className="alert alert--info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Already submitted</strong>
            <p>You&apos;ve already submitted for this week ({existingTimesheet.sites?.site_name} &mdash; {formatCurrency(existingTimesheet.total_amount)}). Choose a different week or view your timesheets.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="timesheet-form">
        {error && <div className="auth-error">{error}</div>}

        {/* Step 1: Header */}
        <div className="form-section">
          <h3 className="form-section__title">Week &amp; Site</h3>
          <WeekPicker value={weekEnding} onChange={setWeekEnding} />

          <div className="form-group">
            <label className="form-label">Site</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="form-input"
              required
            >
              <option value="">Select a site...</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.site_name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Approving Manager</label>
            <input
              type="text"
              value={approvingManager}
              onChange={(e) => setApprovingManager(e.target.value)}
              className="form-input"
              placeholder="Manager name"
            />
          </div>
        </div>

        {/* Step 2: Daily Breakdown */}
        <div className="form-section">
          <h3 className="form-section__title">Daily Breakdown</h3>
          <p className="form-section__help">Tap a day to enter hours and amounts</p>
          <div className="day-rows">
            {DAYS.map(day => (
              <DayRow
                key={day}
                day={day}
                data={days[day]}
                onChange={handleDayChange}
                expanded={expandedDay === day}
                onToggle={() => setExpandedDay(expandedDay === day ? null : day)}
              />
            ))}
          </div>
        </div>

        {/* Step 3: Summary */}
        <div className="form-section">
          <h3 className="form-section__title">Summary</h3>

          {/* CIS Toggle */}
          <div className="cis-toggle">
            <label className="cis-toggle__label">
              <input
                type="checkbox"
                checked={cisEnabled}
                onChange={(e) => setCisEnabled(e.target.checked)}
                className="cis-toggle__checkbox"
              />
              <span className="cis-toggle__switch" />
              <span>Apply CIS Deduction</span>
            </label>
            {cisEnabled && (
              <div className="cis-toggle__rate">
                <select
                  value={cisRate}
                  onChange={(e) => setCisRate(Number(e.target.value))}
                  className="form-input form-input--sm"
                >
                  <option value={20}>20% (Standard)</option>
                  <option value={30}>30% (Higher)</option>
                  <option value={0}>0% (Gross Payment)</option>
                </select>
              </div>
            )}
          </div>

          <div className="summary-row">
            <span>Total Gross</span>
            <strong>{formatCurrency(totalGross)}</strong>
          </div>
          {totalManualDeductions > 0 && (
            <div className="summary-row">
              <span>Other Deductions</span>
              <strong className="text-red">&minus;{formatCurrency(totalManualDeductions)}</strong>
            </div>
          )}
          {cisEnabled && cisDeduction > 0 && (
            <div className="summary-row summary-row--cis">
              <span>CIS Deduction ({cisRate}%)</span>
              <strong className="text-red">&minus;{formatCurrency(cisDeduction)}</strong>
            </div>
          )}
          <div className="summary-row summary-row--total">
            <span>Total Net</span>
            <strong>{formatCurrency(totalNet)}</strong>
          </div>
        </div>

        {/* Step 4: Payment Method */}
        <div className="form-section">
          <h3 className="form-section__title">Payment Method</h3>
          <div className="payment-options">
            <label
              className={`payment-card ${paymentMethod === 'card' ? 'payment-card--selected' : ''} ${!profile?.payment_info_complete ? 'payment-card--disabled' : ''}`}
            >
              <input
                type="radio"
                name="payment"
                value="card"
                checked={paymentMethod === 'card'}
                onChange={() => setPaymentMethod('card')}
                disabled={!profile?.payment_info_complete}
              />
              <div className="payment-card__content">
                <div className="payment-card__icon payment-card__icon--card">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <div>
                  <strong>Pay by Card</strong>
                  {profile?.payment_info_complete ? (
                    <p>Sort: {profile.sort_code} &bull; Acc: ****{profile.account_number?.slice(-4)}</p>
                  ) : (
                    <p className="text-muted">Complete your profile to enable</p>
                  )}
                </div>
              </div>
            </label>

            <label
              className={`payment-card ${paymentMethod === 'other' ? 'payment-card--selected payment-card--other' : ''}`}
            >
              <input
                type="radio"
                name="payment"
                value="other"
                checked={paymentMethod === 'other'}
                onChange={() => setPaymentMethod('other')}
              />
              <div className="payment-card__content">
                <div className="payment-card__icon payment-card__icon--other">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                </div>
                <div>
                  <strong>Pay by Other</strong>
                  <p>Cash, bank transfer, or other method</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn btn--primary btn--full btn--large"
          disabled={submitting || !!existingTimesheet}
        >
          {submitting ? 'Submitting...' : 'Submit Timesheet'}
        </button>
      </form>
    </div>
  );
}
