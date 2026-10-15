// Orders: every PO typed on an entry, what each stage has made for it, and an optional
// target quantity and due date so the office can see what is ready to ship.
import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardList, Plus, Search } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { useApp } from '../App.jsx';
import { Empty, Field, NumberIn, Seg, Select, Sheet, useToast } from '../components/ui.jsx';
import { fmt, kgShort, ordersOf, relDay, short, stageOf, today } from '../lib/data.js';

const STATE = { open: ['In production', ''], late: ['Late', 'bad'], ready: ['Ready', 'ok'], closed: ['Closed', ''] };

export default function Orders() {
  const { entries, settings } = useStore();
  const [filter, setFilter] = useState('active');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null); // po string, or '' for a new order
  const all = useMemo(() => ordersOf(entries, settings.orders), [entries, settings.orders]);
  const rows = all.filter((o) => (filter === 'all' || (filter === 'active' ? !o.closed && (o.target || (o.last && o.last >= addRecent())) : o.state === filter))
    && (!q || `${o.po} ${o.customer} ${o.product} ${o.size}`.toLowerCase().includes(q.toLowerCase())));
  const late = all.filter((o) => o.state === 'late').length;
  const ready = all.filter((o) => o.state === 'ready').length;

  return (
    <>
      <div className="large-title">
        <div><h1>Orders</h1><p>{all.filter((o) => !o.closed && o.target).length} with targets · {ready} ready · {late} late</p></div>
        <span className="grow" />
        <button className="btn" data-stage="cut" onClick={() => setOpen('')}><Plus className="i" />New order</button>
      </div>
      <section className="card flush">
        <div className="card-h" style={{ flexWrap: 'wrap', paddingBottom: 14 }}>
          <Seg value={filter} onChange={setFilter} label="Show" options={[{ value: 'active', label: 'Active' }, { value: 'late', label: `Late${late ? ` · ${late}` : ''}` }, { value: 'ready', label: 'Ready' }, { value: 'all', label: 'All' }]} />
          <span className="grow" />
          <div className="search"><Search /><input className="in" placeholder="PO, customer, product" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th className="first">Order</th><th>Customer</th><th>Product</th><th className="r">Extruded</th><th className="r">Pieces cut</th><th style={{ width: 170 }}>Progress</th><th>Due</th><th className="last">Status</th></tr></thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.po} onClick={() => setOpen(o.po)}>
                    <td className="first"><b className="mono">{o.po}</b><span className="sub">{o.last ? `last entry ${relDay(o.last).toLowerCase()}` : 'no entries yet'}</span></td>
                    <td>{o.customer || '–'}</td>
                    <td><b>{o.product} {o.size}</b><span className="sub">{o.spec}</span></td>
                    <td className="r">{kgShort(o.extrudedKg)}</td>
                    <td className="r"><b>{fmt(o.pieces, 0)}</b>{o.target ? <span className="sub">of {fmt(o.target, 0)}</span> : null}</td>
                    <td>{o.target ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className={`progress ${o.state === 'ready' ? 'ok' : o.state === 'late' ? 'late' : ''}`} style={{ flex: 1, '--tint': 'var(--cut)' }}><span style={{ width: `${o.progress * 100}%` }} /></div><span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, width: 36, textAlign: 'right' }}>{Math.round(o.progress * 100)}%</span></div> : <span className="faint">No target</span>}</td>
                    <td>{o.due ? short(o.due) : <span className="faint">–</span>}</td>
                    <td className="last"><span className={`pill ${STATE[o.state][1]}`}>{STATE[o.state][0]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={ClipboardList} title="No orders here">Type a PO number on an entry, or add an order with a target.</Empty>}
      </section>
      {open !== null && <OrderSheet po={open} onClose={() => setOpen(null)} all={all} />}
    </>
  );
}
const addRecent = () => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); };

