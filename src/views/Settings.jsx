// Lists & settings: the dropdown choices every tablet uses, mix recipes, waste limits, week start and demo data.
import { useState } from 'react';
import { ArrowDown, ArrowUp, FlaskConical, Trash2, X } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { Confirm, Field, MixBar, NumberIn, useToast } from '../components/ui.jsx';
import { LIST_GROUPS, demoTargets, sampleEntries } from '../lib/data.js';

export default function Settings() {
  const { lists, settings, saveSettings, entries, saveMany } = useStore();
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const demoCount = entries.filter((e) => e.sample).length;

  const saveList = async (key, items, msg) => { try { await saveSettings({ lists: { ...lists, [key]: items } }); toast(msg); } catch (err) { toast(err.message, { tone: 'bad' }); } };

  return (
    <>
      <div className="large-title"><div><h1>Lists & settings</h1><p>Changes reach every tablet. Old entries keep what was chosen at the time.</p></div></div>
      <div className="stack">
        {LIST_GROUPS.map((g) => (
          <div key={g.title} className="stack">
            <div className="sec-title">{g.title}</div>
            <div className="cols">
              {Object.entries(g.keys).map(([key, label]) => <ListCard key={key} label={label} items={lists[key] || []} onSave={(items, msg) => saveList(key, items, msg)} />)}
            </div>
          </div>
        ))}

        <div className="sec-title">Mix recipes</div>
        <section className="card" data-stage="ex">
          <p className="muted" style={{ margin: '0 0 14px', fontSize: 14 }}>On a new extrusion entry, pick a recipe and type the total mix; every material gets its share. Save a recipe from any mix on the entry form.</p>
          {settings.recipes.length ? (
            <div className="cols">
              {settings.recipes.map((r, i) => (
                <div key={r.id} className="span-6" style={{ background: 'var(--fill-2)', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <FlaskConical className="i" style={{ color: 'var(--ex)' }} /><b style={{ flex: 1 }}>{r.name}</b>
                    <button className="btn plain sm icon" aria-label={`Delete ${r.name}`} onClick={async () => { await saveSettings({ recipes: settings.recipes.filter((_, j) => j !== i) }); toast(`Removed “${r.name}”.`); }}><Trash2 className="i" style={{ width: 16, color: 'var(--label-2)' }} /></button>
                  </div>
                  <MixBar parts={Object.entries(r.mats).map(([name, kg]) => ({ name, kg }))} list={lists.materials} />
                </div>
              ))}
            </div>
          ) : <p className="muted">No recipes yet.</p>}
        </section>

        <div className="sec-title">Waste limits & week</div>
        <section className="card">
          <div className="grid">
            <Field label="Extrusion waste limit"><NumberIn unit="%" value={settings.limits.ex} onChange={(v) => saveSettings({ limits: { ...settings.limits, ex: Number(v) || 0 } })} /></Field>
            <Field label="Cutting waste limit"><NumberIn unit="%" value={settings.limits.cut} onChange={(v) => saveSettings({ limits: { ...settings.limits, cut: Number(v) || 0 } })} /></Field>
            <Field label="Week starts on">
              <select className="in" value={settings.weekStart} onChange={async (e) => { await saveSettings({ weekStart: Number(e.target.value) }); toast('Week start saved.'); }}>
                <option value="6">Saturday</option><option value="0">Sunday</option><option value="1">Monday</option>
              </select>
            </Field>
          </div>
          <p className="muted" style={{ margin: '12px 2px 0', fontSize: 13 }}>Entries above the limit are flagged on the overview and in reports.</p>
        </section>

        <div className="sec-title">Demo data</div>
        <section className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted" style={{ flex: 1, minWidth: 220 }}>{demoCount ? `${demoCount} demo entries are in the log, marked “Demo”.` : 'No demo entries. The log only holds what your team typed.'}</span>
          <button className="btn gray" disabled={busy} onClick={async () => { setBusy(true); try { const d = sampleEntries(); await saveMany(d); await saveSettings({ orders: { ...demoTargets(d), ...settings.orders } }); toast('Demo entries loaded.'); } catch (err) { toast(err.message, { tone: 'bad' }); } setBusy(false); }}>Load demo entries</button>
          {demoCount > 0 && <button className="btn gray" style={{ color: 'var(--red)' }} onClick={() => setAsk(true)}>Remove demo entries</button>}
        </section>
      </div>
      {ask && <Confirm title="Remove all demo entries?" body="Entries your team typed in stay. Demo order targets are removed too." confirmLabel="Remove"
        onClose={() => setAsk(false)} onConfirm={async () => {
          await saveMany([], entries.filter((x) => x.sample).map(({ id, date }) => ({ id, date })));
          await saveSettings({ orders: Object.fromEntries(Object.entries(settings.orders).filter(([, v]) => !v.sample)) });
          toast('Demo entries removed. The log is ready for real use.');
        }} />}
    </>
  );
}

function ListCard({ label, items, onSave }) {
  const [v, setV] = useState('');
  const [editing, setEditing] = useState(false);
  const add = (ev) => {
    ev.preventDefault();
    const val = v.trim().replace(/\s*[x*]\s*(?=\d)/i, ' × ');
    if (!val) return;
    if (items.includes(val)) return onSave(items, 'Already in the list.');
    onSave([...items, val], `Added “${val}”.`); setV('');
  };
  const move = (i, d) => { const next = [...items]; [next[i], next[i + d]] = [next[i + d], next[i]]; onSave(next, 'Order saved.'); };
  return (
    <section className="card list-card span-4">
      <div className="card-h"><h2>{label}</h2><span className="sub">{items.length}</span><span className="grow" /><button className="btn plain sm" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Reorder'}</button></div>
      {editing ? (
        <div className="rows" style={{ margin: '0 -18px 12px' }}>
          {items.map((it, i) => (
            <div className="row" key={it} style={{ padding: '6px 12px 6px 18px' }}>
              <span className="main-t">{it}</span>
              <button className="btn plain icon sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${it} up`}><ArrowUp className="i" style={{ width: 16 }} /></button>
              <button className="btn plain icon sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${it} down`}><ArrowDown className="i" style={{ width: 16 }} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="items">
          {items.map((it, i) => <span className="li" key={it}>{it}<button aria-label={`Remove ${it}`} onClick={() => onSave(items.filter((_, j) => j !== i), `Removed “${it}”.`)}><X /></button></span>)}
          {!items.length && <span className="muted">Empty list</span>}
        </div>
      )}
      <form className="add-row" onSubmit={add}><input className="in" maxLength={60} placeholder="Add…" value={v} onChange={(e) => setV(e.target.value)} /><button className="btn sm gray" style={{ height: 38 }} disabled={!v.trim()}>Add</button></form>
    </section>
  );
}
