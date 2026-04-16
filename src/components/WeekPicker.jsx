import { useState, useEffect } from 'react';
import { getNextSunday, formatDate } from '../lib/utils';

// Format short date like "Mon 13"
function shortDay(d) {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

// Snap any date to the Sunday of that week (end of that week, Mon-Sun)
function snapToSunday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  // If already Sunday, keep it
  if (day === 0) return d.toISOString().split('T')[0];
  // Otherwise advance to next Sunday (7 - day)
  d.setDate(d.getDate() + (7 - day));
  return d.toISOString().split('T')[0];
}

// Get Monday-to-Sunday array of days, where sundayStr is the Sunday ending the week
function getWeekDays(sundayStr) {
  const sunday = new Date(sundayStr + 'T00:00:00');
  const days = [];
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

// Shift week by N weeks (always lands on Sunday)
function shiftWeek(sundayStr, weeks) {
  const d = new Date(sundayStr + 'T00:00:00');
  d.setDate(d.getDate() + (weeks * 7));
  return d.toISOString().split('T')[0];
}

export default function WeekPicker({ value, onChange }) {
  // Ensure initial value is always a Sunday
  const [weekEnding, setWeekEnding] = useState(() => {
    const initial = value || getNextSunday();
    return snapToSunday(initial);
  });
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (value) {
      const snapped = snapToSunday(value);
      if (snapped !== weekEnding) setWeekEnding(snapped);
    }
  }, [value]);

  useEffect(() => {
    onChange(weekEnding);
  }, [weekEnding]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentWeek = getNextSunday();
  const isCurrentWeek = weekEnding === currentWeek;
  const lastWeek = shiftWeek(currentWeek, -1);
  const nextWeek = shiftWeek(currentWeek, 1);

  const weekDays = getWeekDays(weekEnding);
  const monday = weekDays[0];
  const sunday = weekDays[6];

  const goBack = () => setWeekEnding(shiftWeek(weekEnding, -1));
  const goForward = () => setWeekEnding(shiftWeek(weekEnding, 1));

  // Generate last 6 weeks + next 2 weeks for quick select
  const quickSelectWeeks = [];
  for (let i = -6; i <= 2; i++) {
    quickSelectWeeks.push(shiftWeek(currentWeek, i));
  }

  const monthYear = sunday.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="week-picker-v2">
      <label className="form-label">
        Which week are you submitting for? <span className="required">*</span>
      </label>

      {/* Quick select buttons */}
      <div className="week-picker-v2__quick">
        <button type="button" className={`week-chip ${weekEnding === lastWeek ? 'week-chip--active' : ''}`}
          onClick={() => setWeekEnding(lastWeek)}>
          Last Week
        </button>
        <button type="button" className={`week-chip ${isCurrentWeek ? 'week-chip--active' : ''}`}
          onClick={() => setWeekEnding(currentWeek)}>
          This Week
        </button>
        <button type="button" className={`week-chip ${weekEnding === nextWeek ? 'week-chip--active' : ''}`}
          onClick={() => setWeekEnding(nextWeek)}>
          Next Week
        </button>
        <button type="button" className="week-chip week-chip--other" onClick={() => setShowPicker(!showPicker)}>
          {showPicker ? '✕ Close' : 'Other Week...'}
        </button>
      </div>

      {/* Other week picker dropdown */}
      {showPicker && (
        <div className="week-picker-v2__list">
          <p className="text-sm text-muted" style={{marginBottom: 8}}>Select any week:</p>
          {quickSelectWeeks.reverse().map(w => {
            const days = getWeekDays(w);
            const label = `${shortDay(days[0])} – ${shortDay(days[6])} ${days[6].toLocaleDateString('en-GB', { month: 'short' })}`;
            const isSelected = w === weekEnding;
            const isCurrent = w === currentWeek;
            return (
              <button type="button" key={w}
                className={`week-picker-v2__option ${isSelected ? 'week-picker-v2__option--active' : ''}`}
                onClick={() => { setWeekEnding(w); setShowPicker(false); }}>
                <span>{label}</span>
                {isCurrent && <span className="week-picker-v2__badge">This week</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected week display */}
      <div className="week-picker-v2__display">
        <button type="button" className="week-picker-v2__nav" onClick={goBack} title="Previous week">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="week-picker-v2__center">
          <div className="week-picker-v2__range">
            {formatDate(monday.toISOString().split('T')[0])} &mdash; {formatDate(sunday.toISOString().split('T')[0])}
          </div>
          <div className="week-picker-v2__month">{monthYear}</div>
        </div>

        <button type="button" className="week-picker-v2__nav" onClick={goForward} title="Next week">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day strip — Monday to Sunday */}
      <div className="week-strip">
        {weekDays.map((d, i) => {
          const isToday = d.toDateString() === new Date().toDateString();
          const isSunday = d.getDay() === 0;
          // Fixed labels for clarity (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
          const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
          return (
            <div key={i} className={`week-strip__day ${isToday ? 'week-strip__day--today' : ''} ${isSunday ? 'week-strip__day--sunday' : ''}`}>
              <span className="week-strip__dow">{DAY_LETTERS[i]}</span>
              <span className="week-strip__date">{d.getDate()}</span>
              {isSunday && <span className="week-strip__sunday-label">END</span>}
              {isToday && <span className="week-strip__today-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