function OrderSheet({ po, onClose, all }) {
  const { settings, saveSettings, lists } = useStore();
  const { openEntry } = useApp();
  const toast = useToast();
  const o = all.find((x) => x.po === po);
  const t = settings.orders[po] || {};
  const [f, setF] = useState({ po: po || '', customer: o?.customer || t.customer || '', product: o?.product || t.product || '', size: o?.size || t.size || '', pieces: String(t.pieces || ''), due: t.due || '' });
  const isNew = !po;
  async function submit(ev) {
    ev.preventDefault();
    const key = f.po.trim();
    if (!key) return toast('Enter the PO number.', { tone: 'warn' });
    if (isNew && (settings.orders[key] || all.some((x) => x.po === key))) return toast('That PO already exists.', { tone: 'warn' });
    await saveSettings({ orders: { ...settings.orders, [key]: { ...t, customer: f.customer, product: f.product, size: f.size, pieces: Number(f.pieces) || 0, due: f.due } } });
    toast(isNew ? `Added ${key}.` : `Saved ${key}.`); onClose();
  }
  async function setClosed(closed) {
    await saveSettings({ orders: { ...settings.orders, [po]: { ...t, closed } } });
    toast(closed ? `Closed ${po}.` : `Reopened ${po}.`); onClose();
  }
  const cut = o?.entries.filter((e) => stageOf(e) === 'cut') || [];
  return (
    <Sheet stage="cut" onClose={onClose} title={isNew ? 'New order' : <span className="mono">{po}</span>}>
      {o && !isNew && (
        <div className="kv">
          <div><span>Extruded</span><b>{kgShort(o.extrudedKg)}</b></div>
          <div><span>Finished</span><b>{kgShort(o.finishedKg)}</b></div>
          <div><span>Pieces</span><b>{fmt(o.pieces, 0)}</b></div>
          <div><span>Packets</span><b>{fmt(o.bundles, 0)}</b></div>
        </div>
      )}
      <form className="card stack" onSubmit={submit}>
        {isNew && <Field label="PO number"><input className="in" value={f.po} onChange={(e) => setF({ ...f, po: e.target.value })} placeholder="PO-2291" autoFocus maxLength={40} /></Field>}
        <div className="grid two">
          <Field label="Customer"><Select value={f.customer} onChange={(v) => setF({ ...f, customer: v })} items={lists.customers} allowEmpty placeholder="Any" /></Field>
          <Field label="Product"><Select value={f.product} onChange={(v) => setF({ ...f, product: v })} items={lists.products} allowEmpty placeholder="Any" /></Field>
          <Field label="Size"><Select value={f.size} onChange={(v) => setF({ ...f, size: v })} items={lists.sizes} allowEmpty placeholder="Any" /></Field>
          <Field label="Target pieces"><NumberIn integer unit="pcs" value={f.pieces} onChange={(v) => setF({ ...f, pieces: v })} /></Field>
          <Field label="Due date"><input className="in" type="date" value={f.due} min={isNew ? today() : undefined} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn lg" style={{ flex: 1 }}>{isNew ? 'Add order' : 'Save'}</button>
          {!isNew && (t.closed ? <button type="button" className="btn gray lg" onClick={() => setClosed(false)}>Reopen</button> : <button type="button" className="btn gray lg" onClick={() => setClosed(true)}><CheckCircle2 className="i" />Close</button>)}
        </div>
      </form>
      {cut.length > 0 && (
        <section className="card flush">
          <div className="card-h"><h2>Cutting jobs</h2><span className="sub">{cut.length}</span></div>
          <div className="rows">
            {cut.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((e) => (
              <div className="row link" key={e.id} onClick={() => { onClose(); openEntry(e.id); }}>
                <span className="ico cut"><CalendarClock /></span>
                <div className="main-t"><b>{fmt(e.pieces, 0)} pcs · {fmt(e.outKg)} kg</b><span>{relDay(e.date)} · {e.worker} · {e.batch || 'no batch'}</span></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Sheet>
  );
}
