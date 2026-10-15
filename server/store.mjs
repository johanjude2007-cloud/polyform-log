// Picks the store from the environment: Upstash Redis when its REST credentials are set
// (Vercel's integration names them KV_REST_API_* or UPSTASH_REDIS_REST_*), the JSON file otherwise.
// STORE=file or STORE=redis forces one.
import { fileStore } from './store-file.mjs';
import { redisStore } from './store-redis.mjs';

export function openStore(env, { file } = {}) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  const kind = env.STORE || (url && token ? 'redis' : 'file');
  if (kind === 'redis') {
    if (!url || !token) throw new Error('STORE=redis needs KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).');
    return redisStore({ url, token, prefix: env.STORE_PREFIX || 'pf:' });
  }
  if (!file) throw new Error('No hosted store is set up. Add Upstash Redis to the Vercel project (see README).');
  return fileStore(file);
}
