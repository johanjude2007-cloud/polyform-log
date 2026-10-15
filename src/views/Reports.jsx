// Reports per stage: any day, week, month or custom range; totals against the previous period,
// a daily chart, breakdowns, the full entry table, and Excel / CSV / print.
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Factory, FileSpreadsheet, FileText, Package, Pencil, Printer, Scale, Scissors, Search, Trash2, Layers } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { useApp } from '../App.jsx';
import { ComboChart, Confirm, Empty, HBars, MixBar, Seg, Sheet, Stat, useToast, matColour } from '../components/ui.jsx';
import { STAGES, addDays, daysBetween, fmt, groupBy, inKgOf, inRange, isFlagged, nice, pct, previousRange, range, rangeLabel, relDay, short, specLine, stageOf, today, totalsOf, wasteOf, wastePctOf } from '../lib/data.js';
import { downloadCsv, downloadExcel } from '../lib/excel.js';

export default function Reports() {
  const { entries, lists, settings } = useStore();
  const { stage, openEntry } = useApp();
  const toast = useToast();
  const S = STAGES[stage];
  const [kind, setKind] = useState('week');
  const [anchor, setAnchor] = useState(today());
  const [custom, setCustom] = useState([addDays(today(), -13), today()]);
  const [customer, setCustomer] = useState('');
  const [breakdown, setBreakdown] = useState('worker');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: -1 });

  const rg = kind === 'custom' ? (custom[0] <= custom[1] ? custom : [custom[1], custom[0]]) : range(kind, anchor, settings.weekStart);
  const prevFull = kind === 'custom' ? [addDays(rg[0], -(daysBetween(rg[0], rg[1]) + 1)), addDays(rg[0], -1)] : previousRange(kind, rg);
  // A period still in progress is compared with the same number of days of the one before.
  const prevRg = rg[1] > today() ? [prevFull[0], [addDays(prevFull[0], Math.max(0, daysBetween(rg[0], today()))), prevFull[1]].sort()[0]] : prevFull;
  const rows = useMemo(() => inRange(entries, rg, { stage, customer }), [entries, rg[0], rg[1], stage, customer]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => totalsOf(inRange(entries, prevRg, { stage, customer })), [entries, prevRg[0], prevRg[1], stage, customer]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = totalsOf(rows);
  const title = kind === 'custom' ? `${short(rg[0])} – ${nice(rg[1])}` : rangeLabel(kind, rg);
  const delta = (a, b) => (b ? ((a - b) / b) * 100 : null);
  const step = (dir) => setAnchor(kind === 'day' ? addDays(anchor, dir) : kind === 'week' ? addDays(anchor, 7 * dir) : (() => { const d = new Date(anchor); d.setDate(1); d.setMonth(d.getMonth() + dir); return d.toISOString().slice(0, 10); })());
  const isCurrent = kind !== 'custom' && rg[1] >= today();

  const daily = useMemo(() => {
    const n = daysBetween(rg[0], rg[1]) + 1;
    if (n < 2) return null;
    const by = groupBy(rows, (e) => e.date);
    return Array.from({ length: n }, (_, i) => {
      const d = addDays(rg[0], i); const tt = totalsOf(by.get(d) || []);
      return { d, label: n > 10 ? nice(d, { day: 'numeric' }) : nice(d, { weekday: 'short' }), out: tt.outKg, waste: tt.inKg ? tt.wastePct : null, pieces: tt.pieces, count: tt.count };
    });
  }, [rows, rg[0], rg[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const breakdownRows = useMemo(() => {
    const keyFn = { worker: (e) => e.worker, machine: (e) => e.machine, customer: (e) => e.customer, product: (e) => `${e.product} ${e.size}`, shift: (e) => `${e.shift} shift` }[breakdown];
    return [...groupBy(rows, (e) => keyFn(e) || '—')].map(([k, list]) => {
      const tt = totalsOf(list);
      return { label: k, value: stage === 'cut' && breakdown !== 'worker' && breakdown !== 'machine' ? tt.pieces : tt.outKg, display: stage === 'cut' && breakdown !== 'worker' && breakdown !== 'machine' ? `${fmt(tt.pieces, 0)} pcs` : `${fmt(tt.outKg)} kg`, sub: `${fmt(tt.wastePct)}% waste`, flag: tt.wastePct > settings.limits[stage], title: `${list.length} entries` };
    }).sort((a, b) => b.value - a.value);
  }, [rows, breakdown, stage, settings.limits]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = ql ? rows.filter((e) => `${e.batch} ${e.worker} ${e.machine} ${e.customer} ${e.order} ${e.product} ${e.size} ${e.colour} ${e.notes}`.toLowerCase().includes(ql)) : rows;
    const val = { date: (e) => `${e.date}${String(e.createdAt || 0).padStart(15, '0')}`, batch: (e) => e.batch || '', worker: (e) => e.worker || '', customer: (e) => e.customer || '', product: (e) => `${e.product} ${e.size}`, in: inKgOf, out: (e) => Number(e.outKg) || 0, pieces: (e) => Number(e.pieces) || 0, waste: wastePctOf, rolls: (e) => Number(e.rolls) || 0 }[sort.key];
    return [...list].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [rows, q, sort]);
  const ft = totalsOf(filtered);

  async function excel(which) {
    const k = which === 'view' ? kind : which;
    const r = which === 'view' ? rg : range(which, today(), settings.weekStart);
    const c = which === 'view' ? customer : '';
    const list = which === 'view' ? rows : inRange(entries, r, { stage });
    if (!list.length) return toast(`No ${S.short.toLowerCase()} entries in that period.`, { tone: 'warn' });
    const name = await downloadExcel({ rows: list, title: (k === 'custom' ? title : rangeLabel(k, r)) + (c ? ` — ${c}` : ''), kind: k, stage, lists, entries, range: r, customer: c });
    toast(`Downloaded ${name}`);
  }
  const Th = ({ k, children, r, cls = '' }) => (
    <th className={`sortable ${r ? 'r' : ''} ${cls}`} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : k === 'date' || r ? -1 : 1 }))} aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      {children}{sort.key === k && (sort.dir > 0 ? <ArrowUp className="arrow" /> : <ArrowDown className="arrow" />)}
    </th>
  );

  return (
    <>
      <div className="large-title">
        <div><h1>{S.short} report</h1><p>{title}{customer ? ` · ${customer}` : ''}</p></div>
        <span className="grow" />
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => excel('view')}><FileSpreadsheet className="i" />Excel</button>
          <button className="btn gray" onClick={() => { if (!rows.length) return toast('Nothing to export.', { tone: 'warn' }); toast(`Downloaded ${downloadCsv({ rows, stage, kind, range: rg, customer })}`); }}><FileText className="i" />CSV</button>
          <button className="btn gray icon" onClick={() => window.print()} title="Print"><Printer className="i" /></button>
        </div>
      </div>

      <section className="card no-print">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Seg value={kind} onChange={setKind} label="Period" options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'custom', label: 'Custom' }]} />
          {kind !== 'custom' ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn gray icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft className="i" /></button>
              <input className="in" type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} style={{ width: 170, height: 40 }} aria-label="Any date in the period" />
              <button className="btn gray icon" onClick={() => step(1)} disabled={isCurrent} aria-label="Next"><ChevronRight className="i" /></button>
              {!isCurrent && <button className="btn plain sm" onClick={() => setAnchor(today())}>Today</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="in" type="date" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} style={{ width: 170, height: 40 }} aria-label="From" />
              <span className="muted">to</span>
              <input className="in" type="date" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} style={{ width: 170, height: 40 }} aria-label="To" />
            </div>
          )}
          <span style={{ flex: 1 }} />
          <select className="in" value={customer} onChange={(e) => setCustomer(e.target.value)} style={{ width: 250, height: 40 }} aria-label="Customer">
            <option value="">All customers</option>
            {[...new Set([...lists.customers, ...entries.map((e) => e.customer)])].filter(Boolean).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>Quick Excel:</span>
          {['day', 'week', 'month'].map((k) => <button key={k} className="btn tinted sm" onClick={() => excel(k)}><FileSpreadsheet className="i" style={{ width: 15 }} />{k === 'day' ? 'Today' : k === 'week' ? 'This week' : 'This month'}</button>)}
        </div>
      </section>

      <div className="stats" style={{ marginTop: 16 }}>
        {stage === 'ex' ? <>
          <Stat label="Roll weight" icon={Factory} value={fmt(t.outKg)} unit="kg" delta={delta(t.outKg, prev.outKg)} />
          <Stat label="Rolls" icon={Layers} value={fmt(t.rolls, 0)} delta={delta(t.rolls, prev.rolls)} />
          <Stat label="Material mixed" icon={Package} value={fmt(t.inKg)} unit="kg" delta={delta(t.inKg, prev.inKg)} />
          <Stat label="Extrusion waste" icon={Scale} value={fmt(t.wastePct)} unit={`% · ${fmt(t.waste)} kg`} delta={prev.inKg ? t.wastePct - prev.wastePct : null} deltaGood="down" warn={t.wastePct > settings.limits.ex} />
          <Stat label="Batches" icon={Layers} value={rows.length} delta={delta(rows.length, prev.count)} />
        </> : <>
          <Stat label="Finished bags" icon={Package} value={fmt(t.outKg)} unit="kg" delta={delta(t.outKg, prev.outKg)} />
          <Stat label="Pieces" icon={Scissors} value={fmt(t.pieces, 0)} unit="pcs" delta={delta(t.pieces, prev.pieces)} />
          <Stat label="Packets" icon={Layers} value={fmt(t.bundles, 0)} delta={delta(t.bundles, prev.bundles)} />
          <Stat label="Roll weight used" icon={Factory} value={fmt(t.inKg)} unit="kg" delta={delta(t.inKg, prev.inKg)} />
          <Stat label="Cutting waste" icon={Scale} value={fmt(t.wastePct)} unit={`% · ${fmt(t.waste)} kg`} delta={prev.inKg ? t.wastePct - prev.wastePct : null} deltaGood="down" warn={t.wastePct > settings.limits.cut} />
        </>}
      </div>

      <div className="cols" style={{ marginTop: 16 }}>
        {daily && (
          <section className="card span-12">
            <div className="card-h"><h2>Day by day</h2><span className="grow" /><div className="legend"><span><i style={{ background: 'var(--tint)' }} />{stage === 'ex' ? 'Roll kg' : 'Finished kg'}</span><span><i className="line" style={{ background: 'var(--orange-fill)' }} />Waste %</span></div></div>
            <ComboChart data={daily} series={[{ key: 'out' }]} line={{ key: 'waste' }} limit={settings.limits[stage]} height={200}
              fmtTip={(d) => <><b>{relDay(d.d)}</b><div><span>{stage === 'ex' ? 'Rolls' : 'Finished'}</span><span>{fmt(d.out)} kg</span></div>{stage === 'cut' && <div><span>Pieces</span><span>{fmt(d.pieces, 0)}</span></div>}<div><span>Waste</span><span>{d.waste == null ? '–' : `${fmt(d.waste)}%`}</span></div><div><span>Entries</span><span>{d.count}</span></div></>} />
          </section>
        )}
        <section className="card span-6">
          <div className="card-h"><h2>{stage === 'ex' ? 'Materials used' : 'Pieces by size'}</h2></div>
          {stage === 'ex'
            ? (t.inKg ? <><MixBar parts={[...new Set([...lists.materials, ...Object.keys(t.mats)])].map((n) => ({ name: n, kg: t.mats[n] || 0 }))} list={lists.materials} /><div className="sep" />
              <HBars rows={[...new Set([...lists.materials, ...Object.keys(t.mats)])].map((n) => ({ label: n, value: t.mats[n] || 0, display: `${fmt(t.mats[n] || 0)} kg`, sub: `${fmt(pct(t.mats[n] || 0, t.inKg))}%`, color: matColour(n, lists.materials) }))} /></> : <Empty title="No mixing in this period" />)
            : (rows.length ? <HBars rows={[...groupBy(rows, (e) => `${e.product} ${e.size}`)].map(([k, l]) => ({ label: k, value: totalsOf(l).pieces, display: `${fmt(totalsOf(l).pieces, 0)} pcs` })).sort((a, b) => b.value - a.value)} /> : <Empty title="Nothing cut in this period" />)}
        </section>
        <section className="card span-6">
          <div className="card-h" style={{ flexWrap: 'wrap' }}><h2>Breakdown</h2><span className="grow" />
            <select className="in" value={breakdown} onChange={(e) => setBreakdown(e.target.value)} style={{ width: 'auto', height: 34, fontSize: 14 }} aria-label="Breakdown by">
              <option value="worker">By worker</option><option value="machine">By machine</option><option value="customer">By customer</option><option value="product">By product</option><option value="shift">By shift</option>
            </select>
          </div>
          {breakdownRows.length ? <HBars rows={breakdownRows} warnAt /> : <Empty title="No entries in this period" />}
        </section>
      </div>

      <section className="card flush" style={{ marginTop: 16 }}>
        <div className="card-h" style={{ flexWrap: 'wrap', paddingBottom: 14 }}>
          <h2>Entries</h2><span className="sub">{filtered.length}{filtered.length !== rows.length ? ` of ${rows.length}` : ''}</span><span className="grow" />
          <div className="search no-print"><Search /><input className="in" placeholder="Search entries" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <Th k="date" cls="first">Date</Th><Th k="batch">Batch</Th><Th k="worker">Worker</Th><Th k="customer">Customer</Th><Th k="product">Product</Th>
                {stage === 'ex' ? <><Th k="in" r>Mix kg</Th><Th k="rolls" r>Rolls</Th><Th k="out" r>Roll kg</Th></> : <><Th k="in" r>Roll kg in</Th><Th k="out" r>Finished kg</Th><Th k="pieces" r>Pieces</Th></>}
                <Th k="waste" r cls="last">Waste</Th>
              </tr></thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} onClick={() => openEntry(e.id)} className={isFlagged(e, settings.limits) ? 'flag' : ''}>
                    <td className="first">{short(e.date)}<span className="sub">{e.shift}</span></td>
                    <td>{e.batch ? <span className="batch-no">{e.batch}</span> : <span className="faint">–</span>}</td>
                    <td>{e.worker}<span className="sub">{e.machine?.replace(/\s*\(.*\)/, '')}</span></td>
                    <td>{e.customer}{e.order && <span className="sub">{e.order}</span>}</td>
                    <td><b>{e.product} {e.size}</b><span className="sub">{specLine(e)}</span></td>
                    {stage === 'ex' ? <><td className="r">{fmt(inKgOf(e))}</td><td className="r">{fmt(e.rolls, 0)}</td><td className="r">{fmt(e.outKg)}</td></>
                      : <><td className="r">{fmt(e.inKg)}</td><td className="r">{fmt(e.outKg)}</td><td className="r">{fmt(e.pieces, 0)}</td></>}
                    <td className="r w last">{fmt(wasteOf(e))} kg<span className="sub">{fmt(wastePctOf(e))}%</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td className="first" colSpan={5}>Total · {filtered.length} entries</td>
                {stage === 'ex' ? <><td className="r">{fmt(ft.inKg)}</td><td className="r">{fmt(ft.rolls, 0)}</td><td className="r">{fmt(ft.outKg)}</td></> : <><td className="r">{fmt(ft.inKg)}</td><td className="r">{fmt(ft.outKg)}</td><td className="r">{fmt(ft.pieces, 0)}</td></>}
                <td className="r last">{fmt(ft.waste)} kg<span className="sub">{fmt(ft.wastePct)}%</span></td>
              </tr></tfoot>
            </table>
          </div>
        ) : <Empty title={q ? 'No entries match' : `No ${S.short.toLowerCase()} entries for this period`}>{q ? 'Try another search.' : 'Pick another period, or switch stage at the top.'}</Empty>}
      </section>
    </>
  );
}

