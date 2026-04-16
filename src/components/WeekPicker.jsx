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
export default function WeekPicker({ value, onChange }) {
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
    </div>
  );
}
