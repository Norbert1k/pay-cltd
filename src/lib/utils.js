// Get the next Sunday (week ending date)
export function getNextSunday(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// Format date as "12 Apr 2026"
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Format date as "12/04/2026"
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB');
}

// Format currency
export function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(num);
}

// Format datetime
export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Status colours
export const STATUS_COLORS = {
  submitted: '#378ADD',
  reviewed: '#BA7517',
  paid: '#448a40',
  queried: '#A32D2D',
};

// Payment method colours
export const PAYMENT_COLORS = {
  card: '#448a40',
  other: '#534AB7',
};

// Days of the week
export const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABELS = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

// Mask sensitive data
export function maskValue(val) {
  if (!val) return '';
  if (val.length <= 4) return '****';
  return '****' + val.slice(-4);
}

// Generate timesheet reference
export function generateRef(weekEnding, index = 1) {
  const d = weekEnding.replace(/-/g, '');
  return `TS-${d}-${String(index).padStart(3, '0')}`;
}
