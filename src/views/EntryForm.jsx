// New entry: one form for both stages. Extrusion logs the mix and the rolls it made; cutting
// picks a roll batch (customer and product fill in from it) and logs what came off the machine.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Circle, CopyPlus, Eraser, FlaskConical, Info, PencilLine, Save, Sparkles } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { useApp } from '../App.jsx';
import { Field, MixBar, NumberIn, Seg, Select, swatchOf, useToast, matColour } from '../components/ui.jsx';
import { STAGES, batchStatus, currentShift, fmt, nextBatchNo, newId, openBatches, pct, r1, relDay, stageOf, today } from '../lib/data.js';

const blank = () => ({ date: today(), shift: currentShift(), worker: '', machine: '', batch: '', customer: '', order: '', product: '', size: '', thick: '', colour: '', print: '', mats: [], rolls: '', inKg: '', outKg: '', pieces: '', bundles: '', notes: '' });
const draftKey = (s) => `pf-draft-${s}`;
const readDraft = (s) => { try { const d = JSON.parse(localStorage.getItem(draftKey(s)) || 'null'); return d && d.date ? { ...blank(), ...d, date: today() } : null; } catch { return null; } };

function fromEntry(e, asCopy) {
  const v = (k) => (asCopy ? '' : e[k] ?? '');
  return {
    date: asCopy ? today() : e.date, shift: e.shift || 'Day', worker: e.worker || '', machine: e.machine || '', batch: asCopy ? '' : e.batch || '',
    customer: e.customer || '', order: e.order || '', product: e.product || '', size: e.size || '', thick: e.thick || '', colour: e.colour || '', print: e.print || '',
    mats: (e.materials || []).map((m) => [m.name, asCopy ? '' : String(m.kg)]), rolls: String(v('rolls')), inKg: String(v('inKg')), outKg: String(v('outKg')),
    pieces: String(v('pieces')), bundles: String(v('bundles')), notes: asCopy ? '' : e.notes || '',
  };
}

function Step({ n, title, done, aside }) {
  return <div className="step-h"><span className={`n ${done ? 'done' : ''}`}>{done ? <Check /> : n}</span><h2>{title}</h2><span className="grow" />{aside}</div>;
}

