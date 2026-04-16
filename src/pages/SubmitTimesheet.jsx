import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getNextSunday, DAYS, formatCurrency, formatDate } from '../lib/utils';
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [cutoffPassed, setCutoffPassed] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => { fetchSites(); }, []);
  useEffect(() => {
    if (profile) checkExisting();
  }, [weekEnding, profile]);

  const fetchSites = async () => {
    const { data } = await supabase.from('sites').select('*').eq('active', true).order('site_name');
    setSites(data || []);
    setLoading(false);
  };

  const checkExisting = async () => {
    const { data } = await supabase
      .from('timesheets')
      .select('*, sites(site_name)')
      .eq('worker_id', profile.id)
      .eq('week_ending', weekEnding)
      .maybeSingle();
    setExistingTimesheet(data);
    setEditMode(false);
    resetForm();

    if (data) {
      const { data: payDates } = await supabase
        .from('payment_dates')
        .select('*')
        .gte('cutoff_date', data.week_ending)
        .order('cutoff_date', { ascending: true })
        .limit(1);

      if (payDates && payDates[0]) {
        const cutoff = new Date(payDates[0].cutoff_date + 'T23:59:59');
        setCutoffPassed(new Date() > cutoff);
      } else {
        setCutoffPassed(false);
      }
    } else {
      setCutoffPassed(false);
    }
  };

  const resetForm = () => {
    setSiteId('');
    setApprovingManager('');
    setPaymentMethod('other');
    setCisEnabled(false);
    setCisRate(20);
    const d = {};
    DAYS.forEach(day => { d[day] = defaultDayData(); });
    setDays(d);
  };

  // Can edit if: not paid AND (cutoff not passed OR status is queried)
  const canEdit = existingTimesheet
    ? existingTimesheet.status !== 'paid' && (!cutoffPassed || existingTimesheet.status === 'queried')
    : true;

  const loadForEdit = async () => {
    if (!existingTimesheet) return;
    setSiteId(existingTimesheet.site_id);
    setApprovingManager(existingTimesheet.approving_manager || '');
    setPaymentMethod(existingTimesheet.payment_method);
    setCisEnabled(!!existingTimesheet.cis_rate);
    setCisRate(existingTimesheet.cis_rate || 20);

    const { data: existingDays } = await supabase
      .from('timesheet_days')
      .select('*')
      .eq('timesheet_id', existingTimesheet.id);

    const newDays = {};
    DAYS.forEach(day => { newDays[day] = defaultDayData(); });
    (existingDays || []).forEach(d => {
      newDays[d.day_of_week] = {
        active: true,
        start_time: d.start_time || '',
        end_time: d.end_time || '',
        work_type: d.work_type || 'daywork',
        gross_amount: d.gross_amount?.toString() || '',
        deductions: d.deductions?.toString() || '',
        notes: d.notes || '',
      };
    });
    setDays(newDays);
    setEditMode(true);
  };

  const handleDayChange = (day, data) => {
    setDays(prev => ({ ...prev, [day]: data }));
  };

  const totalGross = DAYS.reduce((sum, d) => sum + (parseFloat(days[d].gross_amount) || 0), 0);
  const totalManualDeductions = DAYS.reduce((sum, d) => sum + (parseFloat(days[d].deductions) || 0), 0);
  const cisDeduction = cisEnabled ? (totalGross * cisRate / 100) : 0;
  const totalDeductions = totalManualDeductions + cisDeduction;
  const totalNet = totalGross - totalDeductions;

  // Prevent Enter key from submitting the form (but allow inside textareas)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  const validateForm = () => {
    if (!siteId) return 'Please select a site';

    const activeDays = DAYS.filter(d => days[d].active);
    if (activeDays.length === 0) return 'Please add at least one day';

    for (const day of activeDays) {
      const d = days[day];
      const gross = parseFloat(d.gross_amount) || 0;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      if (gross <= 0) {
        return `${dayLabel} must have a gross amount greater than £0`;
      }
      if (!d.start_time || !d.end_time) {
        return `${dayLabel} needs both a start time and end time`;
      }
    }

    if (totalGross <= 0) return 'Total gross amount must be greater than zero';
    if (totalNet <= 0) return 'Total net amount must be greater than zero (check deductions)';

    return null;
  };

  // Step 1: validate and show confirmation
  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setShowConfirm(true);
  };

  // Step 2: actual submission
  const confirmSubmit = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    setError('');

    const activeDays = DAYS.filter(d => days[d].active);

    try {
      let timesheetId;

      if (existingTimesheet && editMode) {
        const { error: updateError } = await supabase
          .from('timesheets')
          .update({
            site_id: siteId,
            approving_manager: approvingManager,
            payment_method: paymentMethod,
            total_amount: totalNet,
            cis_rate: cisEnabled ? cisRate : null,
            status: 'submitted',
            admin_notes: null,
          })
          .eq('id', existingTimesheet.id);

        if (updateError) throw updateError;
        timesheetId = existingTimesheet.id;

        await supabase.from('timesheet_days').delete().eq('timesheet_id', timesheetId);
      } else {
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
          if (tsError.code === '23505') throw new Error('You have already submitted a timesheet for this week.');
          throw tsError;
        }
        timesheetId = ts.id;
      }

      const dayRows = activeDays.map(day => ({
        timesheet_id: timesheetId,
        day_of_week: day,
        start_time: days[day].start_time || null,
        end_time: days[day].end_time || null,
        work_type: days[day].work_type || 'daywork',
        gross_amount: parseFloat(days[day].gross_amount) || 0,
        deductions: parseFloat(days[day].deductions) || 0,
        net_amount: (parseFloat(days[day].gross_amount) || 0) - (parseFloat(days[day].deductions) || 0),
        notes: days[day].notes || null,
      }));

      const { error: daysError } = await supabase.from('timesheet_days').insert(dayRows);
      if (daysError) throw daysError;

      navigate('/timesheets', { state: { submitted: true } });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  // LOCKED VIEW — cannot edit
  if (existingTimesheet && !editMode && !canEdit) {
    return (
      <div className="page">
        <PageHeader title="Submit Timesheet" subtitle="Enter your hours for the week" />
        <WeekPicker value={weekEnding} onChange={setWeekEnding} />
        <div className="alert alert--info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <div>
            <strong>This timesheet is locked</strong>
            {existingTimesheet.status === 'paid' ? (
              <p>This timesheet has been paid and cannot be edited.</p>
            ) : (
              <p>The submission cutoff has passed for this week. If changes are needed, please contact your admin to query the timesheet.</p>
            )}
            <p style={{marginTop: 8}}>
              {existingTimesheet.sites?.site_name} &mdash; {formatCurrency(existingTimesheet.total_amount)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // EXISTING TIMESHEET — offer edit
  if (existingTimesheet && !editMode && canEdit) {
    return (
      <div className="page">
        <PageHeader title="Submit Timesheet" subtitle="Enter your hours for the week" />
        <WeekPicker value={weekEnding} onChange={setWeekEnding} />

        <div className={`alert ${existingTimesheet.status === 'queried' ? 'alert--warning' : 'alert--info'}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>
              {existingTimesheet.status === 'queried' ? 'Timesheet queried — please review' : 'Timesheet already submitted'}
            </strong>
            <p>
              {existingTimesheet.sites?.site_name} &mdash; {formatCurrency(existingTimesheet.total_amount)}
              {existingTimesheet.admin_notes && (
                <><br /><strong>Admin note:</strong> {existingTimesheet.admin_notes}</>
              )}
            </p>
            <p style={{marginTop: 8, fontSize: '0.85rem'}}>
              You can edit this timesheet{existingTimesheet.status === 'queried' ? '' : ' until the cutoff date'}. Any edits will reset the approval process.
            </p>
          </div>
        </div>

        <button className="btn btn--primary btn--full btn--large" onClick={loadForEdit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit Timesheet
        </button>
      </div>
    );
  }

  // MAIN FORM
  return (
    <div className="page">
      <PageHeader
        title={editMode ? 'Edit Timesheet' : 'Submit Timesheet'}
        subtitle="Enter your hours for the week"
      />

      <form onSubmit={handleFormSubmit} onKeyDown={handleKeyDown} className="timesheet-form">
        {error && <div className="auth-error">{error}</div>}

        <div className="form-section">
          <h3 className="form-section__title">Week &amp; Site</h3>
          <WeekPicker value={weekEnding} onChange={setWeekEnding} />

          <div className="form-group">
            <label className="form-label">Site *</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="form-input" required>
              <option value="">Select a site...</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Approving Manager</label>
            <input type="text" value={approvingManager} onChange={(e) => setApprovingManager(e.target.value)} className="form-input" placeholder="Manager name" />
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section__title">Daily Breakdown *</h3>
          <p className="form-section__help">Tap a day to enter start/end times and the gross amount. Each active day needs hours and an amount greater than £0.</p>
          <div className="day-rows">
            {DAYS.map(day => (
              <DayRow
                key={day}
                day={day}
                data={days[day]}
                onChange={(d) => handleDayChange(day, d)}
                expanded={expandedDay === day}
                onToggle={() => setExpandedDay(expandedDay === day ? null : day)}
              />
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section__title">CIS Deduction</h3>
          <label className="cis-toggle">
            <input type="checkbox" checked={cisEnabled} onChange={(e) => setCisEnabled(e.target.checked)} />
            <span>Apply CIS deduction</span>
          </label>
          {cisEnabled && (
            <div className="form-group" style={{marginTop: 10}}>
              <label className="form-label">CIS Rate</label>
              <select value={cisRate} onChange={(e) => setCisRate(parseFloat(e.target.value))} className="form-input">
                <option value={20}>20% (Standard rate)</option>
                <option value={30}>30% (Higher rate)</option>
                <option value={0}>0% (Gross payment)</option>
              </select>
            </div>
          )}
        </div>

        <div className="form-section form-section--summary">
          <div className="summary-row">
            <span>Gross Total:</span>
            <strong>{formatCurrency(totalGross)}</strong>
          </div>
          {totalManualDeductions > 0 && (
            <div className="summary-row">
              <span>Manual Deductions:</span>
              <strong className="text-red">-{formatCurrency(totalManualDeductions)}</strong>
            </div>
          )}
          {cisEnabled && cisDeduction > 0 && (
            <div className="summary-row">
              <span>CIS ({cisRate}%):</span>
              <strong className="text-red">-{formatCurrency(cisDeduction)}</strong>
            </div>
          )}
          <div className="summary-row summary-row--total">
            <span>Net Total:</span>
            <strong className="text-green">{formatCurrency(totalNet)}</strong>
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section__title">Payment Method</h3>
          <div className="payment-cards">
            <label className={`payment-card ${paymentMethod === 'card' ? 'payment-card--active' : ''}`}>
              <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
              <div className="payment-card__content">
                <div className="payment-card__icon payment-card__icon--card">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <div>
                  <strong>Pay by Bank Transfer</strong>
                  <p>Using saved payment details</p>
                </div>
              </div>
            </label>
            <label className={`payment-card ${paymentMethod === 'other' ? 'payment-card--active' : ''}`}>
              <input type="radio" name="payment" value="other" checked={paymentMethod === 'other'} onChange={() => setPaymentMethod('other')} />
              <div className="payment-card__content">
                <div className="payment-card__icon payment-card__icon--other">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                </div>
                <div>
                  <strong>Pay by Other</strong>
                  <p>Cash or other payment method</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        <button type="submit" className="btn btn--primary btn--full btn--large" disabled={submitting}>
          {submitting ? 'Submitting...' : (editMode ? 'Update Timesheet' : 'Submit Timesheet')}
        </button>

        {editMode && (
          <button type="button" className="btn btn--outline btn--full" style={{marginTop: 10}}
            onClick={() => { setEditMode(false); checkExisting(); }}>
            Cancel
          </button>
        )}
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">
              {editMode ? 'Update this timesheet?' : 'Submit this timesheet?'}
            </h3>
            <p className="modal__text">
              Please confirm the details before {editMode ? 'updating' : 'submitting'}:
            </p>
            <div className="modal__details">
              <div className="summary-row">
                <span>Week ending:</span>
                <strong>{formatDate(weekEnding)}</strong>
              </div>
              <div className="summary-row">
                <span>Site:</span>
                <strong>{sites.find(s => s.id === siteId)?.site_name}</strong>
              </div>
              <div className="summary-row">
                <span>Days worked:</span>
                <strong>{DAYS.filter(d => days[d].active).length}</strong>
              </div>
              <div className="summary-row summary-row--total">
                <span>Net Total:</span>
                <strong className="text-green">{formatCurrency(totalNet)}</strong>
              </div>
            </div>
            {editMode && (
              <p className="modal__warning">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{verticalAlign: 'middle', marginRight: 4}}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Editing will reset the approval process.
              </p>
            )}
            <div className="modal__actions">
              <button className="btn btn--outline" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={confirmSubmit}>
                {editMode ? 'Yes, Update' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
