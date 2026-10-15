// Domain model: the two procedures, default lists, dates, demo data and the sums every screen shares.

export const STAGES = {
  ex: { key: 'ex', name: 'Extrusion & rolling', short: 'Extrusion', verb: 'Extruded', file: 'extrusion', workers: 'exWorkers', machines: 'exMachines', inLabel: 'Material mixed', outLabel: 'Roll weight' },
  cut: { key: 'cut', name: 'Cutting & finishing', short: 'Cutting', verb: 'Cut', file: 'cutting', workers: 'cutWorkers', machines: 'cutMachines', inLabel: 'Roll weight used', outLabel: 'Finished bags' },
};
export const stageOf = (e) => (e.stage === 'cut' ? 'cut' : 'ex'); // entries from before the split were extrusion

export const DEFAULT_LISTS = {
  exWorkers: ['Rahim Uddin', 'Suresh Kumar', 'Anwar Hossain', 'Biju Varghese'],
  exMachines: ['Extruder EX-1 (55 mm)', 'Extruder EX-2 (55 mm)', 'Extruder EX-3 (65 mm)'],
  cutWorkers: ['Joseph Mathew', 'Imran Khan', 'Faisal Ahmed', 'Ramesh Pillai'],
  cutMachines: ['Bottom seal CS-1', 'Bottom seal CS-2', 'T-shirt bag CS-3', 'D-cut punch CS-4'],
  customers: ['Najm Cleaning Services LLC', 'Pearl Bay Hotels & Resorts', 'Golden Dune Waste Services', 'Al Rimal Hypermarket', 'Al Safa Medical Centre', 'Swift Parcel Couriers'],
  products: ['Garbage bag', 'Carry bag (T-shirt)', 'Shopping bag (D-cut)', 'Shrink film', 'LDPE roll', 'Courier bag'],
  sizes: ['95 × 120', '90 × 110', '80 × 100', '65 × 90', '50 × 60', '45 × 55', '30 × 40'],
  thickness: ['20 micron', '25 micron', '30 micron', '40 micron', '50 micron', '60 micron', '80 micron'],
  colours: ['Black', 'Natural', 'White', 'Blue', 'Green', 'Yellow', 'Red'],
  printing: ['Plain', '1-colour print', '2-colour print'],
  materials: ['Black LD', 'Mix LD', 'Filler', 'Master batch', 'Desiccant'],
};
export const LIST_GROUPS = [
  { title: 'Extrusion team', keys: { exWorkers: 'Workers', exMachines: 'Machines', materials: 'Materials' } },
  { title: 'Cutting team', keys: { cutWorkers: 'Workers', cutMachines: 'Machines' } },
  { title: 'Both teams', keys: { customers: 'Customers', products: 'Products', sizes: 'Sizes (W × L, cm)', thickness: 'Thickness', colours: 'Colours', printing: 'Printing' } },
];
export const DEFAULT_RECIPES = [
  { id: 'r-black-heavy', name: 'Black heavy-duty', mats: { 'Black LD': 60, 'Mix LD': 20, Filler: 15, 'Master batch': 3, Desiccant: 2 } },
  { id: 'r-black-std', name: 'Black standard', mats: { 'Black LD': 50, 'Mix LD': 30, Filler: 18, Desiccant: 2 } },
  { id: 'r-colour', name: 'Coloured bag', mats: { 'Mix LD': 80, Filler: 14, 'Master batch': 4, Desiccant: 2 } },
  { id: 'r-clear', name: 'Natural / print', mats: { 'Mix LD': 92, Filler: 8 } },
];
export const DEFAULT_LIMITS = { ex: 5, cut: 4 }; // waste % above which an entry is flagged
export const SETTINGS_VERSION = 5;

// ------------------------------------------------------------ numbers
export const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
export const fmt = (n, d = 1) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
export const kgShort = (n) => (Math.abs(n) >= 10000 ? `${fmt(n / 1000, 1)} t` : `${fmt(n)} kg`);

