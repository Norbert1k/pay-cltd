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
  approved: '#448a40',
  paid: '#2d6329',
  queried: '#A32D2D',
};

// Status labels (for display)
export const STATUS_LABELS = {
  submitted: 'Submitted',
  approved: 'Approved',
  paid: 'Paid',
  queried: 'Queried',
};

// All available statuses
export const STATUSES = ['submitted', 'approved', 'paid', 'queried'];

// Payment method colours
export const PAYMENT_COLORS = {
  card: '#448a40',
  other: '#534AB7',
};

// Payment method labels
export const PAYMENT_LABELS = {
  card: 'Bank Transfer',
  other: 'Other',
};

// Trades list (alphabetical)
export const TRADES = [
  'Bricklayer',
  'Carpenter',
  'Cleaner',
  'Decorator',
  'Electrician',
  'Groundworker',
  'Labourer',
  'Plasterer',
  'Plumber',
  'Renderer',
  'Site Assistant',
  'Site Manager',
  'Tape & Jointer',
  'Tiler',
  'Other',
];

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
