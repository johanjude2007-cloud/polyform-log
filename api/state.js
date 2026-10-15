// /api/state on Vercel; the logic lives in server/core.mjs, shared with the local server.
import { vercelHandler } from '../server/vercel.mjs';

export const GET = vercelHandler;