// ------------------------------------------------------------ dates
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export function range(kind, anchor, weekStart = 1) {
  const d = parse(anchor);
  if (kind === 'day') return [anchor, anchor];
  if (kind === 'week') { const back = (d.getDay() - weekStart + 7) % 7; const s = addDays(anchor, -back); return [s, addDays(s, 6)]; }
  return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
}
export function previousRange(kind, [s, e]) {
  if (kind === 'month') { const d = parse(s); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))]; }
  const n = daysBetween(s, e) + 1;
  return [addDays(s, -n), addDays(e, -n)];
}
export const nice = (s, opt = { day: 'numeric', month: 'short', year: 'numeric' }) => parse(s).toLocaleDateString('en-GB', opt);
export const short = (s) => nice(s, { day: 'numeric', month: 'short' });
export function rangeLabel(kind, [s, e]) {
  if (kind === 'day') return nice(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (kind === 'month') return parse(s).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return `${nice(s, { day: 'numeric', month: 'short' })} – ${nice(e)}`;
}
export function relDay(s) {
  const n = daysBetween(s, today());
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n > 1 && n < 7) return nice(s, { weekday: 'long' });
  return short(s);
}
export const currentShift = () => { const h = new Date().getHours(); return h >= 19 || h < 7 ? 'Night' : 'Day'; };
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ------------------------------------------------------------ sums
export const inKgOf = (e) => (stageOf(e) === 'ex' ? r1((e.materials || []).reduce((a, m) => a + (Number(m.kg) || 0), 0)) : r1(e.inKg));
export const wasteOf = (e) => r1(inKgOf(e) - (Number(e.outKg) || 0));
export const wastePctOf = (e) => pct(wasteOf(e), inKgOf(e));
export const isFlagged = (e, limits) => { const w = wastePctOf(e); return w < 0 || w > (limits?.[stageOf(e)] ?? DEFAULT_LIMITS[stageOf(e)]); };
export const specLine = (e) => [e.thick, e.colour, e.print].filter(Boolean).join(' · ');

export function totalsOf(rows) {
  const mats = {}; let inKg = 0, outKg = 0, pieces = 0, bundles = 0, rolls = 0;
  for (const e of rows) {
    for (const m of e.materials || []) mats[m.name] = (mats[m.name] || 0) + (Number(m.kg) || 0);
    inKg += inKgOf(e); outKg += Number(e.outKg) || 0; pieces += Number(e.pieces) || 0; bundles += Number(e.bundles) || 0; rolls += Number(e.rolls) || 0;
  }
  return { mats, inKg: r1(inKg), outKg: r1(outKg), pieces, bundles, rolls, waste: r1(inKg - outKg), wastePct: pct(inKg - outKg, inKg), count: rows.length };
}
export const inRange = (entries, [s, e], { stage, customer } = {}) => entries
  .filter((x) => (!stage || stageOf(x) === stage) && x.date >= s && x.date <= e && (!customer || x.customer === customer))
  .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));

