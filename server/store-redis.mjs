// Hosted store: Upstash Redis (what Vercel's "Upstash for Redis" / KV integration creates),
// spoken to over its REST API so no client library is needed.
//   pf:rev        number, bumped on every write
//   pf:settings   settings JSON
//   pf:entries    hash of entry id -> entry JSON
//   pf:fail:<ip>  failed sign-ins, expires ten minutes after the last one
// Writes and full reads go through /multi-exec, so the rev always matches the data it came with.

const FAIL_WINDOW = 600; // seconds

export function redisStore({ url, token, prefix = 'pf:' }) {
  const base = url.replace(/\/+$/, '');
  async function post(pathname, body) {
    const r = await fetch(base + pathname, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data) throw new Error(`Redis ${r.status}: ${data?.error || 'no answer'}`);
    return data;
  }
  const one = async (cmd) => { const d = await post('', cmd); if (d.error) throw new Error(`Redis: ${d.error}`); return d.result; };
  const atomic = async (cmds) => (await post('/multi-exec', cmds)).map((d) => { if (d.error) throw new Error(`Redis: ${d.error}`); return d.result; });

  const K = { rev: prefix + 'rev', settings: prefix + 'settings', entries: prefix + 'entries', fail: (ip) => prefix + 'fail:' + ip };

  return {
    name: `redis (${new URL(base).host})`,
    rev: async () => Number(await one(['GET', K.rev])) || 0,
    async state() {
      const [rev, settings, entries] = await atomic([['GET', K.rev], ['GET', K.settings], ['HVALS', K.entries]]);
      return { rev: Number(rev) || 0, settings: settings ? JSON.parse(settings) : {}, entries: (entries || []).map((e) => JSON.parse(e)) };
    },
    async writeEntries(upsert, removeIds) {
      const cmds = [];
      if (upsert.length) cmds.push(['HSET', K.entries, ...upsert.flatMap((e) => [e.id, JSON.stringify(e)])]);
      if (removeIds.length) cmds.push(['HDEL', K.entries, ...removeIds]);
      cmds.push(['INCR', K.rev]);
      return Number((await atomic(cmds)).at(-1));
    },
    async writeSettings(settings) {
      return Number((await atomic([['SET', K.settings, JSON.stringify(settings)], ['INCR', K.rev]])).at(-1));
    },
    failCount: async (ip) => Number(await one(['GET', K.fail(ip)])) || 0,
    async noteFail(ip) { await atomic([['INCR', K.fail(ip)], ['EXPIRE', K.fail(ip), FAIL_WINDOW]]); },
    async clearFails(ip) { await one(['DEL', K.fail(ip)]); },
  };
}
