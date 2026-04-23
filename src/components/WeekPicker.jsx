import { useState, useEffect } from 'react';

// ========================================================================
// Pure date helpers — all using UTC to avoid any timezone issues
// ========================================================================

// Parse YYYY-MM-DD into {y, m, d} integer triple (no Date object needed)
function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

// Format {y, m, d} to YYYY-MM-DD
function formatYMD({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Get day of week for a date string (0=Sun, 1=Mon, ... 6=Sat)
function getDayOfWeek(dateStr) {
  const { y, m, d } = parseYMD(dateStr);
  // Use UTC to avoid timezone drift
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Add N days to a date string and return new YYYY-MM-DD
function addDays(dateStr, n) {
  const { y, m, d } = parseYMD(dateStr);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + n);
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

// Snap ANY date to the Sunday of that Mon-Sun week
// e.g. Thu 16 Apr → Sun 19 Apr; Sat 18 Apr → Sun 19 Apr; Sun 19 Apr → Sun 19 Apr
function snapToSunday(dateStr) {
  const day = getDayOfWeek(dateStr); // 0=Sun ... 6=Sat
  if (day === 0) return dateStr;
  return addDays(dateStr, 7 - day);
}

// Get today as YYYY-MM-DD (local time)
function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// Get this week's ending Sunday (the upcoming Sunday, or today if it's Sunday)
function getThisSunday() {
  return snapToSunday(todayStr());
}

// Get array of 7 YYYY-MM-DD strings, Monday through Sunday, given any Sunday
function getMonToSun(sundayStr) {
  // Verify it's actually Sunday; if not, snap first
  const safeSunday = snapToSunday(sundayStr);
  const days = [];
  // Monday = Sunday - 6 days
  for (let i = 6; i >= 0; i--) {
    days.push(addDays(safeSunday, -i));
  }
  return days; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
}

// Format date for display: "12 Apr 2026"
function formatLong(dateStr) {
  const { y, m, d } = parseYMD(dateStr);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// Format date short: "12 Apr"
function formatShort(dateStr) {
  const { m, d } = parseYMD(dateStr);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${MONTHS[m - 1]}`;
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Mon..Sun (for labels)

// ========================================================================
// Component
// ========================================================================
export default function WeekPicker({ value, onChange, paymentDates = [] }) {
  const [weekEnding, setWeekEnding] = useState(() => snapToSunday(value || getThisSunday()));
  const [showPicker, setShowPicker] = useState(false);

  // Sync with incoming value prop (always snap)
  useEffect(() => {
    if (value) {
      const snapped = snapToSunday(value);
      if (snapped !== weekEnding) setWeekEnding(snapped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Emit changes upward
  useEffect(() => {
    onChange(weekEnding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekEnding]);

  const setWeek = (sundayStr) => setWeekEnding(snapToSunday(sundayStr));

  const today = todayStr();
  const thisSunday = getThisSunday();
  const lastSunday = addDays(thisSunday, -7);
  const nextSunday = addDays(thisSunday, 7);

  // Mon-Sun array of date strings for the selected week
  const weekDays = getMonToSun(weekEnding); // [Mon, Tue, ..., Sun]
  const mondayStr = weekDays[0];
  const sundayStr = weekDays[6];

  const isSelected = (s) => weekEnding === s;

  const goBack = () => setWeek(addDays(weekEnding, -7));
  const goForward = () => setWeek(addDays(weekEnding, 7));

  // Build list of selectable weeks (last 6 + this + next 2)
  const pickerWeeks = [];
  for (let i = 2; i >= -6; i--) {
    pickerWeeks.push(addDays(thisSunday, i * 7));
  }

  // Month/year label for the selected week — use the Sunday
  const { m, y } = parseYMD(sundayStr);
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthYear = `${MONTH_NAMES[m - 1]} ${y}`;

  // ------------------------------------------------------------------
  // Payment / cutoff lookup for the selected week
  // Rule (same as MyTimesheets): first payment_dates row where cutoff_date >= week_ending
  // ------------------------------------------------------------------
  const selectedPayment = paymentDates
    .slice()
    .sort((a, b) => a.cutoff_date.localeCompare(b.cutoff_date))
    .find(pd => pd.cutoff_date >= weekEnding);

  // Whole-day difference between two YYYY-MM-DD strings (b - a)
  const daysBetween = (a, b) => {
    const pa = parseYMD(a), pb = parseYMD(b);
    const ua = Date.UTC(pa.y, pa.m - 1, pa.d);
    const ub = Date.UTC(pb.y, pb.m - 1, pb.d);
    return Math.round((ub - ua) / 86400000);
  };

  const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const cutoffPassed = selectedPayment && selectedPayment.cutoff_date < today;
  const cutoffDaysAway = selectedPayment ? daysBetween(today, selectedPayment.cutoff_date) : null;

  const cutoffHint = (() => {
    if (!selectedPayment) return '';
    if (cutoffPassed) return 'Will go on next payroll';
    if (cutoffDaysAway === 0) return 'Today';
    if (cutoffDaysAway === 1) return 'Tomorrow';
    return `in ${cutoffDaysAway} days`;
  })();

  const paymentHint = selectedPayment
    ? `${DAY_NAMES_LONG[getDayOfWeek(selectedPayment.payment_date)]} payroll`
    : '';

  const cutoffDayShort = selectedPayment ? DAY_NAMES_SHORT[getDayOfWeek(selectedPayment.cutoff_date)] : '';
  const paymentDayShort = selectedPayment ? DAY_NAMES_SHORT[getDayOfWeek(selectedPayment.payment_date)] : '';

  return (
    <div className="week-picker-v2">
      <label className="form-label">
        Which week are you submitting for? <span className="required">*</span>
      </label>

      {/* Quick select chips */}
      <div className="week-picker-v2__quick">
        <button type="button" className={`week-chip ${isSelected(lastSunday) ? 'week-chip--active' : ''}`}
          onClick={() => setWeek(lastSunday)}>
          Last Week
        </button>
        <button type="button" className={`week-chip ${isSelected(thisSunday) ? 'week-chip--active' : ''}`}
          onClick={() => setWeek(thisSunday)}>
          This Week
        </button>
        <button type="button" className={`week-chip ${isSelected(nextSunday) ? 'week-chip--active' : ''}`}
          onClick={() => setWeek(nextSunday)}>
          Next Week
        </button>
        <button type="button" className="week-chip week-chip--other" onClick={() => setShowPicker(!showPicker)}>
          {showPicker ? '✕ Close' : 'Other Week...'}
        </button>
      </div>

      {/* Other weeks list */}
      {showPicker && (
        <div className="week-picker-v2__list">
          <p className="text-sm text-muted" style={{ marginBottom: 8 }}>Select any week:</p>
          {pickerWeeks.map(w => {
            const mon = addDays(w, -6);
            const label = `${formatShort(mon)} – ${formatShort(w)}`;
            const selected = isSelected(w);
            const isThis = w === thisSunday;
            return (
              <button type="button" key={w}
                className={`week-picker-v2__option ${selected ? 'week-picker-v2__option--active' : ''}`}
                onClick={() => { setWeek(w); setShowPicker(false); }}>
                <span>{label}</span>
                {isThis && <span className="week-picker-v2__badge">This week</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Display range */}
      <div className="week-picker-v2__display">
        <button type="button" className="week-picker-v2__nav" onClick={goBack} title="Previous week">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="week-picker-v2__center">
          <div className="week-picker-v2__range">
            {formatLong(mondayStr)} &mdash; {formatLong(sundayStr)}
          </div>
          <div className="week-picker-v2__month">{monthYear}</div>
        </div>
        <button type="button" className="week-picker-v2__nav" onClick={goForward} title="Next week">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day strip — always Mon to Sun */}
      <div className="week-strip">
        {weekDays.map((dateStr, i) => {
          const isToday = dateStr === today;
          const isSunday = i === 6;
          return (
            <div key={dateStr}
              className={`week-strip__day ${isToday ? 'week-strip__day--today' : ''} ${isSunday ? 'week-strip__day--sunday' : ''}`}>
              <span className="week-strip__dow">{DAY_LETTERS[i]}</span>
              <span className="week-strip__date">{parseYMD(dateStr).d}</span>
              {isSunday && <span className="week-strip__sunday-label">END</span>}
              {isToday && <span className="week-strip__today-dot" />}
            </div>
          );
        })}
      </div>

      {/* Payment / cutoff info tiles */}
      {selectedPayment ? (
        <div className="pay-info">
          <div className={`pay-info__tile ${cutoffPassed ? 'pay-info__tile--red' : 'pay-info__tile--amber'}`}>
            <div className="pay-info__icon">
              {cutoffPassed ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              )}
            </div>
            <div className="pay-info__body">
              <div className="pay-info__label">{cutoffPassed ? 'Cutoff Passed' : 'Cutoff'}</div>
              <div className="pay-info__date">{cutoffDayShort} {formatShort(selectedPayment.cutoff_date)}</div>
              <div className="pay-info__hint">{cutoffHint}</div>
            </div>
          </div>
          <div className="pay-info__tile pay-info__tile--green">
            <div className="pay-info__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 4H9v16h7a3 3 0 0 0 0-6H9" />
                <path d="M7 10h8" />
              </svg>
            </div>
            <div className="pay-info__body">
              <div className="pay-info__label">Payment Day</div>
              <div className="pay-info__date">{paymentDayShort} {formatLong(selectedPayment.payment_date)}</div>
              <div className="pay-info__hint">{paymentHint}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pay-info">
          <div className="pay-info__tile pay-info__tile--grey pay-info__tile--full">
            <div className="pay-info__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="pay-info__body">
              <div className="pay-info__label">Payment</div>
              <div className="pay-info__date">Not yet scheduled</div>
              <div className="pay-info__hint">Accounts will add a payroll date for this week</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
