// Local store: one JSON file (data/db.json) kept in memory and rewritten after each change.
// Failed sign-ins are counted in memory, so they reset when the server restarts.
import fs from 'node:fs';
import path from 'node:path';

export function fileStore(file) {
  let db = { settings: {}, entries: {}, rev: 0 };
  try { db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  let writing = Promise.resolve();
  function persist() {
    db.rev++;
    const snapshot = JSON.stringify(db);
    writing = writing.then(async () => {
      const tmp = file + '.tmp';
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      await fs.promises.writeFile(tmp, snapshot);
      await fs.promises.rename(tmp, file);
    }).catch((err) => console.error('Could not save', err));
    return writing.then(() => db.rev);
  }

  const attempts = new Map(); // ip -> { n, until }
  const live = (ip) => { const a = attempts.get(ip); return a && a.until > Date.now() ? a : null; };

  return {
    name: `file (${path.relative(process.cwd(), file)})`,
    rev: async () => db.rev,
    state: async () => ({ rev: db.rev, settings: db.settings, entries: Object.values(db.entries) }),
    writeEntries(upsert, removeIds) {
      for (const e of upsert) db.entries[e.id] = e;
      for (const id of removeIds) delete db.entries[id];
      return persist();
    },
    writeSettings(settings) { db.settings = settings; return persist(); },
    failCount: async (ip) => live(ip)?.n || 0,
    async noteFail(ip) { const a = live(ip); attempts.set(ip, { n: a ? a.n + 1 : 1, until: Date.now() + 10 * 60e3 }); },
    async clearFails(ip) { attempts.delete(ip); },
  };
}
