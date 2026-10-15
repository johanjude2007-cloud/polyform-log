import { useState } from 'react';
import { AlertCircle, Factory } from 'lucide-react';
import { useStore } from '../lib/store.jsx';

export default function Login() {
  const { login } = useStore();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await login(pw); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <section className="login" data-stage="ex">
      <form className="login-card" onSubmit={submit}>
        <div className="brand"><div className="mark"><Factory /></div><div><b>Production Log</b><small>Polyform Plastics</small></div></div>
        <label className="field"><span>Password</span>
          <input className={`in ${err ? 'bad' : ''}`} type="password" autoComplete="current-password" autoFocus required value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <p className="err"><AlertCircle className="i" style={{ width: 16 }} />{err}</p>}
        <button className="btn lg" disabled={busy || !pw}>{busy ? 'Signing in…' : 'Log in'}</button>
        <p className="faint" style={{ margin: 0, fontSize: 13, textAlign: 'center' }}>Shared log for the extrusion and cutting teams</p>
      </form>
    </section>
  );
}
