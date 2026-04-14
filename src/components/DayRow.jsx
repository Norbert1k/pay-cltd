import { DAY_LABELS } from '../lib/utils';

export default function DayRow({ day, data, onChange, expanded, onToggle }) {
  const label = DAY_LABELS[day];
  const isActive = data.active;
  const net = (parseFloat(data.gross_amount) || 0) - (parseFloat(data.deductions) || 0);

  const handleField = (field, value) => {
    onChange(day, { ...data, [field]: value });
  };

  return (
    <div className={`day-row ${isActive ? 'day-row--active' : 'day-row--inactive'}`}>
      <div className="day-row__header" onClick={onToggle}>
        <div className="day-row__toggle">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => {
              e.stopPropagation();
              handleField('active', !isActive);
            }}
            className="day-row__checkbox"
          />
          <span className="day-row__label">{label}</span>
        </div>
        {isActive && (
          <span className="day-row__summary">
            {data.start_time && data.end_time
              ? `${data.start_time} - ${data.end_time}`
              : ''}
            {parseFloat(data.gross_amount) > 0 && (
              <strong> &pound;{parseFloat(data.gross_amount).toFixed(2)}</strong>
            )}
          </span>
        )}
        <svg
          className={`day-row__chevron ${expanded ? 'day-row__chevron--open' : ''}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {expanded && isActive && (
        <div className="day-row__fields">
          <div className="day-row__row">
            <div className="day-row__field">
              <label>Start</label>
              <input
                type="time"
                value={data.start_time || ''}
                onChange={(e) => handleField('start_time', e.target.value)}
              />
            </div>
            <div className="day-row__field">
              <label>End</label>
              <input
                type="time"
                value={data.end_time || ''}
                onChange={(e) => handleField('end_time', e.target.value)}
              />
            </div>
            <div className="day-row__field">
              <label>Type</label>
              <select
                value={data.work_type || 'daywork'}
                onChange={(e) => handleField('work_type', e.target.value)}
              >
                <option value="daywork">Daywork</option>
                <option value="pricework">Pricework</option>
              </select>
            </div>
          </div>
          <div className="day-row__row">
            <div className="day-row__field">
              <label>Gross (&pound;)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={data.gross_amount || ''}
                onChange={(e) => handleField('gross_amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="day-row__field">
              <label>Deductions (&pound;)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={data.deductions || ''}
                onChange={(e) => handleField('deductions', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="day-row__field">
              <label>Net (&pound;)</label>
              <input
                type="text"
                value={net.toFixed(2)}
                readOnly
                className="day-row__net"
              />
            </div>
          </div>
          <div className="day-row__field day-row__field--full">
            <label>Notes</label>
            <input
              type="text"
              value={data.notes || ''}
              onChange={(e) => handleField('notes', e.target.value)}
              placeholder="Optional notes for this day"
            />
          </div>
        </div>
      )}
    </div>
  );
}