export function groupBy(rows, keyFn) {
  const m = new Map();
  for (const e of rows) { const k = keyFn(e); if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
  return m;
}

// Extrusion batches and how much of each the cutting team has used.
export function batchStatus(entries, exceptId) {
  const used = new Map();
  for (const e of entries) {
    if (stageOf(e) !== 'cut' || !e.batch || e.id === exceptId) continue;
    const u = used.get(e.batch) || { kg: 0, rolls: 0, jobs: [] };
    u.kg += Number(e.inKg) || 0; u.rolls += Number(e.rolls) || 0; u.jobs.push(e); used.set(e.batch, u);
  }
  return entries.filter((e) => stageOf(e) === 'ex' && e.batch).map((e) => {
    const u = used.get(e.batch) || { kg: 0, rolls: 0, jobs: [] };
    const leftKg = r1((Number(e.outKg) || 0) - u.kg);
    const leftRolls = Math.max(0, (Number(e.rolls) || 0) - u.rolls);
    const open = leftKg > 0.5 && leftRolls > 0;
    const status = !u.jobs.length ? 'waiting' : open ? 'partial' : 'done';
    const finished = u.jobs.reduce((a, j) => a + (Number(j.outKg) || 0), 0);
    const pieces = u.jobs.reduce((a, j) => a + (Number(j.pieces) || 0), 0);
    return { e, leftKg, leftRolls, open, status, jobs: u.jobs.sort((a, b) => a.date.localeCompare(b.date)), usedKg: r1(u.kg), finished: r1(finished), pieces, age: daysBetween(e.date, today()) };
  }).sort((a, b) => a.e.date.localeCompare(b.e.date) || a.e.batch.localeCompare(b.e.batch));
}
export const openBatches = (entries, exceptId) => batchStatus(entries, exceptId).filter((b) => b.open);

export function nextBatchNo(entries, date) {
  const base = `E${date.slice(8, 10)}${date.slice(5, 7)}-`;
  const taken = new Set(entries.filter((e) => stageOf(e) === 'ex').map((e) => e.batch));
  let n = entries.filter((e) => stageOf(e) === 'ex' && e.date === date).length + 1;
  while (taken.has(base + pad(n))) n++;
  return base + pad(n);
}

// Orders: every PO number typed on an entry, with what each stage has produced for it.
export function ordersOf(entries, targets = {}) {
  const m = new Map();
  for (const e of entries) {
    if (!e.order) continue;
    const o = m.get(e.order) || { po: e.order, customer: e.customer, product: e.product, size: e.size, spec: specLine(e), extrudedKg: 0, finishedKg: 0, pieces: 0, bundles: 0, first: e.date, last: e.date, entries: [] };
    if (stageOf(e) === 'ex') o.extrudedKg += Number(e.outKg) || 0;
    else { o.finishedKg += Number(e.outKg) || 0; o.pieces += Number(e.pieces) || 0; o.bundles += Number(e.bundles) || 0; }
    if (e.date < o.first) o.first = e.date;
    if (e.date > o.last) o.last = e.date;
    o.entries.push(e); m.set(e.order, o);
  }
  for (const [po, t] of Object.entries(targets)) if (!m.has(po)) m.set(po, { po, customer: t.customer || '', product: t.product || '', size: t.size || '', spec: '', extrudedKg: 0, finishedKg: 0, pieces: 0, bundles: 0, first: null, last: null, entries: [] });
  return [...m.values()].map((o) => {
    const t = targets[o.po] || {};
    const target = Number(t.pieces) || 0;
    const progress = target ? Math.min(1, o.pieces / target) : null;
    const state = t.closed ? 'closed' : target && o.pieces >= target ? 'ready' : t.due && t.due < today() ? 'late' : 'open';
    return { ...o, extrudedKg: r1(o.extrudedKg), finishedKg: r1(o.finishedKg), target, due: t.due || '', closed: !!t.closed, progress, state };
  }).sort((a, b) => (a.closed - b.closed) || (b.last || '').localeCompare(a.last || ''));
}

// ------------------------------------------------------------ demo data
// Extrusion batches every working day; the cutting team cuts most of them the
// same or next day, so the last few batches are still waiting to be cut.
export function sampleEntries() {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const L = DEFAULT_LISTS, out = [];
  const recipes = [
    { w: 30, product: 'Garbage bag', size: '95 × 120', thick: '40 micron', colour: 'Black', mats: { 'Black LD': 60, 'Mix LD': 20, Filler: 15, 'Master batch': 3, Desiccant: 2 }, gPerPc: 112, perPack: 50, cust: ['Najm Cleaning Services LLC', 'Golden Dune Waste Services', 'Pearl Bay Hotels & Resorts'] },
    { w: 14, product: 'Garbage bag', size: '90 × 110', thick: '40 micron', colour: 'Black', mats: { 'Black LD': 55, 'Mix LD': 25, Filler: 15, 'Master batch': 3, Desiccant: 2 }, gPerPc: 96, perPack: 50, cust: ['Golden Dune Waste Services', 'Najm Cleaning Services LLC'] },
    { w: 12, product: 'Garbage bag', size: '80 × 100', thick: '30 micron', colour: 'Black', mats: { 'Black LD': 50, 'Mix LD': 30, Filler: 18, Desiccant: 2 }, gPerPc: 62, perPack: 50, cust: ['Pearl Bay Hotels & Resorts', 'Najm Cleaning Services LLC'] },
    { w: 8, product: 'Garbage bag', size: '65 × 90', thick: '25 micron', colour: 'Green', mats: { 'Mix LD': 75, Filler: 20, 'Master batch': 3, Desiccant: 2 }, gPerPc: 38, perPack: 100, cust: ['Pearl Bay Hotels & Resorts', 'Najm Cleaning Services LLC'] },
    { w: 8, product: 'Garbage bag', size: '50 × 60', thick: '30 micron', colour: 'Yellow', mats: { 'Mix LD': 82, Filler: 12, 'Master batch': 4, Desiccant: 2 }, gPerPc: 22, perPack: 100, cust: ['Al Safa Medical Centre'] },
    { w: 6, product: 'Garbage bag', size: '90 × 110', thick: '50 micron', colour: 'Red', mats: { 'Mix LD': 80, Filler: 14, 'Master batch': 4, Desiccant: 2 }, gPerPc: 120, perPack: 25, cust: ['Al Safa Medical Centre'] },
    { w: 10, product: 'Carry bag (T-shirt)', size: '45 × 55', thick: '20 micron', colour: 'White', mats: { 'Mix LD': 80, Filler: 17, 'Master batch': 3 }, gPerPc: 11, perPack: 500, print: ['Plain', '1-colour print'], cust: ['Al Rimal Hypermarket'] },
    { w: 6, product: 'Shopping bag (D-cut)', size: '30 × 40', thick: '50 micron', colour: 'Natural', mats: { 'Mix LD': 92, Filler: 8 }, gPerPc: 14, perPack: 200, print: ['1-colour print', '2-colour print'], cust: ['Al Rimal Hypermarket', 'Pearl Bay Hotels & Resorts'] },
    { w: 6, product: 'Courier bag', size: '30 × 40', thick: '60 micron', colour: 'White', mats: { 'Mix LD': 85, Filler: 10, 'Master batch': 5 }, gPerPc: 18, perPack: 100, print: ['2-colour print'], cust: ['Swift Parcel Couriers'] },
  ];
  const totalW = recipes.reduce((a, r) => a + r.w, 0);
  const pickRecipe = () => { let x = rnd() * totalW; return recipes.find((r) => (x -= r.w) < 0) || recipes[0]; };
  const exNotes = ['Die cleaned, 20 min stop', 'Power cut 15 min', 'Colour change, purged 8 kg', 'Thickness checked every roll', 'Screen changer cleaned', 'New master batch lot'];
  const cutNotes = ['Sealing blade changed', 'Customer wants 50 per packet', 'Size checked', 'Some rolls had uneven edges', 'Packed for urgent dispatch', 'Perforation adjusted'];
  const cutMachineFor = (rc) => (rc.product.startsWith('Carry') ? L.cutMachines[2] : rc.product.startsWith('Shopping') ? L.cutMachines[3] : pick(L.cutMachines.slice(0, 2)));
  const nextWorkday = (d) => { let n = addDays(d, 1); if (parse(n).getDay() === 5) n = addDays(n, 1); return n; };
  const orders = new Map();
  for (let back = 60; back >= 0; back--) {
    const date = addDays(today(), -back);
    if (parse(date).getDay() === 5) continue; // Friday off
    const n = 3 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) {
      const rc = pickRecipe();
      const night = k >= 2;
      const mixKg = 200 + Math.floor(rnd() * 9) * 25;
      const materials = Object.entries(rc.mats).map(([name, p]) => ({ name, kg: r1((mixKg * p) / 100 * (0.96 + rnd() * 0.08)) }));
      const inKg = materials.reduce((a, m) => a + m.kg, 0);
      const trouble = rnd() < 0.08;
      const rollKg = r1(inKg * (trouble ? 0.9 + rnd() * 0.03 : 0.962 + rnd() * 0.025));
      const rolls = Math.max(2, Math.round(rollKg / 25));
      const batch = `E${date.slice(8, 10)}${date.slice(5, 7)}-${pad(k + 1)}`;
      const customer = pick(rc.cust);
      const po = orders.get(customer);
      const order = po && po.until >= back ? po.no : rnd() < 0.7 ? 'PO-' + (2200 + Math.floor(rnd() * 400)) : '';
      if (order && (!po || po.no !== order)) orders.set(customer, { no: order, until: back - 4 });
      const spec = { customer, order, product: rc.product, size: rc.size, thick: rc.thick, colour: rc.colour, print: rc.print ? pick(rc.print) : 'Plain' };
      const t0 = parse(date).getTime() + (7 + k * 3) * 3600e3;
      out.push({ id: `sx${date.replace(/-/g, '')}${k}`, sample: true, stage: 'ex', batch, date, shift: night ? 'Night' : 'Day',
        worker: night ? L.exWorkers[2] : pick(L.exWorkers.slice(0, 2)), machine: L.exMachines[k % 3], ...spec, materials, rolls, outKg: rollKg,
        notes: trouble ? pick(exNotes.slice(0, 3)) : rnd() < 0.1 ? pick(exNotes.slice(3)) : '', createdAt: t0 });
      const cutDate = k === 0 ? date : nextWorkday(date);
      if (cutDate > today() || (back === 0 && k > 0) || (back === 1 && k === n - 1)) continue;
      const cutTrouble = rnd() < 0.06;
      const finKg = r1(rollKg * (cutTrouble ? 0.93 + rnd() * 0.02 : 0.968 + rnd() * 0.018));
      const pieces = Math.round((finKg * 1000) / rc.gPerPc / 10) * 10;
      out.push({ id: `sc${date.replace(/-/g, '')}${k}`, sample: true, stage: 'cut', batch, date: cutDate, shift: night ? 'Night' : 'Day',
        worker: night ? L.cutWorkers[2] : pick([L.cutWorkers[0], L.cutWorkers[1], L.cutWorkers[3]]), machine: cutMachineFor(rc), ...spec, rolls, inKg: rollKg, outKg: finKg,
        pieces, bundles: Math.ceil(pieces / rc.perPack), notes: cutTrouble ? cutNotes[3] : rnd() < 0.12 ? pick(cutNotes) : '', createdAt: t0 + 6 * 3600e3 });
    }
  }
  return out;
}

// Demo order targets: recent POs get a target a little above what has been cut so far.
export function demoTargets(entries) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const t = {};
  for (const o of ordersOf(entries)) {
    if (!o.last || daysBetween(o.last, today()) > 12 || !o.pieces) continue;
    const ahead = rnd();
    t[o.po] = { pieces: Math.round((o.pieces * (ahead < 0.25 ? 0.95 : 1.1 + rnd() * 0.8)) / 1000) * 1000 || 1000, due: addDays(o.last, Math.round(2 + rnd() * 8) - (ahead > 0.9 ? 9 : 0)), sample: true };
  }
  return t;
}
