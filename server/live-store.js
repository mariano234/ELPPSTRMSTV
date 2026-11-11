import { LiveError } from './live-http.js';
import { digest } from './live-crypto.js';

export function db(env) {
  if (!env.LIVE_DB) throw new LiveError(503, 'La sesión de Directos requiere configuración.');
  return env.LIVE_DB;
}

export function query(env, sql, ...args) {
  return db(env).prepare(sql).bind(...args);
}

export async function rateLimit(env, action, subject, limit, seconds, now) {
  const window = seconds * 1000;
  const expires = Math.floor(now / window) * window + window;
  const bucket = await digest(`${action}:${subject}:${expires}`);
  const row = await query(env, `INSERT INTO live_limits (bucket, hits, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1 RETURNING hits`, bucket, expires).first();
  if (row.hits > limit) throw new LiveError(429, 'Demasiadas solicitudes. Inténtalo de nuevo en un momento.', Math.ceil((expires - now) / 1000));
}

export function scheduleCleanup(context, now) {
  if (!context.waitUntil || Math.random() >= 0.05) return;
  const env = context.env;
  context.waitUntil(db(env).batch([
    query(env, 'DELETE FROM live_grants WHERE expires_at <= ?', now),
    query(env, 'DELETE FROM live_sessions WHERE expires_at <= ?', now),
    query(env, 'DELETE FROM live_logins WHERE expires_at <= ?', now),
    query(env, 'DELETE FROM live_limits WHERE expires_at <= ?', now),
  ]).catch(() => { /* Expiry checks still reject expired rows if cleanup fails. */ }));
}
