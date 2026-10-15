// Overview: today on the floor for both teams, the 14-day trend, the roll pipeline and what needs a look.
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Boxes, ChevronRight, Factory, Package, PenLine, Scale, Scissors, Timer } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { useApp } from '../App.jsx';
import { ComboChart, Empty, HBars, Seg, Stat } from '../components/ui.jsx';
import { addDays, batchStatus, fmt, groupBy, inRange, isFlagged, kgShort, nice, ordersOf, relDay, short, stageOf, today, totalsOf, wastePctOf } from '../lib/data.js';

export default function Overview() {
  const { entries, settings } = useStore();
  const { go, openBatch, openEntry, setStage } = useApp();
  const [days, setDays] = useState(14);
  const t = today();
  // On a day off the tiles show the last working day instead of a row of zeros.
  const kd = useMemo(() => (entries.some((e) => e.date === t) ? t : entries.reduce((m, e) => (e.date < t && e.date > m ? e.date : m), '') || t), [entries, t]);
  const pd = useMemo(() => entries.reduce((m, e) => (e.date < kd && e.date > m ? e.date : m), '') || addDays(kd, -1), [entries, kd]);
  const dayName = kd === t ? 'today' : relDay(kd).toLowerCase() === 'yesterday' ? 'yesterday' : `on ${short(kd)}`;

  const day = useMemo(() => ({
    ex: totalsOf(inRange(entries, [kd, kd], { stage: 'ex' })), cut: totalsOf(inRange(entries, [kd, kd], { stage: 'cut' })),
    exY: totalsOf(inRange(entries, [pd, pd], { stage: 'ex' })), cutY: totalsOf(inRange(entries, [pd, pd], { stage: 'cut' })),
  }), [entries, kd, pd]);

  const trend = useMemo(() => {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(t, -i);
      const ex = totalsOf(inRange(entries, [d, d], { stage: 'ex' }));
      const cut = totalsOf(inRange(entries, [d, d], { stage: 'cut' }));
      const inAll = ex.inKg + cut.inKg, wasteAll = ex.waste + cut.waste;
      out.push({ d, label: nice(d, { day: 'numeric', month: 'short' }).replace(' ', ' '), ex: ex.outKg, cut: cut.outKg, pieces: cut.pieces, waste: inAll ? Math.round((wasteAll / inAll) * 1000) / 10 : null });
    }
    return out;
  }, [entries, days, t]);

  const batches = useMemo(() => batchStatus(entries), [entries]);
  const waiting = batches.filter((b) => b.status === 'waiting');
  const partial = batches.filter((b) => b.status === 'partial');
  const doneRecent = batches.filter((b) => b.status === 'done').slice(-4).reverse();
  const waitingKg = [...waiting, ...partial].reduce((a, b) => a + b.leftKg, 0);
  const oldest = [...waiting, ...partial].reduce((m, b) => Math.max(m, b.age), 0);

  const flagged = useMemo(() => entries.filter((e) => e.date >= addDays(t, -6) && isFlagged(e, settings.limits)).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)), [entries, settings.limits, t]);
  const orders = useMemo(() => ordersOf(entries, settings.orders).filter((o) => !o.closed && o.target).slice(0, 5), [entries, settings.orders]);

  const machines = useMemo(() => {
    const rows = inRange(entries, [addDays(t, -6), t]);
    return [...groupBy(rows, (e) => e.machine || '—')].map(([m, list]) => {
      const tt = totalsOf(list); return { label: m.replace(/\s*\(.*\)/, ''), value: tt.outKg, display: kgShort(tt.outKg), sub: `${fmt(tt.wastePct)}%`, flag: tt.wastePct > settings.limits[stageOf(list[0])], color: stageOf(list[0]) === 'ex' ? 'var(--ex)' : 'var(--cut)' };
    }).sort((a, b) => b.value - a.value);
  }, [entries, settings.limits, t]);

  const lastEntry = entries.reduce((m, e) => ((e.createdAt || 0) > (m?.createdAt || 0) ? e : m), null);
  const greet = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const pctDelta = (a, b) => (kd !== t && a && b ? ((a - b) / b) * 100 : null); // a day still running is not compared

  return (
    <>
      <div className="large-title">
        <div>
          <h1>Overview</h1>
          <p>{greet} · {nice(t, { weekday: 'long', day: 'numeric', month: 'long' })}{lastEntry ? ` · last entry ${relDay(lastEntry.date).toLowerCase()} by ${lastEntry.worker}` : ''}</p>
        </div>
        <span className="grow" />
        <div className="title-actions">
        <button className="btn" data-stage="ex" style={{ '--b': 'var(--ex)', color: 'var(--ex-ink)' }} onClick={() => { setStage('ex'); go('log'); }}><Factory className="i" />Log extrusion</button>
        <button className="btn" style={{ '--b': 'var(--cut)', color: 'var(--cut-ink)' }} onClick={() => { setStage('cut'); go('log'); }}><Scissors className="i" />Log cutting</button>
        </div>
      </div>

      <div className="stats">
        <Stat label={`Extruded ${dayName}`} icon={Factory} value={fmt(day.ex.outKg)} unit="kg" delta={pctDelta(day.ex.outKg, day.exY.outKg)} spark={trend.slice(-10).map((d) => d.ex)} sparkClass="ex" />
        <Stat label={`Bags cut ${dayName}`} icon={Scissors} value={fmt(day.cut.pieces, 0)} unit="pcs" delta={pctDelta(day.cut.pieces, day.cutY.pieces)} spark={trend.slice(-10).map((d) => d.pieces)} sparkClass="cut" />
        <Stat label={`Waste ${dayName}`} icon={Scale} value={fmt(pctOf(day))} unit="%" warn={pctOf(day) > Math.max(settings.limits.ex, settings.limits.cut)} />
        <Stat label="Rolls waiting to cut" icon={Boxes} value={kgShort(waitingKg).replace(/ (kg|t)$/, '')} unit={waitingKg >= 10000 ? 't' : 'kg'} />
      </div>

      <div className="cols" style={{ marginTop: 16 }}>
        <section className="card span-8">
          <div className="card-h">
            <h2>Output and waste</h2><span className="grow" />
            <Seg value={days} onChange={setDays} options={[{ value: 14, label: '14 days' }, { value: 30, label: '30 days' }]} label="Range" />
          </div>
          <ComboChart grouped data={trend} series={[{ key: 'ex', cls: 'ex' }, { key: 'cut', cls: 'cut' }]} line={{ key: 'waste' }} limit={settings.limits.ex}
            fmtTip={(d) => <><b>{relDay(d.d)}</b><div><span>Extruded</span><span>{fmt(d.ex)} kg</span></div><div><span>Cut</span><span>{fmt(d.cut)} kg</span></div><div><span>Pieces</span><span>{fmt(d.pieces, 0)}</span></div><div><span>Waste</span><span>{d.waste == null ? '–' : `${fmt(d.waste)}%`}</span></div></>} />
          <div className="legend" style={{ marginTop: 10 }}>
            <span><i style={{ background: 'var(--ex)' }} />Extruded kg</span><span><i style={{ background: 'var(--cut)' }} />Finished kg</span>
            <span><i className="line" style={{ background: 'var(--orange-fill)' }} />Waste %</span><span><i className="line" style={{ background: 'var(--red-fill)', opacity: 0.7 }} />{settings.limits.ex}% limit</span>
          </div>
        </section>

        <section className="card span-4">
          <div className="card-h"><h2>Needs a look</h2><span className="grow" /><span className="sub">last 7 days</span></div>
          {flagged.length || oldest >= 3 ? (
            <div className="rows" style={{ margin: '0 -18px' }}>
              {oldest >= 3 && (
                <div className="row link" onClick={() => go('batches')}>
                  <span className="ico warn"><Timer /></span>
                  <div className="main-t"><b>Rolls waiting {oldest} days</b><span>Oldest batch not yet cut</span></div><ChevronRight className="chev" />
                </div>
              )}
              {flagged.slice(0, 5).map((e) => (
                <div className="row link" key={e.id} onClick={() => openEntry(e.id)}>
                  <span className={`ico ${stageOf(e)}`}>{stageOf(e) === 'ex' ? <Factory /> : <Scissors />}</span>
                  <div className="main-t"><b>{fmt(wastePctOf(e))}% waste · {e.batch || e.product}</b><span>{relDay(e.date)} · {e.worker} · {e.machine}</span></div>
                  <ChevronRight className="chev" />
                </div>
              ))}
            </div>
          ) : <Empty icon={AlertTriangle} title="All clear">No high-waste entries this week.</Empty>}
        </section>

        <section className="card span-12">
          <div className="card-h"><h2>Roll pipeline</h2><span className="sub">{waiting.length + partial.length} batches · {kgShort(waitingKg)} to cut</span><span className="grow" /><button className="btn plain sm" onClick={() => go('batches')}>All batches<ArrowRight className="i" style={{ width: 15 }} /></button></div>
          <div className="pipe">
            <PipeCol title="Waiting to cut" list={waiting.slice().reverse()} onOpen={openBatch} tone="ex" />
            <PipeCol title="Cutting in progress" list={partial.slice().reverse()} onOpen={openBatch} tone="cut" />
            <PipeCol title="Recently finished" list={doneRecent} onOpen={openBatch} tone="ok" />
          </div>
        </section>

        <section className="card span-6">
          <div className="card-h"><h2>Machines this week</h2><span className="grow" /><span className="sub">output · waste</span></div>
          {machines.length ? <HBars rows={machines} warnAt /> : <Empty title="No entries this week" />}
        </section>

        <section className="card span-6">
          <div className="card-h"><h2>Open orders</h2><span className="grow" /><button className="btn plain sm" onClick={() => go('orders')}>All orders<ArrowRight className="i" style={{ width: 15 }} /></button></div>
          {orders.length ? (
            <div className="rows" style={{ margin: '0 -18px' }}>
              {orders.map((o) => (
                <div className="row link" key={o.po} onClick={() => go('orders')}>
                  <span className={`ico ${o.state === 'late' ? 'warn' : o.state === 'ready' ? 'ok' : ''}`}><Package /></span>
                  <div className="main-t"><b>{o.po} · {o.customer}</b>
                    <div className={`progress ${o.state === 'ready' ? 'ok' : o.state === 'late' ? 'late' : ''}`} style={{ marginTop: 6, '--tint': 'var(--cut)' }}><span style={{ width: `${(o.progress || 0) * 100}%` }} /></div>
                  </div>
                  <div className="end"><b>{Math.round((o.progress || 0) * 100)}%</b><span>{o.due ? `due ${short(o.due)}` : ''}</span></div>
                </div>
              ))}
            </div>
          ) : <Empty icon={Package} title="No targets set">Add target quantities on the Orders page to track progress.</Empty>}
        </section>
      </div>

      {!entries.length && <Empty icon={PenLine} title="No entries yet" action={<button className="btn" onClick={() => go('log')}>Add the first entry</button>} />}
    </>
  );
}

