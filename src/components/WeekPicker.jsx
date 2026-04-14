import { useState, useEffect } from 'react';
import { getNextSunday, formatDate } from '../lib/utils';

export default function WeekPicker({ value, onChange }) {
  const [weekEnding, setWeekEnding] = useState(value || getNextSunday());

  useEffect(() => {
    onChange(weekEnding);
  }, [weekEnding]);

  const handleChange = (e) => {
    const selected = new Date(e.target.value + 'T00:00:00');
    // Snap to the nearest Sunday
    const day = selected.getDay();
    if (day !== 0) {
      const diff = 7 - day;
      selected.setDate(selected.getDate() + diff);
    }
    setWeekEnding(selected.toISOString().split('T')[0]);
  };

  const goBack = () => {
    const d = new Date(weekEnding + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    setWeekEnding(d.toISOString().split('T')[0]);
  };

  const goForward = () => {
    const d = new Date(weekEnding + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    setWeekEnding(d.toISOString().split('T')[0]);
  };

  return (
    <div className="week-picker">
      <label className="form-label">Week Ending (Sunday)</label>
      <div className="week-picker__controls">
        <button type="button" className="week-picker__btn" onClick={goBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="week-picker__display">
          <input
            type="date"
            value={weekEnding}
            onChange={handleChange}
            className="week-picker__input"
          />
          <span className="week-picker__formatted">{formatDate(weekEnding)}</span>
        </div>
        <button type="button" className="week-picker__btn" onClick={goForward}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