export function EntrySheet({ id }) {
  const { entries, lists, settings, remove, save } = useStore();
  const { closeSheet, edit, openBatch } = useApp();
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const e = entries.find((x) => x.id === id);
  if (!e) return <Sheet title="Entry" onClose={closeSheet}><Empty title="Entry not found">It may have been deleted.</Empty></Sheet>;
  const st = stageOf(e);
  const usedBy = st === 'ex' ? entries.filter((x) => stageOf(x) === 'cut' && x.batch === e.batch).length : 0;
  const flagged = isFlagged(e, settings.limits);
  return (
    <Sheet stage={st} onClose={closeSheet} title={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{st === 'ex' ? 'Extrusion' : 'Cutting'}{e.batch && <span className="batch-no">{e.batch}</span>}{e.sample && <span className="pill demo">Demo</span>}</span>}>
      <div>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 22, letterSpacing: '-.02em' }}>{e.product} {e.size}</div>
        <div className="muted">{specLine(e)}</div>
      </div>
      <div className="kv">
        <div><span>{st === 'ex' ? 'Mixed' : 'Rolls used'}</span><b>{fmt(inKgOf(e))} kg</b></div>
        <div><span>{st === 'ex' ? 'Roll weight' : 'Finished'}</span><b>{fmt(e.outKg)} kg</b></div>
        <div style={flagged ? { background: 'var(--orange-tint)' } : undefined}><span>Waste</span><b style={flagged ? { color: 'var(--orange)' } : undefined}>{fmt(wasteOf(e))} kg · {fmt(wastePctOf(e))}%</b></div>
        <div><span>Rolls</span><b>{fmt(e.rolls, 0)}</b></div>
        {st === 'cut' && <div><span>Pieces</span><b>{fmt(e.pieces, 0)}</b></div>}
        {st === 'cut' && <div><span>Packets</span><b>{fmt(e.bundles, 0)}</b></div>}
      </div>
      {st === 'ex' && e.materials?.length > 0 && <section className="card"><div className="card-h"><h2>Mix</h2></div><MixBar parts={e.materials} list={lists.materials} />
        <div className="rows" style={{ margin: '10px -18px -8px' }}>{e.materials.map((m) => <div className="row" key={m.name}><span className="main-t">{m.name}</span><span className="end tnum"><b>{fmt(m.kg)} kg</b></span></div>)}</div></section>}
      <section className="card flush">
        <div className="rows">
          {[['Date', `${nice(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${e.shift}`], ['Worker', e.worker], ['Machine', e.machine], ['Customer', e.customer], ['Order / PO', e.order || '–'], ['Notes', e.notes || '–']].map(([k, v]) => (
            <div className="row" key={k}><span className="muted" style={{ width: 110, flex: 'none' }}>{k}</span><span className="main-t" style={{ whiteSpace: 'normal' }}>{v}</span></div>
          ))}
          {e.batch && <div className="row link" onClick={() => openBatch(e.batch)}><span className="muted" style={{ width: 110, flex: 'none' }}>Batch</span><span className="main-t"><span className="batch-no">{e.batch}</span>{usedBy ? <span className="muted"> · {usedBy} cutting jobs</span> : null}</span><ChevronRight className="chev" /></div>}
        </div>
      </section>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn lg" style={{ flex: 1 }} onClick={() => edit(e)}><Pencil className="i" />Edit</button>
        <button className="btn gray lg" onClick={() => edit(e, true)}><Copy className="i" />Copy</button>
        <button className="btn gray lg" style={{ color: 'var(--red)' }} onClick={() => setAsk(true)}><Trash2 className="i" />Delete</button>
      </div>
      {ask && <Confirm title="Delete this entry?" body={usedBy ? `${usedBy} cutting entries use batch ${e.batch}. They stay, but the batch will no longer show as waiting.` : 'You can undo this right after.'}
        onClose={() => setAsk(false)} onConfirm={async () => { closeSheet(); try { await remove(e); toast('Entry deleted.', { action: { label: 'Undo', run: () => save(e) } }); } catch (err) { if (!err.quiet) toast(err.message, { tone: 'bad' }); } }} />}
    </Sheet>
  );
}
