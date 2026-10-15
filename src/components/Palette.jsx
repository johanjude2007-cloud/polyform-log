// Command palette (⌘K or /): jump to a page, a batch, an order or an entry, or start a new entry.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, ClipboardList, Factory, Scissors, Search } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { useApp } from '../App.jsx';
import { batchStatus, fmt, ordersOf, relDay, stageOf } from '../lib/data.js';

export default function Palette({ onClose, routes }) {
  const { entries, settings } = useStore();
  const { go, setStage, openBatch, openEntry } = useApp();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);

  const items = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const hit = (s) => !ql || s.toLowerCase().includes(ql);
    const out = [];
    const actions = [
      { sec: 'Actions', icon: <Factory />, cls: 'ex', title: 'New extrusion entry', run: () => { setStage('ex'); go('log'); } },
      { sec: 'Actions', icon: <Scissors />, cls: 'cut', title: 'New cutting entry', run: () => { setStage('cut'); go('log'); } },
      ...routes.map((r) => ({ sec: 'Go to', icon: <r.icon />, title: r.label, run: () => go(r.id) })),
    ];
    out.push(...actions.filter((a) => hit(a.title)));
    if (ql) {
      const bs = batchStatus(entries).filter((b) => hit(`${b.e.batch} ${b.e.customer} ${b.e.product} ${b.e.size} ${b.e.order}`)).reverse().slice(0, 6);
      out.push(...bs.map((b) => ({ sec: 'Batches', icon: <Boxes />, cls: 'ex', title: `${b.e.batch} · ${b.e.product} ${b.e.size}`, sub: b.open ? `${fmt(b.leftKg)} kg left` : 'finished', run: () => openBatch(b.e.batch) })));
      const os = ordersOf(entries, settings.orders).filter((o) => hit(`${o.po} ${o.customer}`)).slice(0, 4);
      out.push(...os.map((o) => ({ sec: 'Orders', icon: <ClipboardList />, title: `${o.po} · ${o.customer}`, sub: `${fmt(o.pieces, 0)} pcs`, run: () => go('orders') })));
      const es = entries.filter((e) => hit(`${e.worker} ${e.machine} ${e.customer} ${e.notes} ${e.product}`)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
      out.push(...es.map((e) => ({ sec: 'Entries', icon: stageOf(e) === 'ex' ? <Factory /> : <Scissors />, cls: stageOf(e), title: `${e.product} ${e.size} · ${e.worker}`, sub: relDay(e.date), run: () => openEntry(e.id) })));
    }
    return out;
  }, [q, entries, settings.orders, routes, go, setStage, openBatch, openEntry]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const run = (it) => { onClose(); it.run(); };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); run(items[sel]); }
    else if (e.key === 'Escape') onClose();
  };
  let last = '';
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="palette glass" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-in"><Search className="i" /><input autoFocus placeholder="Search batches, orders, workers…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} /><span className="kbd">esc</span></div>
        <div className="palette-list" ref={listRef} role="listbox">
          {items.map((it, i) => {
            const head = it.sec !== last ? <div className="palette-sec">{it.sec}</div> : null; last = it.sec;
            return (
              <div key={i}>
                {head}
                <div className="palette-item" role="option" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={() => run(it)}>
                  <span className={`ico ${it.cls || ''}`}>{it.icon}</span><span className="t">{it.title}</span>{it.sub && <span className="muted" style={{ fontSize: 13 }}>{it.sub}</span>}
                </div>
              </div>
            );
          })}
          {!items.length && <div className="empty"><b>No results</b><span>Try a batch number like E1510-01, a PO or a name.</span></div>}
        </div>
        <div className="palette-foot"><span><span className="kbd">↑↓</span> move</span><span><span className="kbd">↵</span> open</span><span><span className="kbd">1–6</span> pages</span></div>
      </div>
    </>
  );
}
