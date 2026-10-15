// Adapter for the Vercel functions in api/: a web Request in, a Response out, through the shared API.
// The store and settings are set up once per function instance and reused across requests.
import { createApi, httpError, parseJson } from './core.mjs';
import { openStore } from './store.mjs';

let handle, setupError;
try {
  const env = process.env;
  if (!env.APP_PASSWORD) console.warn('APP_PASSWORD is not set; nobody can sign in.');
  handle = createApi({
    password: env.APP_PASSWORD || '',
    secret: env.SESSION_SECRET,
    secure: env.VERCEL_ENV ? env.VERCEL_ENV !== 'development' : env.NODE_ENV === 'production',
    store: openStore(env),
  });
} catch (err) { setupError = err; }

export async function vercelHandler(request) {
  const url = new URL(request.url);
  const json = (status, data, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
  if (setupError) { console.error(setupError.message); return json(500, { error: 'Server error.' }); }
  try {
    const out = await handle({
      method: request.method,
      path: url.pathname.replace(/\/+$/, ''),
      query: url.searchParams,
      header: (name) => request.headers.get(name),
      // Vercel sets x-forwarded-for itself, so its first address is the client's.
      ip: (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || '',
      async readBody(limit) {
        if (Number(request.headers.get('content-length')) > limit) throw httpError(413, 'Too large');
        const text = await request.text();
        if (Buffer.byteLength(text) > limit) throw httpError(413, 'Too large');
        return parseJson(text);
      },
    });
    return json(out.status, out.body, out.headers);
  } catch (err) {
    if (!err.status) console.error(err);
    return json(err.status || 500, { error: err.status ? err.message : 'Server error.' });
  }
}
