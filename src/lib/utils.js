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
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Format date short "12 Apr"
export function formatDateCompact(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num);
}

// Format datetime
export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ============================================================
// STATUSES — 3-stage approval workflow
// ============================================================
export const STATUS_COLORS = {
  submitted: '#378ADD',
  approved_accounts: '#BA7517',
  approved_director: '#448a40',
  paid: '#2d6329',
  queried: '#A32D2D',
};

export const STATUS_LABELS = {
  submitted: 'Submitted',
  approved_accounts: 'Accounts Approved',
  approved_director: 'Director Approved',
  paid: 'Paid',
  queried: 'Queried',
};

export const STATUS_LABELS_SHORT = {
  submitted: 'Submitted',
  approved_accounts: 'Accounts',
  approved_director: 'Director',
  paid: 'Paid',
  queried: 'Queried',
};

export const STATUSES = ['submitted', 'approved_accounts', 'approved_director', 'paid', 'queried'];

// ============================================================
// ROLES
// ============================================================
export const ROLES = {
  worker: 'Worker',
  admin: 'Admin',
  accountant: 'Accountant',
  director: 'Director',
};

export const ROLE_LIST = ['worker', 'accountant', 'director', 'admin'];

// ============================================================
// PAYMENT METHODS
// ============================================================
export const PAYMENT_COLORS = {
  card: '#448a40',
  other: '#534AB7',
};

export const PAYMENT_LABELS = {
  card: 'Bank Transfer',
  other: 'Other',
};

// ============================================================
// TRADES
// ============================================================
export const TRADES = [
  'Bricklayer', 'Carpenter', 'Cleaner', 'Decorator', 'Electrician',
  'Groundworker', 'Labourer', 'Plasterer', 'Plumber', 'Project Manager',
  'Renderer', 'Site Assistant', 'Site Manager', 'Tape & Jointer', 'Tiler', 'Other',
];

// ============================================================
// DAYS
// ============================================================
export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DAY_LABELS = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

// ============================================================
// HELPERS
// ============================================================

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

// Group timesheets by worker for 2-week view
// Returns array of { worker, timesheets: [...], totalAmount, weekEndings: [] }
export function groupTimesheetsByWorker(timesheets) {
  const map = {};
  for (const ts of timesheets) {
    const wid = ts.worker_id || ts.profiles?.id;
    if (!map[wid]) {
      map[wid] = {
        workerId: wid,
        worker: ts.profiles,
        timesheets: [],
        totalAmount: 0,
        weekEndings: [],
      };
    }
    map[wid].timesheets.push(ts);
    map[wid].totalAmount += parseFloat(ts.total_amount || 0);
    if (!map[wid].weekEndings.includes(ts.week_ending)) {
      map[wid].weekEndings.push(ts.week_ending);
    }
  }
  // Sort week endings within each group
  Object.values(map).forEach(g => g.weekEndings.sort());
  return Object.values(map).sort((a, b) => (a.worker?.full_name || '').localeCompare(b.worker?.full_name || ''));
}

// Check if user can approve at a given stage
export function canApprove(profile, stage) {
  if (!profile) return false;
  if (stage === 'approved_accounts') {
    return ['admin', 'accountant', 'director'].includes(profile.role);
  }
  if (stage === 'approved_director') {
    return ['admin', 'director'].includes(profile.role);
  }
  if (stage === 'paid') {
    return ['admin', 'accountant', 'director'].includes(profile.role);
  }
  return ['admin', 'accountant', 'director'].includes(profile.role);
}

// Check if user is admin-level (admin, accountant, or director)
export function isAdminRole(role) {
  return ['admin', 'accountant', 'director'].includes(role);
}
