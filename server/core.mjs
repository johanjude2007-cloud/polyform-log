// The API both hosts share: the local node:http server and the Vercel functions in api/.
// Each host turns its request into { method, path, query, header(name), ip, readBody(limit) }
// and sends back the { status, body, headers } this returns. Storage is the store passed in.
import crypto from 'node:crypto';

const SESSION_DAYS = 30;
const MAX_ENTRY = 8000;
const MAX_TRIES = 5;

export function createApi({ password = '', secret, secure = false, store }) {
  const SECRET = secret || crypto.createHash('sha256').update('pf:' + password).digest('hex');

  // ---------------------------------------------------------- sessions
  const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
  function makeToken() {
    const body = `${Date.now() + SESSION_DAYS * 864e5}.${crypto.randomBytes(9).toString('base64url')}`;
    return `${body}.${sign(body)}`;
  }
  function validToken(tok) {
    if (!tok) return false;
    const i = tok.lastIndexOf('.');
    const body = tok.slice(0, i), mac = tok.slice(i + 1);
    const want = sign(body);
    if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return false;
    return Number(body.split('.')[0]) > Date.now();
  }
  const cookieFlags = `Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;

  const reply = (status, body, headers = {}) => ({ status, body, headers });

  return async function handle(req) {
    const route = `${req.method} ${req.path}`;

    if (route === 'POST /api/login') {
      if (await store.failCount(req.ip) >= MAX_TRIES) return reply(429, { error: 'Too many tries. Wait ten minutes and try again.' });
      const { password: given } = await req.readBody(2000);
      const ok = password && typeof given === 'string' && given.length === password.length
        && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(password));
      if (!ok) { await store.noteFail(req.ip); return reply(401, { error: 'That password is not right.' }); }
      await store.clearFails(req.ip);
      return reply(200, { ok: true }, { 'Set-Cookie': `pf_session=${makeToken()}; ${cookieFlags}; Max-Age=${SESSION_DAYS * 86400}` });
    }
    if (route === 'POST /api/logout') return reply(200, { ok: true }, { 'Set-Cookie': `pf_session=; ${cookieFlags}; Max-Age=0` });

    if (!validToken(parseCookies(req.header('cookie')).pf_session)) return reply(401, { error: 'Please log in.' });
    if (req.method !== 'GET' && req.header('x-requested-with') !== 'polyform') return reply(403, { error: 'Blocked.' });

    if (route === 'GET /api/state') {
      const since = Number(req.query.get('rev'));
      if (since) {
        const rev = await store.rev();
        if (since === rev) return reply(200, { rev, unchanged: true });
      }
      return reply(200, await store.state());
    }
    if (route === 'POST /api/entries') {
      const { upsert = [], remove = [] } = await req.readBody(4e6);
      if (!Array.isArray(upsert) || !Array.isArray(remove) || upsert.length > 2000 || remove.length > 2000) return reply(400, { error: 'Bad request.' });
      const saved = [];
      for (const raw of upsert) { const e = cleanEntry(raw); if (!e) return reply(400, { error: 'An entry was not valid.' }); saved.push(e); }
      const ids = remove.filter((r) => r && typeof r.id === 'string').map((r) => r.id);
      const rev = await store.writeEntries(saved, ids);
      return reply(200, { rev, saved });
    }
    if (route === 'PUT /api/settings') {
      const s = await req.readBody(200000);
      if (!s || typeof s !== 'object' || Array.isArray(s)) return reply(400, { error: 'Bad settings.' });
      const settings = { ...s, initialized: true };
      const rev = await store.writeSettings(settings);
      return reply(200, { rev, settings });
    }
    return reply(404, { error: 'Not found.' });
  };
}

function cleanEntry(e) {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !/^[\w-]{1,40}$/.test(e.id)) return null;
  if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return null;
  const json = JSON.stringify(e);
  if (json.length > MAX_ENTRY) return null;
  const out = JSON.parse(json);
  delete out.prevDate;
  out.updatedAt = Date.now();
  return out;
}

const parseCookies = (header) => Object.fromEntries((header || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));

export const httpError = (status, message) => Object.assign(new Error(message), { status });

export function parseJson(text) {
  try { return text ? JSON.parse(text) : {}; } catch { throw httpError(400, 'Bad JSON'); }
}
