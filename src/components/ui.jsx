// Shared building blocks: segmented control, fields, sheets, toasts, stat tiles and the small SVG charts.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Inbox, Info, X } from 'lucide-react';
import { fmt } from '../lib/data.js';

// ------------------------------------------------------------ segmented control
export function Seg({ value, onChange, options, className = '', label }) {
  const ref = useRef(null);
  const [thumb, setThumb] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector('[aria-pressed="true"]');
    if (el) setThumb({ x: el.offsetLeft - 3, w: el.offsetWidth });
  }, [value, options.length]);
  useEffect(() => {
    const ro = new ResizeObserver(() => { const el = ref.current?.querySelector('[aria-pressed="true"]'); if (el) setThumb({ x: el.offsetLeft - 3, w: el.offsetWidth }); });
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div className={`seg ${className}`} ref={ref} role="group" aria-label={label}>
      {thumb && <span className="thumb" style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }} />}
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} title={o.title}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, className = '' }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}

export function Select({ value, onChange, items, placeholder = 'Choose…', allowEmpty, className = '', ...rest }) {
  const opts = [...items];
  if (value && !opts.includes(value)) opts.push(value); // keep an old value visible when editing
  return (
    <select className={`in ${className}`} value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="" disabled={!allowEmpty}>{placeholder}</option>
      {opts.map((v) => <option key={v} value={v}>{v}</option>)}
    </select>
  );
}

export function NumberIn({ value, onChange, unit, step = '0.1', integer, className = '', ...rest }) {
  return (
    <div className="unit">
      <input className={`in num ${className}`} type="number" inputMode={integer ? 'numeric' : 'decimal'} min="0" step={integer ? '1' : step}
        value={value} onChange={(e) => onChange(e.target.value)} onWheel={(e) => e.currentTarget.blur()} {...rest} />
      {unit && <em>{unit}</em>}
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, children, action }) {
  return <div className="empty"><Icon /><b>{title}</b>{children && <span>{children}</span>}{action}</div>;
}

