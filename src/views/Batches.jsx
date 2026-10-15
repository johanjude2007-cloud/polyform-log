// Batches: every extrusion batch with where it stands, and a trace sheet from mix to finished bags.
import { useMemo, useState } from 'react';
import { Boxes, CheckCircle2, Factory, Pencil, Scissors, Search } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { useApp } from '../App.jsx';
import { Empty, MixBar, Seg, Sheet } from '../components/ui.jsx';
import { batchStatus, fmt, inKgOf, kgShort, pct, relDay, short, specLine } from '../lib/data.js';

const STATUS = { waiting: ['Waiting', 'ex'], partial: ['Cutting', 'cut'], done: ['Finished', 'ok'] };
export const StatusPill = ({ s }) => <span className={`pill ${STATUS[s][1]}`}>{STATUS[s][0]}</span>;

export default function Batches() {
  const { entries } = useStore();
  const { openBatch } = useApp();
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const all = useMemo(() => batchStatus(entries).reverse(), [entries]);
  const rows = all.filter((b) => (filter === 'all' || (filter === 'open' ? b.open : b.status === 'done'))
    && (!q || `${b.e.batch} ${b.e.customer} ${b.e.product} ${b.e.size} ${b.e.order} ${b.e.colour}`.toLowerCase().includes(q.toLowerCase())));
  const openList = all.filter((b) => b.open);
  const openKg = openList.reduce((a, b) => a + b.leftKg, 0);

  return (
    <>
      <div className="large-title">
        <div><h1>Batches</h1><p>{openList.length} batches waiting · {kgShort(openKg)} of rolls to cut</p></div>
      </div>
      <section className="card flush">
        <div className="card-h" style={{ flexWrap: 'wrap', paddingBottom: 14 }}>
          <Seg value={filter} onChange={setFilter} label="Show" options={[{ value: 'open', label: `To cut · ${openList.length}` }, { value: 'done', label: 'Finished' }, { value: 'all', label: 'All' }]} />
          <span className="grow" />
          <div className="search"><Search /><input className="in" placeholder="Batch, customer, PO…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th className="first">Batch</th><th>Extruded</th><th>Customer</th><th>Product</th><th className="r">Rolls kg</th><th className="r">Cut kg</th><th className="r">Left</th><th style={{ width: 140 }}>Progress</th><th className="last">Status</th></tr></thead>
              <tbody>
                {rows.slice(0, 300).map((b) => (
                  <tr key={b.e.batch} onClick={() => openBatch(b.e.batch)}>
                    <td className="first"><span className="batch-no">{b.e.batch}</span></td>
                    <td>{relDay(b.e.date)}<span className="sub">{b.e.shift} · {b.e.machine?.replace(/\s*\(.*\)/, '')}</span></td>
                    <td>{b.e.customer}{b.e.order && <span className="sub">{b.e.order}</span>}</td>
                    <td><b>{b.e.product} {b.e.size}</b><span className="sub">{specLine(b.e)}</span></td>
                    <td className="r">{fmt(b.e.outKg)}</td>
                    <td className="r">{fmt(b.usedKg)}</td>
                    <td className="r">{b.open ? <><b>{fmt(b.leftKg)} kg</b><span className="sub">{b.leftRolls} rolls</span></> : <span className="faint">–</span>}</td>
                    <td><div className={`progress ${b.status === 'done' ? 'ok' : ''}`} style={{ '--tint': 'var(--cut)' }}><span style={{ width: `${Math.min(100, (b.usedKg / (Number(b.e.outKg) || 1)) * 100)}%` }} /></div></td>
                    <td className="last"><StatusPill s={b.status} />{b.open && b.age >= 3 && <span className="pill warn" style={{ marginLeft: 6 }}>{b.age}d</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={filter === 'open' ? CheckCircle2 : Boxes} title={filter === 'open' && !q ? 'All rolls are cut' : 'No batches match'}>{filter === 'open' && !q ? 'Nothing is waiting for the cutting team.' : 'Try another search.'}</Empty>}
      </section>
    </>
  );
}

export function BatchSheet({ batch }) {
  const { entries, lists } = useStore();
  const { closeSheet, cutBatch, edit, openEntry } = useApp();
  const b = useMemo(() => batchStatus(entries).find((x) => x.e.batch === batch), [entries, batch]);
  if (!b) return <Sheet title={batch} onClose={closeSheet}><Empty title="Batch not found">It may have been deleted.</Empty></Sheet>;
  const e = b.e, mixed = inKgOf(e);
  const yieldAll = b.finished && b.status === 'done' ? pct(b.finished, mixed) : null;
  return (
    <Sheet stage="cut" onClose={closeSheet} title={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="mono">{e.batch}</span><StatusPill s={b.status} /></span>}>
      <div>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 22, letterSpacing: '-.02em' }}>{e.product} {e.size}</div>
        <div className="muted">{specLine(e)} · {e.customer}{e.order ? ` · ${e.order}` : ''}</div>
      </div>
      <div className="kv">
        <div><span>Mixed</span><b>{fmt(mixed)} kg</b></div>
        <div><span>Rolls made</span><b>{fmt(e.outKg)} kg</b></div>
        <div><span>Cut so far</span><b>{fmt(b.usedKg)} kg</b></div>
        <div><span>Left to cut</span><b>{b.open ? `${fmt(b.leftKg)} kg` : '–'}</b></div>
        <div><span>Finished bags</span><b>{fmt(b.finished)} kg</b></div>
        <div><span>Pieces</span><b>{fmt(b.pieces, 0)}</b></div>
        {yieldAll != null && <div><span>Mix to bags</span><b>{fmt(yieldAll)}%</b></div>}
      </div>
      {e.materials?.length > 0 && <section className="card"><div className="card-h"><h2>Mix</h2><span className="grow" /><span className="sub">{fmt(mixed)} kg</span></div><MixBar parts={e.materials} list={lists.materials} /></section>}
      <section className="card">
        <div className="card-h"><h2>Trace</h2></div>
        <div className="timeline">
          <div className="tl" onClick={() => openEntry(e.id)} style={{ cursor: 'pointer' }}>
            <span className="ico ex"><Factory /></span>
            <div className="body"><b>Extruded · {e.rolls} rolls, {fmt(e.outKg)} kg</b><span>{short(e.date)} {e.shift} shift · {e.worker} · {e.machine}</span>{e.notes && <span>“{e.notes}”</span>}</div>
          </div>
          {b.jobs.map((j) => (
            <div className="tl" key={j.id} onClick={() => openEntry(j.id)} style={{ cursor: 'pointer' }}>
              <span className="ico cut"><Scissors /></span>
              <div className="body"><b>Cut · {fmt(j.pieces, 0)} pcs, {fmt(j.outKg)} kg</b><span>{short(j.date)} {j.shift} shift · {j.worker} · {j.machine}</span><span>{j.rolls} rolls, {fmt(j.inKg)} kg used · waste {fmt(pct(j.inKg - j.outKg, j.inKg))}%</span>{j.notes && <span>“{j.notes}”</span>}</div>
            </div>
          ))}
          {b.open && <div className="tl"><span className="ico"><Boxes /></span><div className="body"><b>{b.leftRolls} rolls waiting</b><span>{fmt(b.leftKg)} kg · {b.age === 0 ? 'made today' : `${b.age} days since extrusion`}</span></div></div>}
        </div>
      </section>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {b.open && <button className="btn lg" style={{ flex: 1 }} onClick={() => cutBatch(b)}><Scissors className="i" />Log cutting for this batch</button>}
        <button className="btn gray lg" onClick={() => edit(e)}><Pencil className="i" />Edit extrusion</button>
      </div>
    </Sheet>
  );
}
