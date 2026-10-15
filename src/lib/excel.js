// Excel export: an Entries sheet (one row per batch or cutting job), a Summary sheet grouped by
// product, customer, worker, machine and day, and for cutting a Rolls waiting sheet.
import { STAGES, inKgOf, nice, openBatches, parse, pct, r1, today, totalsOf, wasteOf } from './data.js';

let XLSX;
const loadXlsx = async () => (XLSX ||= await import('xlsx'));

function groupRows(rows, keyFn, cols) {
  const m = new Map();
  rows.forEach((e) => { const k = keyFn(e); const g = m.get(k) || []; g.push(e); m.set(k, g); });
  return [...m].map(([k, list]) => { const t = totalsOf(list); return [k, list.length, ...cols(t)]; });
}

function buildWorkbook(X, { rows, title, kind, stage, lists, entries }) {
  const t = totalsOf(rows);
  const wb = X.utils.book_new();
  const sheet = (aoa, widths) => { const ws = X.utils.aoa_to_sheet(aoa, { cellDates: true, dateNF: 'dd-mmm-yyyy' }); ws['!cols'] = widths.map((w) => ({ wch: w })); return ws; };
  const company = `Polyform Plastics — ${STAGES[stage].name}`;
  const byDay = (cols) => groupRows(rows, (e) => e.date, cols).sort((a, b) => a[0].localeCompare(b[0])).map((r) => [nice(r[0], { weekday: 'short', day: 'numeric', month: 'short' }), ...r.slice(1)]);
  const desc = (a, b) => b[3] - a[3];
  let summary, entriesAoa, header;

  if (stage === 'ex') {
    const matNames = [...new Set([...lists.materials, ...rows.flatMap((e) => (e.materials || []).map((m) => m.name))])];
    header = ['Date', 'Batch no.', 'Shift', 'Worker', 'Machine', 'Customer', 'Order / PO', 'Product', 'Size (cm)', 'Thickness', 'Colour', 'Printing',
      ...matNames.map((n) => `${n} (kg)`), 'Total mix (kg)', 'Rolls', 'Roll weight (kg)', 'Waste (kg)', 'Waste %', 'Notes'];
    entriesAoa = rows.map((e) => {
      const mk = Object.fromEntries((e.materials || []).map((m) => [m.name, m.kg]));
      return [parse(e.date), e.batch, e.shift, e.worker, e.machine, e.customer, e.order, e.product, e.size, e.thick, e.colour, e.print,
        ...matNames.map((n) => mk[n] ?? null), inKgOf(e), Number(e.rolls) || 0, Number(e.outKg) || 0, wasteOf(e), pct(wasteOf(e), inKgOf(e)), e.notes || ''];
    });
    if (rows.length) entriesAoa.push(['TOTAL', '', '', '', '', '', '', '', '', '', '', '', ...matNames.map((n) => r1(t.mats[n] || 0)), t.inKg, t.rolls, t.outKg, t.waste, pct(t.waste, t.inKg), '']);
    const cols = (g) => [g.inKg, g.rolls, g.outKg, g.waste, g.wastePct];
    const gh = ['Batches', 'Mix (kg)', 'Rolls', 'Roll weight (kg)', 'Waste (kg)', 'Waste %'];
    summary = [[`${company} — summary — ${title}`], [],
      ['Roll weight produced (kg)', t.outKg], ['Rolls', t.rolls], ['Material mixed (kg)', t.inKg], ['Extrusion waste (kg)', t.waste], ['Waste %', t.wastePct], ['Batches', rows.length], [],
      ['MATERIALS USED', 'kg', '% of mix'], ...matNames.map((n) => [n, r1(t.mats[n] || 0), pct(t.mats[n] || 0, t.inKg)]), [],
      ['BY PRODUCT & SIZE', ...gh], ...groupRows(rows, (e) => `${e.product} ${e.size} · ${e.thick} · ${e.colour}`, cols).sort(desc), [],
      ['BY CUSTOMER', ...gh], ...groupRows(rows, (e) => e.customer || '—', cols).sort(desc), [],
      ['BY WORKER', ...gh], ...groupRows(rows, (e) => e.worker || '—', cols).sort(desc), [],
      ['BY MACHINE', ...gh], ...groupRows(rows, (e) => e.machine || '—', cols).sort(desc)];
    if (kind !== 'day') summary.push([], ['BY DAY', ...gh], ...byDay(cols));
  } else {
    header = ['Date', 'Roll batch', 'Shift', 'Worker', 'Machine', 'Customer', 'Order / PO', 'Product', 'Size (cm)', 'Thickness', 'Colour', 'Printing',
      'Rolls used', 'Roll weight used (kg)', 'Finished (kg)', 'Pieces', 'Packets', 'Waste (kg)', 'Waste %', 'Notes'];
    entriesAoa = rows.map((e) => [parse(e.date), e.batch || '', e.shift, e.worker, e.machine, e.customer, e.order, e.product, e.size, e.thick, e.colour, e.print,
      Number(e.rolls) || 0, inKgOf(e), Number(e.outKg) || 0, Number(e.pieces) || 0, Number(e.bundles) || 0, wasteOf(e), pct(wasteOf(e), inKgOf(e)), e.notes || '']);
    if (rows.length) entriesAoa.push(['TOTAL', '', '', '', '', '', '', '', '', '', '', '', t.rolls, t.inKg, t.outKg, t.pieces, t.bundles, t.waste, t.wastePct, '']);
    const cols = (g) => [g.inKg, g.outKg, g.pieces, g.bundles, g.waste, g.wastePct];
    const gh = ['Jobs', 'Roll kg used', 'Finished (kg)', 'Pieces', 'Packets', 'Waste (kg)', 'Waste %'];
    summary = [[`${company} — summary — ${title}`], [],
      ['Finished bags (kg)', t.outKg], ['Pieces', t.pieces], ['Packets', t.bundles], ['Roll weight used (kg)', t.inKg], ['Cutting waste (kg)', t.waste], ['Waste %', t.wastePct], ['Cutting jobs', rows.length], [],
      ['BY PRODUCT & SIZE', ...gh], ...groupRows(rows, (e) => `${e.product} ${e.size} · ${e.thick} · ${e.colour}`, cols).sort(desc), [],
      ['BY CUSTOMER', ...gh], ...groupRows(rows, (e) => e.customer || '—', cols).sort(desc), [],
      ['BY WORKER', ...gh], ...groupRows(rows, (e) => e.worker || '—', cols).sort(desc), [],
      ['BY MACHINE', ...gh], ...groupRows(rows, (e) => e.machine || '—', cols).sort(desc)];
    if (kind !== 'day') summary.push([], ['BY DAY', ...gh], ...byDay(cols));
  }
  X.utils.book_append_sheet(wb, sheet(summary, [46, 12, 14, 12, 16, 12, 12, 10]), 'Summary');
  const ws = sheet([[`${company} — ${title}`], [], header, ...entriesAoa], header.map((h, i) => (i === 0 ? 12 : i === header.length - 1 ? 30 : Math.max(9, Math.min(22, h.length + 2)))));
  ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: 2 + entriesAoa.length, c: header.length - 1 } }) };
  ws['!freeze'] = { xSplit: 0, ySplit: 3 };
  X.utils.book_append_sheet(wb, ws, 'Entries');
  if (stage === 'cut') {
    const open = openBatches(entries);
    X.utils.book_append_sheet(wb, sheet([[`Rolls waiting to be cut — as of ${nice(today())}`], [],
      ['Batch', 'Extruded on', 'Customer', 'Product', 'Size (cm)', 'Thickness', 'Colour', 'Rolls left', 'Kg left'],
      ...open.map(({ e, leftKg, leftRolls }) => [e.batch, parse(e.date), e.customer, e.product, e.size, e.thick, e.colour, leftRolls, leftKg])],
    [12, 12, 22, 22, 10, 12, 10, 10, 10]), 'Rolls waiting');
  }
  return wb;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function fileName({ stage, kind, range: [s], customer, ext }) {
  const stamp = kind === 'day' ? s : kind === 'week' ? `week-${s}` : kind === 'month' ? s.slice(0, 7) : `from-${s}`;
  const k = { day: 'daily', week: 'weekly', month: 'monthly' }[kind] || 'custom';
  return `${STAGES[stage].file}-${k}-${stamp}${customer ? '-' + customer.replace(/[^\w]+/g, '-') : ''}.${ext}`;
}

export async function downloadExcel(opts) {
  const X = await loadXlsx();
  const buf = X.write(buildWorkbook(X, opts), { bookType: 'xlsx', type: 'array', cellDates: true });
  const name = fileName({ ...opts, ext: 'xlsx' });
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  return name;
}

export function downloadCsv({ rows, stage, kind, range, customer }) {
  const head = ['Date', 'Batch', 'Shift', 'Worker', 'Machine', 'Customer', 'Order', 'Product', 'Size', 'Thickness', 'Colour', 'Printing', 'Rolls', 'In (kg)', 'Out (kg)', 'Pieces', 'Packets', 'Waste (kg)', 'Waste %', 'Notes'];
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [head, ...rows.map((e) => [e.date, e.batch, e.shift, e.worker, e.machine, e.customer, e.order, e.product, e.size, e.thick, e.colour, e.print, e.rolls, inKgOf(e), e.outKg, e.pieces ?? '', e.bundles ?? '', wasteOf(e), pct(wasteOf(e), inKgOf(e)), e.notes])];
  const name = fileName({ stage, kind, range, customer, ext: 'csv' });
  saveBlob(new Blob(['﻿' + lines.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }), name);
  return name;
}
