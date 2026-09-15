import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatDate, formatDateCompact, formatCurrency, todayLocal } from '../lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '../components/ui';
import { generateJobCostsPDF } from '../components/JobCostsPDF';

// ============================================================
// Helpers
// ============================================================

// total_amount is stored NET of CIS. Gross = net / (1 - rate).
// Gross is the true cost to the company (net to worker + CIS to HMRC).
function grossOf(ts) {
  const net = Number(ts.total_amount) || 0;
  const rate = Number(ts.cis_rate) || 0;
  if (rate <= 0 || rate >= 100) return net;
  return net / (1 - rate / 100);
}

function toISO(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function todayISO() {
  return todayLocal();
}

const PRESETS = [
  { key: 'run',   label: 'This payment run' },
  { key: 'runs4', label: 'Last 4 runs' },
  { key: 'month', label: 'This month' },
  { key: 'ytd',   label: 'Year to date' },
  { key: 'custom', label: 'Custom…' },
];

// ============================================================
// Component
// ============================================================
export default function AdminReports() {
  const { profile } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [paymentDates, setPaymentDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('run');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(todayISO());
  const [expandedSite, setExpandedSite] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: ts }, { data: pd }] = await Promise.all([
        supabase
          .from('timesheets')
          .select('id, worker_id, site_id, week_ending, total_amount, cis_rate, status, payment_method, profiles!timesheets_worker_id_fkey(id, full_name, trade), sites(id, site_name, project_ref)'),
        supabase.from('payment_dates').select('*').order('cutoff_date', { ascending: true }),
      ]);
      setTimesheets(ts || []);
      setPaymentDates(pd || []);
      setLoading(false);
    })();
  }, []);

  // ------------------------------------------------------------
  // Resolve the selected preset to a week_ending range
  // Range is (start, end] — start exclusive, end inclusive — to match
  // the payment-run boundary rule used in All Timesheets.
  // ------------------------------------------------------------
  const range = useMemo(() => {
    const today = todayISO();
    const sorted = paymentDates;
    // Current run = first run whose cutoff is >= today, else the latest run
    let idx = sorted.findIndex(p => p.cutoff_date >= today);
    if (idx === -1) idx = sorted.length - 1;
    const current = sorted[idx];

    if (preset === 'run' && current) {
      const prev = idx > 0 ? sorted[idx - 1] : null;
      return { start: prev ? prev.cutoff_date : '0000-00-00', end: current.cutoff_date, label: `Run ${formatDate(current.payment_date)}` };
    }
    if (preset === 'runs4' && current) {
      const prev = idx - 4 >= 0 ? sorted[idx - 4] : null;
      const first = sorted[Math.max(0, idx - 3)];
      return { start: prev ? prev.cutoff_date : '0000-00-00', end: current.cutoff_date, label: `Runs ${formatDateCompact(first.payment_date)} – ${formatDateCompact(current.payment_date)}` };
    }
    if (preset === 'month') {
      const n = new Date();
      const first = toISO(new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1)));
      const dayBefore = toISO(new Date(Date.UTC(n.getFullYear(), n.getMonth(), 0)));
      return { start: dayBefore, end: today, label: n.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), from: first };
    }
    if (preset === 'ytd') {
      const n = new Date();
      const dec31 = `${n.getFullYear() - 1}-12-31`;
      return { start: dec31, end: today, label: `${n.getFullYear()} to date` };
    }
    // custom
    if (customStart) {
      const [y, m, d] = customStart.split('-').map(Number);
      const dayBefore = toISO(new Date(Date.UTC(y, m - 1, d - 1)));
      return { start: dayBefore, end: customEnd || today, label: `${formatDateCompact(customStart)} – ${formatDateCompact(customEnd || today)}` };
    }
    return { start: '0000-00-00', end: today, label: 'All time' };
  }, [preset, paymentDates, customStart, customEnd]);

  const inRange = useMemo(
    () => timesheets.filter(ts => ts.week_ending > range.start && ts.week_ending <= range.end),
    [timesheets, range]
  );

  // ------------------------------------------------------------
  // Aggregations
  // ------------------------------------------------------------
  const report = useMemo(() => {
    const totals = { gross: 0, cis: 0, net: 0, sheets: 0, workers: new Set(), sites: new Set(), trades: new Set() };
    const bySite = {};
    const byTrade = {};

    inRange.forEach(ts => {
      const net = Number(ts.total_amount) || 0;
      const gross = grossOf(ts);
      const cis = gross - net;
      const siteKey = ts.site_id || 'none';
      const trade = ts.profiles?.trade || 'Unassigned';

      totals.gross += gross; totals.cis += cis; totals.net += net; totals.sheets += 1;
      totals.workers.add(ts.worker_id); totals.sites.add(siteKey); totals.trades.add(trade);

      if (!bySite[siteKey]) bySite[siteKey] = {
        key: siteKey, name: ts.sites?.site_name || 'No site', ref: ts.sites?.project_ref || '',
        gross: 0, cis: 0, net: 0, sheets: 0, workers: new Set(), trades: {},
      };
      const s = bySite[siteKey];
      s.gross += gross; s.cis += cis; s.net += net; s.sheets += 1; s.workers.add(ts.worker_id);
      if (!s.trades[trade]) s.trades[trade] = { name: trade, gross: 0, cis: 0, net: 0, sheets: 0, workers: new Set() };
      s.trades[trade].gross += gross; s.trades[trade].cis += cis; s.trades[trade].net += net;
      s.trades[trade].sheets += 1; s.trades[trade].workers.add(ts.worker_id);

      if (!byTrade[trade]) byTrade[trade] = { name: trade, gross: 0, cis: 0, net: 0, sheets: 0, workers: new Set() };
      byTrade[trade].gross += gross; byTrade[trade].cis += cis; byTrade[trade].net += net;
      byTrade[trade].sheets += 1; byTrade[trade].workers.add(ts.worker_id);
    });

    const finalize = (o) => ({ ...o, workers: o.workers.size });
    const sites = Object.values(bySite)
      .map(s => ({ ...finalize(s), trades: Object.values(s.trades).map(finalize).sort((a, b) => b.gross - a.gross) }))
      .sort((a, b) => b.gross - a.gross);
    const trades = Object.values(byTrade).map(finalize).sort((a, b) => b.gross - a.gross);

    return {
      totals: { ...totals, workers: totals.workers.size, sites: totals.sites.size, trades: totals.trades.size },
      sites, trades,
    };
  }, [inRange]);

  // ------------------------------------------------------------
  // Exports
  // ------------------------------------------------------------
  const handleCSV = () => {
    const rows = [['Section', 'Name', 'Ref', 'Workers', 'Timesheets', 'Gross', 'CIS', 'Net']];
    report.sites.forEach(s => {
      rows.push(['Site', s.name, s.ref, s.workers, s.sheets, s.gross.toFixed(2), s.cis.toFixed(2), s.net.toFixed(2)]);
      s.trades.forEach(t => rows.push(['  ↳ Trade', t.name, '', t.workers, t.sheets, t.gross.toFixed(2), t.cis.toFixed(2), t.net.toFixed(2)]));
    });
    report.trades.forEach(t => rows.push(['Trade', t.name, '', t.workers, t.sheets, t.gross.toFixed(2), t.cis.toFixed(2), t.net.toFixed(2)]));
    rows.push(['TOTAL', '', '', report.totals.workers, report.totals.sheets, report.totals.gross.toFixed(2), report.totals.cis.toFixed(2), report.totals.net.toFixed(2)]);
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Job_Costs_${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handlePDF = () => generateJobCostsPDF(report, range, profile);

  if (loading) return <LoadingSpinner />;

  const maxSite = report.sites[0]?.gross || 1;
  const maxTrade = report.trades[0]?.gross || 1;
  const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

  return (
    <div className="page">
      <PageHeader
        title="Job Costs"
        subtitle="Spend by site and worker category"
        actions={
          inRange.length > 0 && (
            <div className="action-btns">
              <button className="btn btn--sm btn--outline" onClick={handleCSV}>CSV</button>
              <button className="btn btn--sm btn--primary" onClick={handlePDF}>Report PDF</button>
            </div>
          )
        }
      />

      {/* Period presets */}
      <div className="report-presets">
        {PRESETS.map(p => (
          <button key={p.key} className={`report-preset ${preset === p.key ? 'report-preset--active' : ''}`} onClick={() => setPreset(p.key)}>
            {p.label}
          </button>
        ))}
        <span className="report-presets__label">{range.label}</span>
      </div>
      {preset === 'custom' && (
        <div className="report-custom">
          <label>From <input type="date" className="form-input form-input--sm" value={customStart} onChange={e => setCustomStart(e.target.value)} /></label>
          <label>To <input type="date" className="form-input form-input--sm" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></label>
          <span className="text-muted text-sm">Filters by week-ending date</span>
        </div>
      )}

      {inRange.length === 0 ? (
        <EmptyState title="No timesheets in this period" message="Try a wider date range." />
      ) : (
        <>
          {/* Summary tiles */}
          <div className="report-tiles">
            <div className="report-tile">
              <div className="report-tile__label">Gross spend</div>
              <div className="report-tile__value">{formatCurrency(report.totals.gross)}</div>
              <div className="report-tile__sub">{report.totals.sheets} timesheets</div>
            </div>
            <div className="report-tile report-tile--cis">
              <div className="report-tile__label">CIS retained</div>
              <div className="report-tile__value">{formatCurrency(report.totals.cis)}</div>
              <div className="report-tile__sub">to HMRC</div>
            </div>
            <div className="report-tile report-tile--net">
              <div className="report-tile__label">Net paid</div>
              <div className="report-tile__value">{formatCurrency(report.totals.net)}</div>
              <div className="report-tile__sub">to workers</div>
            </div>
            <div className="report-tile">
              <div className="report-tile__label">Active</div>
              <div className="report-tile__value">{report.totals.sites} site{report.totals.sites !== 1 ? 's' : ''}</div>
              <div className="report-tile__sub">{report.totals.workers} workers · {report.totals.trades} trades</div>
            </div>
          </div>

          {/* Spend by site */}
          <h3 className="report-section-title">Spend by site</h3>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr><th>Site</th><th>Workers</th><th>Sheets</th><th className="num">Gross</th><th className="num">CIS</th><th className="num">Net</th><th className="num">%</th></tr>
              </thead>
              <tbody>
                {report.sites.map(s => {
                  const open = expandedSite === s.key;
                  return [
                    <tr key={s.key} className={`report-row ${open ? 'report-row--open' : ''}`} onClick={() => setExpandedSite(open ? null : s.key)}>
                      <td>
                        <div className="report-name">
                          <span className="report-chevron">{open ? '▾' : '▸'}</span>
                          <strong>{s.name}</strong>
                          {s.ref && <span className="text-muted text-sm">#{s.ref}</span>}
                        </div>
                        <div className="report-bar"><div className="report-bar__fill report-bar__fill--site" style={{ width: `${(s.gross / maxSite) * 100}%` }} /></div>
                      </td>
                      <td>{s.workers}</td>
                      <td>{s.sheets}</td>
                      <td className="num"><strong>{formatCurrency(s.gross)}</strong></td>
                      <td className="num report-cis">{formatCurrency(s.cis)}</td>
                      <td className="num report-net">{formatCurrency(s.net)}</td>
                      <td className="num text-muted">{pct(s.gross, report.totals.gross)}%</td>
                    </tr>,
                    open && s.trades.map(t => (
                      <tr key={`${s.key}-${t.name}`} className="report-subrow">
                        <td><span className="report-subname">{t.name}</span></td>
                        <td>{t.workers}</td>
                        <td>{t.sheets}</td>
                        <td className="num">{formatCurrency(t.gross)}</td>
                        <td className="num report-cis">{formatCurrency(t.cis)}</td>
                        <td className="num">{formatCurrency(t.net)}</td>
                        <td className="num text-muted">{pct(t.gross, s.gross)}%</td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td><td>{report.totals.workers}</td><td>{report.totals.sheets}</td>
                  <td className="num">{formatCurrency(report.totals.gross)}</td>
                  <td className="num report-cis">{formatCurrency(report.totals.cis)}</td>
                  <td className="num report-net">{formatCurrency(report.totals.net)}</td>
                  <td className="num">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Spend by trade */}
          <h3 className="report-section-title">Spend by worker category</h3>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr><th>Trade</th><th>Workers</th><th>Sheets</th><th className="num">Gross</th><th className="num">CIS</th><th className="num">Net</th><th className="num">%</th></tr>
              </thead>
              <tbody>
                {report.trades.map(t => (
                  <tr key={t.name} className="report-row report-row--static">
                    <td>
                      <div className="report-name"><strong>{t.name}</strong></div>
                      <div className="report-bar"><div className="report-bar__fill report-bar__fill--trade" style={{ width: `${(t.gross / maxTrade) * 100}%` }} /></div>
                    </td>
                    <td>{t.workers}</td>
                    <td>{t.sheets}</td>
                    <td className="num"><strong>{formatCurrency(t.gross)}</strong></td>
                    <td className="num report-cis">{formatCurrency(t.cis)}</td>
                    <td className="num report-net">{formatCurrency(t.net)}</td>
                    <td className="num text-muted">{pct(t.gross, report.totals.gross)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