function pctOf(day) {
  const inKg = day.ex.inKg + day.cut.inKg; const w = day.ex.waste + day.cut.waste;
  return inKg ? Math.round((w / inKg) * 1000) / 10 : 0;
}

function PipeCol({ title, list, onOpen, tone }) {
  const show = list.slice(0, 4);
  return (
    <div className="pipe-col">
      <h3><span className={`stage-dot`} style={{ background: tone === 'ex' ? 'var(--ex)' : tone === 'cut' ? 'var(--cut)' : 'var(--green)' }} />{title}<b>{list.length}</b></h3>
      {show.map((b) => (
        <button type="button" className="pipe-card" key={b.e.batch} onClick={() => onOpen(b.e.batch)}>
          <div className="top"><span className="batch-no">{b.e.batch}</span><span>{relDay(b.e.date)}</span></div>
          <b>{b.e.product} {b.e.size}</b>
          <div className="top"><span>{b.e.customer}</span><span className="tnum" style={{ color: 'var(--label)', fontWeight: 600 }}>{tone === 'ok' ? `${fmt(b.pieces, 0)} pcs` : `${fmt(b.leftKg)} kg`}</span></div>
          {tone === 'cut' && <div className="progress" style={{ '--tint': 'var(--cut)' }}><span style={{ width: `${Math.min(100, (b.usedKg / (Number(b.e.outKg) || 1)) * 100)}%` }} /></div>}
        </button>
      ))}
      {list.length > show.length && <div className="pipe-more">+{list.length - show.length} more</div>}
      {!list.length && <div className="pipe-more">Nothing here</div>}
    </div>
  );
}
