import { ApiError } from './sheets.mjs';
import { timingSafeEqual } from 'node:crypto';

export function respond(res, err) {
  if (!(err instanceof ApiError)) console.error('[The Lab API]', err);
  return res.status(err?.status ?? 500).json({ error: err instanceof ApiError ? err.message : err?.message || 'Unexpected server error.', code: err?.code || 'error' });
}

export function requireAdmin(req) {
  const stored = process.env.ADMIN_KEY || '';
  const received = String(req.headers['x-admin-key'] || '');
  const a = Buffer.from(stored); const b = Buffer.from(received);
  if (!stored || a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError('Incorrect admin password.', 401, 'admin_auth');
}

export function only(req, method) {
  if (req.method !== method) throw new ApiError('Method not allowed.', 405, 'method');
}
