import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate, formatCurrency } from '../lib/utils';
import { PageHeader, StatusPill, PaymentPill, LoadingSpinner } from '../components/ui';

export default function AdminCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [weekTimesheets, setWeekTimesheets] = useState([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchMonth();
  }, [year, month]);

  const fetchMonth = async () => {
    setLoading(true);
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const { data } = await supabase
      .from('timesheets')
      .select('*, profiles(full_name), sites(site_name)')
      .gte('week_ending', startDate.toISOString().split('T')[0])
      .lte('week_ending', endDate.toISOString().split('T')[0]);

    setTimesheets(data || []);
    setLoading(false);
  };

  const handleWeekClick = (dateStr) => {
    setSelectedWeek(dateStr);
    const filtered = timesheets.filter(t => t.week_ending === dateStr);
    setWeekTimesheets(filtered);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday start

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getDateStr = (day) => {
    const dd = String(day).padStart(2, '0');
    const mm = String(month + 1).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const getSubmissionsForDate = (day) => {
    if (!day) return [];
    const dateStr = getDateStr(day);
    return timesheets.filter(t => t.week_ending === dateStr);
  };

  const isSunday = (day) => {
    if (!day) return false;
    return new Date(year, month, day).getDay() === 0;
  };

  const monthName = currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <PageHeader title="Calendar" subtitle="Timesheet submissions by week" />

      <div className="calendar-nav">
        <button className="btn btn--sm btn--outline" onClick={prevMonth}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3 className="calendar-nav__month">{monthName}</h3>
        <button className="btn btn--sm btn--outline" onClick={nextMonth}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="calendar-grid">
          <div className="calendar-grid__header">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="calendar-grid__day-label">{d}</div>
            ))}
          </div>
          <div className="calendar-grid__body">
            {cells.map((day, i) => {
              const submissions = getSubmissionsForDate(day);
              const sunday = isSunday(day);
              const dateStr = day ? getDateStr(day) : '';
              return (
                <div
                  key={i}
                  className={`calendar-cell ${!day ? 'calendar-cell--empty' : ''} ${sunday && submissions.length > 0 ? 'calendar-cell--has-data' : ''} ${selectedWeek === dateStr ? 'calendar-cell--selected' : ''}`}
                  onClick={() => sunday && submissions.length > 0 && handleWeekClick(dateStr)}
                >
                  {day && (
                    <>
                      <span className={`calendar-cell__number ${sunday ? 'calendar-cell__number--sunday' : ''}`}>{day}</span>
                      {sunday && submissions.length > 0 && (
                        <div className="calendar-cell__indicators">
                          {submissions.slice(0, 4).map(s => (
                            <span
                              key={s.id}
                              className="calendar-cell__dot"
                              style={{ background: s.payment_method === 'card' ? 'var(--green)' : '#534AB7' }}
                              title={`${s.profiles?.full_name} - ${formatCurrency(s.total_amount)}`}
                            />
                          ))}
                          {submissions.length > 4 && (
                            <span className="calendar-cell__more">+{submissions.length - 4}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week detail panel */}
      {selectedWeek && (
        <div className="section">
          <div className="section__header">
            <h3 className="section__title">Week Ending {formatDate(selectedWeek)}</h3>
            <button className="btn btn--sm btn--outline" onClick={() => setSelectedWeek(null)}>Close</button>
          </div>
          <div className="card-list">
            {weekTimesheets.map(ts => (
              <div key={ts.id} className="timesheet-card">
                <div className="timesheet-card__top">
                  <strong>{ts.profiles?.full_name}</strong>
                  <StatusPill status={ts.status} />
                </div>
                <div className="timesheet-card__details">
                  <span>{ts.sites?.site_name}</span>
                  <PaymentPill method={ts.payment_method} />
                </div>
                <div className="timesheet-card__amount">{formatCurrency(ts.total_amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