export default function EntryForm() {
  const { entries, lists, settings, save, remove, saveSettings } = useStore();
  const { stage, editing, clearEditing, openBatch } = useApp();
  const toast = useToast();
  const S = STAGES[stage];
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState(() => readDraft(stage) || blank());
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  // Arriving from Edit / Copy / Cut-this-batch elsewhere in the app.
  useEffect(() => {
    if (!editing) return;
    if (editing.entry) { setF(fromEntry(editing.entry, editing.asCopy)); setEditId(editing.asCopy ? null : editing.entry.id); }
    else if (editing.batch) { const b = editing.batch; setEditId(null); setF({ ...blank(), ...pickSpec(b.e), batch: b.e.batch, rolls: String(b.leftRolls || ''), inKg: b.leftKg > 0 ? String(b.leftKg) : '' }); }
    setTried(false);
    clearEditing();
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switching stage starts a fresh form (each team has its own people and machines).
  const firstStage = useRef(stage);
  useEffect(() => { if (firstStage.current === stage) return; firstStage.current = stage; if (!editing) { setEditId(null); setF(readDraft(stage) || blank()); setTried(false); } }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a draft on this tablet so a reload or a tab switch never loses typing.
  useEffect(() => { if (editId) return; const t = setTimeout(() => { try { localStorage.setItem(draftKey(stage), JSON.stringify(f)); } catch {} }, 300); return () => clearTimeout(t); }, [f, stage, editId]);

  const matKg = f.mats.reduce((a, [, kg]) => a + (Number(kg) || 0), 0);
  const inKg = stage === 'ex' ? r1(matKg) : r1(f.inKg);
  const outKg = r1(f.outKg);
  const waste = r1(inKg - outKg);
  const wastePct = pct(waste, inKg);
  const limit = settings.limits[stage];
  const wasteState = !(inKg && outKg) ? '' : waste < 0 ? 'bad' : wastePct > limit ? 'warn' : 'ok';
  const open = useMemo(() => openBatches(entries, editId), [entries, editId]);
  const allBatches = useMemo(() => batchStatus(entries, editId), [entries, editId]);
  const picked = allBatches.find((b) => b.e.batch === f.batch);

  const checks = stage === 'ex'
    ? [['Worker and machine', f.worker && f.machine], ['Customer and product', f.customer && f.product && f.size], ['Materials with kilos', f.mats.length && f.mats.every(([, kg]) => Number(kg) > 0)], ['Rolls and roll weight', Number(f.rolls) > 0 && outKg > 0]]
    : [['Worker and machine', f.worker && f.machine], ['Customer and product', f.customer && f.product && f.size], ['Roll weight used', inKg > 0], ['Finished weight and pieces', outKg > 0 && Number(f.pieces) > 0]];
  const ready = checks.every(([, ok]) => ok);
  const bad = (cond) => (tried && !cond ? 'bad' : '');

  function pickSpec(e) { return { customer: e.customer || '', order: e.order || '', product: e.product || '', size: e.size || '', thick: e.thick || '', colour: e.colour || '', print: e.print || '' }; }
  function chooseBatch(b) {
    if (!b) return set({ batch: '' });
    set({ batch: b.e.batch, ...pickSpec(b.e), rolls: f.rolls || String(b.leftRolls || ''), inKg: f.inKg || (b.leftKg > 0 ? String(b.leftKg) : '') });
  }
  function toggleMat(name) {
    const has = f.mats.some(([n]) => n === name);
    const next = has ? f.mats.filter(([n]) => n !== name) : [...f.mats, [name, '']];
    next.sort((a, b) => lists.materials.indexOf(a[0]) - lists.materials.indexOf(b[0]));
    set({ mats: next });
    if (!has) setTimeout(() => formRef.current?.querySelector(`[data-mat="${CSS.escape(name)}"]`)?.focus(), 30);
  }

  function reset(keepToast) {
    setEditId(null); setTried(false);
    const b = blank();
    setF(b);
    try { localStorage.removeItem(draftKey(stage)); } catch {}
    if (!keepToast) toast('Form cleared.', { tone: 'info', ms: 1800 });
  }

  function copyLast() {
    const last = entries.filter((e) => stageOf(e) === stage).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    if (!last) return toast('No entries yet to copy.', { tone: 'warn' });
    setEditId(null); setF(fromEntry(last, true)); setTried(false);
    toast(stage === 'ex' ? 'Copied product and mix. Enter today’s kilos.' : 'Copied product. Pick the roll batch and enter today’s figures.', { tone: 'info' });
  }

  async function submit(ev) {
    ev?.preventDefault();
    setTried(true);
    if (!ready) { toast(`Still needed: ${checks.filter(([, ok]) => !ok).map(([l]) => l.toLowerCase()).join(', ')}.`, { tone: 'warn' }); return; }
    const prev = editId ? entries.find((x) => x.id === editId) : null;
    const base = {
      id: editId || newId(), stage, date: f.date, shift: f.shift, worker: f.worker, machine: f.machine,
      customer: f.customer, order: f.order.trim(), product: f.product, size: f.size, thick: f.thick, colour: f.colour, print: f.print,
      rolls: Math.round(Number(f.rolls) || 0), outKg, notes: f.notes.trim(), createdAt: prev?.createdAt || Date.now(),
    };
    const e = stage === 'ex'
      ? { ...base, materials: f.mats.map(([name, kg]) => ({ name, kg: r1(kg) })), batch: prev?.batch || nextBatchNo(entries, f.date) }
      : { ...base, batch: f.batch, inKg, pieces: Math.round(Number(f.pieces) || 0), bundles: Math.round(Number(f.bundles) || 0) };
    if (prev?.sample) e.sample = true;
    setBusy(true);
    try {
      const r = await save(e);
      const undo = prev ? { label: 'Undo', run: () => save(prev) } : { label: 'Undo', run: () => remove(e) };
      const msg = prev ? 'Entry updated.' : stage === 'ex' ? `Saved batch ${e.batch} · ${e.rolls} rolls · ${fmt(e.outKg)} kg` : `Saved ${e.product} ${e.size} · ${fmt(e.pieces, 0)} pcs`;
      toast(r.offline ? `${msg} Will sync when online.` : msg, { tone: r.offline ? 'warn' : 'ok', action: undo });
      reset(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { if (!err.quiet) toast(err.message, { tone: 'bad' }); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  // Mix recipes: pick a saved ratio, type the total mix, and every material gets its share.
  const [recipe, setRecipe] = useState('');
  const [mixTotal, setMixTotal] = useState('');
  function applyRecipe() {
    const r = settings.recipes.find((x) => x.id === recipe);
    if (!r) return;
    const total = Number(mixTotal) || 0;
    const sum = Object.values(r.mats).reduce((a, v) => a + v, 0) || 1;
    const mats = Object.entries(r.mats).map(([n, p]) => [n, total ? String(r1((total * p) / sum)) : '']);
    set({ mats });
    toast(total ? `Applied ${r.name}: ${fmt(total)} kg split by the recipe.` : `Applied ${r.name}. Enter the kilos.`, { tone: 'info' });
  }
  async function saveRecipe() {
    if (!matKg) return toast('Enter the kilos first, then save the mix as a recipe.', { tone: 'warn' });
    const name = window.prompt('Name this recipe', `${f.colour || ''} ${f.product || 'mix'}`.trim());
    if (!name) return;
    const mats = Object.fromEntries(f.mats.map(([n, kg]) => [n, Math.round(((Number(kg) || 0) / matKg) * 1000) / 10]));
    await saveSettings({ recipes: [...settings.recipes, { id: 'r' + newId(), name, mats }] });
    toast(`Saved recipe “${name}”.`);
  }

  const gPerPc = Number(f.pieces) > 0 && outKg > 0 ? (outKg * 1000) / Number(f.pieces) : 0;
  const choiceOrSelect = (items, value, onChange, cls) => items.length <= 6
    ? <div className="chips">{items.map((w) => <button key={w} type="button" className="chip" aria-pressed={value === w} onClick={() => onChange(value === w ? '' : w)}><span className="tick"><Check /></span>{w}</button>)}{value && !items.includes(value) && <button type="button" className="chip" aria-pressed="true"><span className="tick"><Check /></span>{value}</button>}</div>
    : <Select value={value} onChange={onChange} items={items} className={cls} />;

  return (
    <>
      <div className="large-title">
        <div>
          <h1>{editId ? 'Edit entry' : stage === 'ex' ? 'New extrusion entry' : 'New cutting entry'}</h1>
          <p>{stage === 'ex' ? 'Mixing materials into rolls' : 'Cutting rolls into finished bags'}</p>
        </div>
        <span className="grow" />
      </div>

      <form ref={formRef} onSubmit={submit} autoComplete="off" className="entry-layout">
        <div className="stack">
          {editId && (
            <div className="banner info"><PencilLine className="i" /><span className="grow"><b>Editing {picked?.e.batch || entries.find((x) => x.id === editId)?.batch || 'an entry'}.</b> Save to update it.</span><button type="button" className="btn gray sm" onClick={() => reset(true)}>Cancel</button></div>
          )}

          <section className="card">
            <Step n={1} title="Shift & worker" done={!!(f.worker && f.machine)} />
            <div className="grid">
              <Field label="Date"><input className="in" type="date" value={f.date} max={today()} onChange={(e) => set({ date: e.target.value })} required /></Field>
              <div className="field"><span>Shift</span><Seg className="block lg" value={f.shift} onChange={(v) => set({ shift: v })} options={[{ value: 'Day', label: 'Day' }, { value: 'Night', label: 'Night' }]} label="Shift" /></div>
            </div>
            <div className="field" style={{ marginTop: 16 }}><span>Worker</span>{choiceOrSelect(lists[S.workers] || [], f.worker, (v) => set({ worker: v }), bad(f.worker))}</div>
            <div className="field" style={{ marginTop: 16 }}><span>Machine</span>{choiceOrSelect(lists[S.machines] || [], f.machine, (v) => set({ machine: v }), bad(f.machine))}</div>
            {tried && !(f.worker && f.machine) && <p className="err" style={{ marginTop: 10 }}>Pick the worker and the machine.</p>}
          </section>

          {stage === 'cut' && (
            <section className="card">
              <Step n={2} title="Rolls from extrusion" done={!!f.batch} aside={<span className="pill">{open.length} waiting</span>} />
              <div className="batch-pick">
                <button type="button" className="batch-opt" aria-pressed={!f.batch} onClick={() => chooseBatch(null)}>
                  <b>No batch</b><small>Other rolls, or rolls from outside</small>
                </button>
                {(picked && !open.some((b) => b.e.batch === picked.e.batch) ? [picked, ...open.slice().reverse()] : open.slice().reverse()).map((b) => (
                  <button type="button" key={b.e.batch} className="batch-opt" aria-pressed={f.batch === b.e.batch} onClick={() => chooseBatch(b)}>
                    <div className="top"><span className="batch-no">{b.e.batch}</span><small>{relDay(b.e.date)}</small></div>
                    <b>{b.e.product} {b.e.size}</b>
                    <small>{b.e.customer}</small>
                    <div className="top"><small>{b.e.colour} · {b.e.thick}</small><span className="left">{fmt(b.leftKg)} kg · {b.leftRolls} rolls</span></div>
                  </button>
                ))}
              </div>
              {picked && <p className="muted" style={{ margin: '12px 2px 0', fontSize: 13 }}>Customer and product filled in from <button type="button" className="btn plain sm" style={{ height: 'auto', padding: 0 }} onClick={() => openBatch(picked.e.batch)}>batch {picked.e.batch}</button>.</p>}
            </section>
          )}

          <section className="card">
            <Step n={stage === 'cut' ? 3 : 2} title="Customer & product" done={!!(f.customer && f.product && f.size)} />
            <div className="grid">
              <Field label="Customer"><Select value={f.customer} onChange={(v) => set({ customer: v })} items={lists.customers} className={bad(f.customer)} /></Field>
              <Field label="Order / PO (optional)"><input className="in" value={f.order} maxLength={40} placeholder="PO-2291" onChange={(e) => set({ order: e.target.value })} list="po-list" /></Field>
              <Field label="Product"><Select value={f.product} onChange={(v) => set({ product: v })} items={lists.products} className={bad(f.product)} /></Field>
              <Field label="Size (W × L, cm)"><Select value={f.size} onChange={(v) => set({ size: v })} items={lists.sizes} className={bad(f.size)} /></Field>
              <Field label="Thickness"><Select value={f.thick} onChange={(v) => set({ thick: v })} items={lists.thickness} /></Field>
              <Field label="Colour"><Select value={f.colour} onChange={(v) => set({ colour: v })} items={lists.colours} /></Field>
              <Field label="Printing"><Select value={f.print} onChange={(v) => set({ print: v })} items={lists.printing} /></Field>
            </div>
            <datalist id="po-list">{[...new Set(entries.filter((e) => e.customer === f.customer && e.order).map((e) => e.order))].slice(-12).map((p) => <option key={p} value={p} />)}</datalist>
            {(f.product || f.size) && (
              <div className="spec-card">
                <span className="swatch" style={{ background: swatchOf(f.colour) }} />
                <div><b>{f.product} {f.size}</b><span>{[f.thick, f.colour, f.print].filter(Boolean).join(' · ') || 'Pick thickness, colour and printing'}</span></div>
              </div>
            )}
          </section>

          {stage === 'ex' && (
            <section className="card">
              <Step n={3} title="Mixing — materials used" done={!!(f.mats.length && f.mats.every(([, kg]) => Number(kg) > 0))} aside={matKg > 0 && <span className="pill ex">{fmt(matKg)} kg mixed</span>} />
              <div className="chips">
                {[...new Set([...lists.materials, ...f.mats.map(([n]) => n)])].map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed={f.mats.some(([n]) => n === m)} onClick={() => toggleMat(m)}><span className="tick"><Check /></span>{m}</button>
                ))}
              </div>
              {f.mats.length > 0 ? (
                <div className="mat-rows">
                  {f.mats.map(([name, kg], i) => (
                    <div className="mat-row" key={name}>
                      <i style={{ background: matColour(name, lists.materials) }} />
                      <b>{name}</b>
                      <NumberIn value={kg} unit="kg" data-mat={name} aria-label={`${name} kilos`} className={bad(Number(kg) > 0)} placeholder="0"
                        onChange={(v) => set({ mats: f.mats.map((m, j) => (j === i ? [m[0], v] : m)) })} />
                      <span className="p">{matKg ? Math.round(((Number(kg) || 0) / matKg) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              ) : <p className="muted" style={{ margin: '14px 2px 0', fontSize: 14 }}>Tap every material that went into the mix, or apply a recipe below.</p>}
              <div className="recipe-bar">
                <FlaskConical className="i" style={{ color: 'var(--label-2)', marginLeft: 4 }} />
                <select className="in" value={recipe} onChange={(e) => setRecipe(e.target.value)} aria-label="Recipe">
                  <option value="">Recipe…</option>
                  {settings.recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <div className="unit" style={{ width: 130 }}><input className="in num" type="number" inputMode="decimal" min="0" placeholder="Total" value={mixTotal} onChange={(e) => setMixTotal(e.target.value)} aria-label="Total mix kilos" /><em>kg</em></div>
                <button type="button" className="btn tinted sm" disabled={!recipe} onClick={applyRecipe}><Sparkles className="i" style={{ width: 15 }} />Apply</button>
                <span style={{ flex: 1 }} />
                <button type="button" className="btn plain sm" onClick={saveRecipe}>Save mix as recipe</button>
              </div>
            </section>
          )}

          <section className="card">
            <Step n={4} title={stage === 'ex' ? 'Rolls produced' : 'Cutting output'} done={stage === 'ex' ? Number(f.rolls) > 0 && outKg > 0 : outKg > 0 && Number(f.pieces) > 0} />
            <div className="grid">
              <Field label={stage === 'ex' ? 'Number of rolls' : 'Rolls used'}><NumberIn integer value={f.rolls} onChange={(v) => set({ rolls: v })} className={stage === 'ex' ? bad(Number(f.rolls) > 0) : ''} /></Field>
              {stage === 'cut' && <Field label="Roll weight used"><NumberIn unit="kg" value={f.inKg} onChange={(v) => set({ inKg: v })} className={bad(inKg > 0)} /></Field>}
              <Field label={stage === 'ex' ? 'Total roll weight' : 'Finished bags weight'}><NumberIn unit="kg" value={f.outKg} onChange={(v) => set({ outKg: v })} className={bad(outKg > 0)} /></Field>
              {stage === 'cut' && <Field label="Pieces / bags"><NumberIn integer unit="pcs" value={f.pieces} onChange={(v) => set({ pieces: v })} className={bad(Number(f.pieces) > 0)} /></Field>}
              {stage === 'cut' && <Field label="Packets / bundles"><NumberIn integer value={f.bundles} onChange={(v) => set({ bundles: v })} /></Field>}
            </div>
            {stage === 'ex' && Number(f.rolls) > 0 && outKg > 0 && <p className="muted" style={{ margin: '12px 2px 0', fontSize: 13 }}>Average roll {fmt(outKg / Number(f.rolls))} kg</p>}
            {stage === 'cut' && gPerPc > 0 && <p className="muted" style={{ margin: '12px 2px 0', fontSize: 13 }}>{fmt(gPerPc)} g per bag{Number(f.bundles) > 0 ? ` · ${fmt(Number(f.pieces) / Number(f.bundles), 0)} per packet` : ''}</p>}
            {picked && inKg > picked.leftKg + 0.5 && <div className="banner" style={{ marginTop: 14 }}><Info className="i" /><span>Batch {picked.e.batch} only has {fmt(picked.leftKg)} kg left. Check the roll weight.</span></div>}
            <Field label="Notes (optional)" className="notes"><textarea className="in" maxLength={400} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Machine stopped 20 min, roll change…" /></Field>
          </section>

          <div className="savebar glass">
            <button className="btn lg" type="submit" disabled={busy}><Save className="i" />{editId ? 'Update entry' : 'Save entry'}</button>
            <span className="hint">{ready ? <>Ready · <span className="kbd">⌘↵</span></> : `${checks.filter(([, ok]) => ok).length} of ${checks.length} done`}</span>
            <span className="grow" />
            {!editId && <button type="button" className="btn gray icon" title="Copy last entry" onClick={copyLast}><CopyPlus className="i" /></button>}
            <button type="button" className="btn gray icon" title="Clear form" onClick={() => reset()}><Eraser className="i" /></button>
          </div>
        </div>

        <aside className="summary">
          <section className="card">
            <div className="card-h"><h2>{stage === 'ex' ? 'Mix to rolls' : 'Rolls to bags'}</h2><span className="grow" /><span className={`pill ${stage}`}><span className="stage-dot" />{S.short}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div className="ring" style={{ '--p': inKg && outKg ? Math.max(0, Math.min(100, (outKg / inKg) * 100)) : 0, '--c': wasteState === 'warn' ? 'var(--orange-fill)' : wasteState === 'bad' ? 'var(--red-fill)' : 'var(--tint)' }}>
                <div><b>{inKg && outKg ? `${fmt((outKg / inKg) * 100)}` : '–'}</b><small>% yield</small></div>
              </div>
              <div className="flow" style={{ flex: 1 }}>
                <div className="flow-row"><span>In</span><b>{fmt(inKg)} kg</b></div>
                <div className="flow-row"><span>Out</span><b>{fmt(outKg)} kg</b></div>
                <div className={`flow-row total ${wasteState === 'warn' ? 'warn' : wasteState === 'bad' ? 'bad' : ''}`}><span>Waste</span><b>{inKg && outKg ? `${fmt(waste)} kg` : '–'}</b></div>
              </div>
            </div>
            {wasteState === 'warn' && <div className="banner" style={{ marginTop: 14 }}><Info className="i" /><span>Waste {fmt(wastePct)}% is above the {limit}% limit. Add a note about what happened.</span></div>}
            {wasteState === 'bad' && <div className="banner" style={{ marginTop: 14 }}><Info className="i" /><span>Out is more than in. Check the weights.</span></div>}
            {stage === 'ex' && f.mats.length > 0 && <><div className="sep" /><MixBar parts={f.mats.map(([name, kg]) => ({ name, kg: Number(kg) || 0 }))} list={lists.materials} /></>}
          </section>
          <section className="card">
            <div className="card-h"><h2>Checklist</h2></div>
            <div className="checklist">{checks.map(([l, ok]) => <div key={l} className={ok ? 'ok' : ''}>{ok ? <Check /> : <Circle />}{l}</div>)}</div>
            <div className="sep" />
            <div style={{ fontSize: 13 }} className="muted">
              {stage === 'ex' ? <>Batch number <span className="batch-no">{editId ? entries.find((x) => x.id === editId)?.batch : nextBatchNo(entries, f.date)}</span> is given on save.</> : 'Each cutting job takes rolls off its batch. Batches with nothing left drop off the waiting list.'}
            </div>
          </section>
        </aside>
      </form>
    </>
  );
}
