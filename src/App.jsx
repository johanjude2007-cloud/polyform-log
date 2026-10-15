// App shell: floating glass sidebar (tablet landscape / desktop) or glass tab bar (phone),
// hash routes, the global stage switch, the command palette and the batch/entry sheets.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Boxes, ClipboardList, Factory, LayoutGrid, LogOut, Moon, PenLine, Scissors, Search, Settings2, Sun, SunMoon, BarChart3 } from 'lucide-react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { ToastProvider, Seg } from './components/ui.jsx';
import { openBatches, ordersOf } from './lib/data.js';
import Login from './views/Login.jsx';
import Overview from './views/Overview.jsx';
import EntryForm from './views/EntryForm.jsx';
import Batches, { BatchSheet } from './views/Batches.jsx';
import Orders from './views/Orders.jsx';
import Reports, { EntrySheet } from './views/Reports.jsx';
import Settings from './views/Settings.jsx';
import Palette from './components/Palette.jsx';

const ROUTES = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, View: Overview },
  { id: 'log', label: 'New entry', tab: 'Log', icon: PenLine, View: EntryForm },
  { id: 'batches', label: 'Batches', icon: Boxes, View: Batches },
  { id: 'orders', label: 'Orders', icon: ClipboardList, View: Orders },
  { id: 'reports', label: 'Reports', icon: BarChart3, View: Reports },
  { id: 'settings', label: 'Lists & settings', tab: 'Settings', icon: Settings2, View: Settings },
];

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const readHash = () => { const id = location.hash.replace(/^#\/?/, '').split('?')[0]; return ROUTES.some((r) => r.id === id) ? id : 'overview'; };

export default function App() {
  return <ToastProvider><StoreProvider><Gate /></StoreProvider></ToastProvider>;
}

function Gate() {
  const { status } = useStore();
  if (status === 'login') return <Login />;
  if (status === 'loading') return <div className="login"><div className="faint">Loading the production log…</div></div>;
  return <Shell />;
}

function Shell() {
  const { entries, settings, sync, logout } = useStore();
  const [route, setRoute] = useState(readHash);
  const [stage, setStageRaw] = useState(() => { try { return localStorage.getItem('pf-stage') === 'cut' ? 'cut' : 'ex'; } catch { return 'ex'; } });
  const [sheet, setSheet] = useState(null); // { kind: 'batch', batch } | { kind: 'entry', id }
  const [editing, setEditing] = useState(null); // { entry, asCopy }
  const [palette, setPalette] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'auto');

  useEffect(() => { const f = () => { setRoute(readHash()); window.scrollTo({ top: 0 }); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => { const f = () => setScrolled(window.scrollY > 24); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  useEffect(() => { document.body.dataset.stage = stage; try { localStorage.setItem('pf-stage', stage); } catch {} }, [stage]);
  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === '/') { e.preventDefault(); setPalette(true); }
        const n = Number(e.key); if (n >= 1 && n <= ROUTES.length && !palette && !sheet) go(ROUTES[n - 1].id);
      }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const go = useCallback((id) => { location.hash = `/${id}`; window.scrollTo({ top: 0 }); }, []);
  const setStage = useCallback((s) => setStageRaw(s), []);
  const cycleTheme = () => {
    const next = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
    setTheme(next);
    if (next === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pf-theme', next); } catch {}
  };

  const app = useMemo(() => ({
    route, go, stage, setStage,
    openBatch: (batch) => setSheet({ kind: 'batch', batch }),
    openEntry: (id) => setSheet({ kind: 'entry', id }),
    closeSheet: () => setSheet(null),
    edit: (entry, asCopy = false) => { setSheet(null); setStageRaw(entry.stage === 'cut' ? 'cut' : 'ex'); setEditing({ entry, asCopy, at: Date.now() }); go('log'); },
    cutBatch: (b) => { setSheet(null); setStageRaw('cut'); setEditing({ batch: b, at: Date.now() }); go('log'); },
    editing, clearEditing: () => setEditing(null),
    openPalette: () => setPalette(true),
  }), [route, go, stage, setStage, editing]);

  const waiting = useMemo(() => openBatches(entries).length, [entries]);
  const lateOrders = useMemo(() => ordersOf(entries, settings.orders).filter((o) => o.state === 'late').length, [entries, settings.orders]);
  const counts = { batches: waiting, orders: lateOrders };
  const R = ROUTES.find((r) => r.id === route);
  const View = R.View;
  const stageSwitch = route === 'log' || route === 'reports';
  const ThemeIcon = theme === 'auto' ? SunMoon : theme === 'light' ? Sun : Moon;
  const syncText = sync.pending ? `${sync.pending} waiting to sync` : sync.ok ? 'Synced · all tablets' : 'Offline · retrying';

  return (
    <AppCtx.Provider value={app}>
      <div className="shell">
        <aside className="sidebar glass" aria-label="Main">
          <div className="brand"><div className="mark"><Factory /></div><div><b>Production Log</b><small>Polyform Plastics</small></div></div>
          <button className="btn gray" style={{ justifyContent: 'flex-start', height: 36, borderRadius: 11, marginBottom: 6, fontWeight: 500, color: 'var(--label-2)' }} onClick={() => setPalette(true)}>
            <Search className="i" style={{ width: 16 }} /> Search <span style={{ flex: 1 }} /><span className="kbd">⌘K</span>
          </button>
          <nav className="nav">
            {ROUTES.slice(0, 5).map((r, i) => (
              <a key={r.id} href={`#/${r.id}`} aria-current={route === r.id ? 'page' : undefined} title={`${r.label} (${i + 1})`}>
                <r.icon className="i" />{r.label}
                {counts[r.id] ? <span className={`count ${r.id === 'orders' ? 'alert' : ''}`}>{counts[r.id]}</span> : null}
              </a>
            ))}
            <div className="nav-sec">Setup</div>
            <a href="#/settings" aria-current={route === 'settings' ? 'page' : undefined}><Settings2 className="i" />Lists & settings</a>
          </nav>
          <div className="side-foot">
            <div className={`sync ${sync.ok && !sync.pending ? '' : 'off'}`}><i />{syncText}</div>
            <div className="side-actions">
              <button className="btn plain sm" style={{ color: 'var(--label-2)' }} onClick={cycleTheme} title={`Appearance: ${theme}`}><ThemeIcon className="i" style={{ width: 16 }} />{theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}</button>
              <button className="btn plain sm" style={{ color: 'var(--label-2)' }} onClick={logout}><LogOut className="i" style={{ width: 16 }} />Log out</button>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className={`toolbar ${scrolled ? 'scrolled' : ''}`}>
            <div className="toolbar-in glass">
              <span className="t-title">{R.label}</span>
              <span className="spacer" />
              {stageSwitch && <StageSwitch />}
              <button className="btn glass icon mobile-only" onClick={() => setPalette(true)} aria-label="Search"><Search className="i" /></button>
              <button className="btn glass icon mobile-only" onClick={cycleTheme} aria-label="Appearance"><ThemeIcon className="i" /></button>
              <a className="btn glass icon mobile-only" href="#/settings" aria-label="Lists & settings"><Settings2 className="i" /></a>
            </div>
          </header>
          <main className="page" key={route}>
            <View />
          </main>
        </div>

        <nav className="tabbar glass" aria-label="Main">
          {ROUTES.slice(0, 5).map((r) => (
            <a key={r.id} href={`#/${r.id}`} aria-current={route === r.id ? 'page' : undefined}>
              <r.icon />{r.tab || r.label}{counts[r.id] && r.id === 'orders' ? <span className="dot">{counts[r.id]}</span> : null}
            </a>
          ))}
        </nav>
      </div>
      {sheet?.kind === 'batch' && <BatchSheet batch={sheet.batch} />}
      {sheet?.kind === 'entry' && <EntrySheet id={sheet.id} />}
      {palette && <Palette onClose={() => setPalette(false)} routes={ROUTES} />}
    </AppCtx.Provider>
  );
}

export function StageSwitch({ block }) {
  const { stage, setStage } = useApp();
  return (
    <Seg className={`stage ${block ? 'block lg' : ''}`} label="Stage" value={stage} onChange={setStage} options={[
      { value: 'ex', label: 'Extrusion', icon: <Factory />, title: 'Extrusion & rolling' },
      { value: 'cut', label: 'Cutting', icon: <Scissors />, title: 'Cutting & finishing' },
    ]} />
  );
}
