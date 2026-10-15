// Shared state: everything is saved on the server so every tablet sees one log.
// Saves made while the network is down wait in an outbox and go up on the next sync.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LIMITS, DEFAULT_LISTS, DEFAULT_RECIPES, SETTINGS_VERSION, demoTargets, sampleEntries } from './data.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

class LoginNeeded extends Error { quiet = true; }
class Offline extends Error {}

async function call(method, url, body) {
  let r;
  try {
    r = await fetch(url, { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'polyform', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Offline('No connection. Saved on this tablet; it will sync when the network is back.'); }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith('/login')) throw new LoginNeeded();
  if (!r.ok) throw new Error(data.error || 'The server did not answer. Try again.');
  return data;
}

const readOutbox = () => { try { return JSON.parse(localStorage.getItem('pf-outbox') || '[]'); } catch { return []; } };
const writeOutbox = (ops) => { try { localStorage.setItem('pf-outbox', JSON.stringify(ops)); } catch {} };

export function normalizeSettings(s = {}) {
  return {
    lists: { ...structuredClone(DEFAULT_LISTS), ...(s.lists || {}) },
    weekStart: Number(s.weekStart ?? 1),
    version: Number(s.version || SETTINGS_VERSION),
    recipes: s.recipes || DEFAULT_RECIPES,
    limits: { ...DEFAULT_LIMITS, ...(s.limits || {}) },
    orders: s.orders || {},
  };
}

export function StoreProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | login | ready
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState(normalizeSettings());
  const [sync, setSync] = useState({ ok: true, at: null, pending: readOutbox().length });
  const rev = useRef(0);
  const outbox = useRef(readOutbox());

  const applyLocal = useCallback((upsert, remove) => {
    const gone = new Set(remove.map((x) => x.id));
    const put = new Map(upsert.map((e) => [e.id, e]));
    setEntries((list) => [...list.filter((e) => !gone.has(e.id) && !put.has(e.id)), ...put.values()]);
  }, []);

  const flush = useCallback(async () => {
    while (outbox.current.length) {
      const op = outbox.current[0];
      await call('POST', '/api/entries', op);
      outbox.current = outbox.current.slice(1); writeOutbox(outbox.current);
    }
  }, []);

  const load = useCallback(async ({ full } = {}) => {
    try {
      await flush();
      const st = await call('GET', `/api/state${!full && rev.current ? `?rev=${rev.current}` : ''}`);
      if (st.unchanged) { setSync({ ok: true, at: Date.now(), pending: 0 }); return; }
      if (!st.settings?.initialized) { // first ever visit: fill in the demo
        const demo = sampleEntries();
        await call('POST', '/api/entries', { upsert: demo });
        await call('PUT', '/api/settings', { ...normalizeSettings(), orders: demoTargets(demo), version: SETTINGS_VERSION });
        return load({ full: true });
      }
      rev.current = st.rev;
      setSettings(normalizeSettings(st.settings));
      const local = new Map(st.entries.map((e) => [e.id, e]));
      for (const op of outbox.current) { op.upsert?.forEach((e) => local.set(e.id, e)); op.remove?.forEach((x) => local.delete(x.id)); }
      setEntries([...local.values()]);
      setStatus('ready');
      setSync({ ok: true, at: Date.now(), pending: outbox.current.length });
    } catch (err) {
      if (err instanceof LoginNeeded) { setStatus('login'); return; }
      setSync((s) => ({ ...s, ok: false, pending: outbox.current.length }));
      if (status === 'loading' && err instanceof Offline) setStatus('ready');
    }
  }, [flush, status]);

  useEffect(() => { load({ full: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status !== 'ready') return;
    const t = setInterval(() => { if (!document.hidden) load(); }, 20000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', vis); window.addEventListener('online', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', vis); };
  }, [status, load]);

  const saveMany = useCallback(async (upsert, remove = []) => {
    applyLocal(upsert, remove);
    try {
      await flush();
      const r = await call('POST', '/api/entries', { upsert, remove });
      rev.current = 0; // force a full read next time so other tablets' changes merge in
      applyLocal(r.saved, []);
      setSync({ ok: true, at: Date.now(), pending: 0 });
      return { offline: false };
    } catch (err) {
      if (err instanceof LoginNeeded) { setStatus('login'); throw err; }
      if (err instanceof Offline) {
        outbox.current = [...outbox.current, { upsert, remove }]; writeOutbox(outbox.current);
        setSync({ ok: false, at: Date.now(), pending: outbox.current.length });
        return { offline: true };
      }
      throw err;
    }
  }, [applyLocal, flush]);

  const saveSettings = useCallback(async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try { await call('PUT', '/api/settings', next); rev.current = 0; }
    catch (err) { if (err instanceof LoginNeeded) setStatus('login'); else throw err; }
  }, [settings]);

  const login = useCallback(async (password) => { await call('POST', '/api/login', { password }); setStatus('loading'); await load({ full: true }); }, [load]);
  const logout = useCallback(async () => { try { await call('POST', '/api/logout'); } catch {} setStatus('login'); }, []);

  const value = useMemo(() => ({
    status, entries, settings, sync, lists: settings.lists,
    saveMany, save: (e) => saveMany([e]), remove: (e) => saveMany([], [{ id: e.id, date: e.date }]),
    saveSettings, login, logout, reload: () => load({ full: true }),
  }), [status, entries, settings, sync, saveMany, saveSettings, login, logout, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