// ------------------------------------------------------------ overlays
function useEscape(onClose) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);
}
export function Sheet({ title, onClose, children, actions, stage }) {
  useEscape(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} data-stage={stage}>
        <div className="sheet-h"><h2>{title}</h2>{actions}<button className="btn gray icon sm" onClick={onClose} aria-label="Close"><X className="i" /></button></div>
        <div className="sheet-b">{children}</div>
      </aside>
    </>
  );
}
export function Confirm({ title, body, confirmLabel = 'Delete', onConfirm, onClose, danger = true }) {
  useEscape(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {body && <p>{body}</p>}
        <div className="actions">
          <button className="btn gray" onClick={onClose} autoFocus>Cancel</button>
          <button className={`btn ${danger ? 'danger' : ''}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------ toasts
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((text, { tone = 'ok', action, ms = 3600 } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setList((l) => [...l.slice(-2), { id, text, tone, action }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), action ? ms + 2400 : ms);
  }, []);
  const Icon = { ok: CheckCircle2, warn: AlertTriangle, bad: AlertTriangle, info: Info };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {list.map((t) => { const I = Icon[t.tone] || Info; return (
          <div key={t.id} className={`toast glass ${t.tone}`}>
            <I className="i" /><span className="t">{t.text}</span>
            {t.action && <button className="btn sm tinted" onClick={() => { t.action.run(); setList((l) => l.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ); })}
      </div>
    </ToastCtx.Provider>
  );
}

// ------------------------------------------------------------ stats
export function Stat({ label, icon: Icon, value, unit, delta, deltaGood = 'up', warn, spark, sparkClass }) {
  let d = null;
  if (delta != null && Number.isFinite(delta)) {
    const up = delta >= 0; const good = (up && deltaGood === 'up') || (!up && deltaGood === 'down');
    d = <div className={`d ${Math.abs(delta) < 0.05 ? '' : good ? 'up' : 'down'}`}>{up ? <ArrowUpRight /> : <ArrowDownRight />}{fmt(Math.abs(delta))}{deltaGood === 'pts' ? ' pts' : '%'} <span className="faint" style={{ fontWeight: 500 }}>vs previous</span></div>;
  }
  return (
    <div className={`stat ${warn ? 'warn' : ''}`}>
      <div className="k">{Icon && <Icon />}{label}</div>
      <div className="v">{value}{unit && <small>{unit}</small>}</div>
      {d}
      {spark && <Spark values={spark} className={sparkClass} />}
    </div>
  );
}

export function Spark({ values, className = '' }) {
  const w = 160, h = 30, max = Math.max(1, ...values);
  const bw = w / values.length;
  return (
    <svg className={`chart spark ${className}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {values.map((v, i) => <rect key={i} className={`bar ${className}`} x={i * bw + 1} width={Math.max(1, bw - 2)} y={h - (v / max) * h} height={(v / max) * h} rx="1.5" opacity={i === values.length - 1 ? 1 : 0.45} />)}
    </svg>
  );
}

// Bars (one or two stacked series) with an optional line on a second axis.
export function ComboChart({ data, series, line, limit, height = 220, fmtTip, grouped }) {
  const wrap = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const pad = { l: 44, r: line ? 40 : 8, t: 10, b: 24 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const stackMax = Math.max(1, ...data.map((d) => (grouped ? Math.max(...series.map((s) => d[s.key] || 0)) : series.reduce((a, s) => a + (d[s.key] || 0), 0))));
  const nice = niceMax(stackMax);
  const lineVals = line ? data.map((d) => d[line.key]).filter((v) => v != null) : [];
  const lMax = line ? niceMax(Math.max(limit || 0, ...lineVals, 1) * 1.15) : 1;
  const bw = iw / data.length;
  const y = (v) => pad.t + ih - (v / nice) * ih;
  const ly = (v) => pad.t + ih - (v / lMax) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * nice);
  const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 56)));
  const pts = line ? data.map((d, i) => (d[line.key] == null ? null : [pad.l + i * bw + bw / 2, ly(d[line.key])])) : [];
  const path = pts.reduce((acc, p, i) => (p ? acc + `${acc && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : acc), '');
  return (
    <div className="chart-wrap" ref={wrap}>
      <svg className="chart" width={w} height={height} role="img">
        {ticks.map((t) => <g key={t}><line className="grid-l" x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} /><text x={pad.l - 8} y={y(t) + 4} textAnchor="end">{shortNum(t)}</text></g>)}
        {line && [0, 0.5, 1].map((f) => <text key={f} x={w - pad.r + 8} y={ly(f * lMax) + 4}>{fmt(f * lMax, 0)}%</text>)}
        {hover != null && <rect className="hl" x={pad.l + hover * bw} y={pad.t} width={bw} height={ih} rx="6" />}
        {data.map((d, i) => {
          let acc = 0;
          const gw = (bw * 0.7) / series.length;
          return <g key={i}>{series.map((s, si) => {
            const v = d[s.key] || 0; const hh = (v / nice) * ih;
            const y0 = grouped ? y(v) : y(acc + v); if (!grouped) acc += v;
            const x = grouped ? pad.l + i * bw + bw * 0.15 + si * gw : pad.l + i * bw + bw * 0.18;
            return v > 0 && <rect key={s.key} className={`bar ${s.cls || ''}`} x={x + (grouped ? 0.5 : 0)} width={grouped ? Math.max(1, gw - 1) : bw * 0.64} y={y0} height={Math.max(0.5, hh)} rx={Math.min(3, gw * 0.3)} />;
          })}</g>;
        })}
        {limit != null && line && <line className="limit" x1={pad.l} x2={w - pad.r} y1={ly(limit)} y2={ly(limit)} />}
        {line && <path className="line" d={path} />}
        {line && pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 4 : 2.5} fill="var(--orange-fill)" stroke="var(--bg-2)" strokeWidth="1.5" />)}
        {data.map((d, i) => i % every === 0 && <text key={i} x={pad.l + i * bw + bw / 2} y={height - 6} textAnchor="middle">{d.label}</text>)}
        {data.map((d, i) => <rect key={i} className="hit" x={pad.l + i * bw} y={pad.t} width={bw} height={ih} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} />)}
      </svg>
      {hover != null && fmtTip && (
        <div className="chart-tip glass" style={{ left: Math.min(w - 80, Math.max(80, pad.l + hover * bw + bw / 2)), top: pad.t + 20 }}>{fmtTip(data[hover])}</div>
      )}
    </div>
  );
}
function niceMax(v) { const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
const shortNum = (v) => (v >= 1000 ? `${fmt(v / 1000, 1)}k` : fmt(v, 0));

export function HBars({ rows, warnAt }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.label} title={r.title}>
          <span className="lbl">{r.label}</span>
          <div className="track"><div className={`fill ${warnAt != null && r.flag ? 'warn' : ''}`} style={{ width: `${(r.value / max) * 100}%`, background: r.color }} /></div>
          <span className="val">{r.display}{r.sub && <small>{r.sub}</small>}</span>
        </div>
      ))}
    </div>
  );
}

// Fixed colours per material so a mix reads the same on every screen.
const MAT_COLOURS = { 'Black LD': '#48484a', 'Mix LD': '#30b0c7', Filler: '#c4a27c', 'Master batch': '#7d7aff', Desiccant: '#ff9f0a' };
const FALLBACK = ['#34c759', '#ff2d55', '#a2845e', '#5ac8fa', '#af52de', '#ffcc00'];
export function matColour(name, list = []) {
  if (MAT_COLOURS[name]) return MAT_COLOURS[name];
  const i = Math.max(0, list.filter((n) => !MAT_COLOURS[n]).indexOf(name));
  return FALLBACK[i % FALLBACK.length];
}
export function MixBar({ parts, list }) {
  const total = parts.reduce((a, p) => a + p.kg, 0);
  return (
    <div>
      <div className="mixbar">{total > 0 && parts.filter((p) => p.kg > 0).map((p) => <span key={p.name} style={{ width: `${(p.kg / total) * 100}%`, background: matColour(p.name, list) }} title={`${p.name} ${fmt(p.kg)} kg`} />)}</div>
      <div className="mix-legend">{parts.map((p) => <span key={p.name}><i style={{ background: matColour(p.name, list) }} />{p.name} {total ? Math.round((p.kg / total) * 100) : 0}%</span>)}</div>
    </div>
  );
}

const SWATCH = { Black: '#1c1c1e', Natural: '#efe9da', White: '#ffffff', Blue: '#0a84ff', Green: '#34c759', Yellow: '#ffd60a', Red: '#ff3b30', Clear: '#e8f4f8', Orange: '#ff9500', Grey: '#8e8e93', Gray: '#8e8e93' };
export const swatchOf = (c) => SWATCH[c] || '#c7c7cc';
