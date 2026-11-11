import { CHANNELS, hasPremiumCredential } from './angelthump.js';
import { refreshRole, renewedSessionCookie, requireSession, sessionId } from './live-access.js';
import { appOrigin, json, LiveError, privateHeaders, readJson, requireOrigin } from './live-http.js';
import { digest, randomId, validId } from './live-crypto.js';
import { db, query, rateLimit, scheduleCleanup } from './live-store.js';

const CAST_SECONDS = 8 * 60 * 60;

export function streamUrl(origin, grant, file, params) {
  const url = new URL(`/api/stream/${grant}/${file}`, origin);
  if (params) url.search = new URLSearchParams(params);
  return url;
}

export async function createPlayback(context) {
  const { request, env } = context;
  requireOrigin(request, env);
  const body = await readJson(request);
  const { channel, mode, receiver } = body || {};
  if (!CHANNELS.includes(channel) || !['normal', 'premium'].includes(mode) || !['browser', 'cast'].includes(receiver)) {
    throw new LiveError(400, 'La emisión solicitada no es válida.');
  }
  if (!validId(env.LIVE_MEDIA_KEY)) throw new LiveError(503, 'El vídeo de Directos requiere configuración.');
  const session = await requireSession(request, env);
  await rateLimit(env, 'playback', session.user_id, 30, 60, Date.now());
  if (mode === 'premium' && !await hasPremiumCredential(env)) throw new LiveError(409, 'Premium no está disponible.');
  const now = Date.now();
  const grant = randomId();
  const expiresAt = receiver === 'cast' ? now + CAST_SECONDS * 1000 : session.expires_at;
  const extendSession = expiresAt > session.expires_at;
  const insert = query(env, `INSERT INTO live_grants (id, session_id, channel, mode, receiver, expires_at)
    SELECT ?, id, ?, ?, ?, ? FROM live_sessions WHERE id = ? AND expires_at > ? AND expires_at >= ?`,
  await digest(grant), channel, mode, receiver, expiresAt, session.session_id, now, expiresAt);
  const created = extendSession ? (await db(env).batch([
    query(env, 'UPDATE live_sessions SET expires_at = MAX(expires_at, ?) WHERE id = ? AND expires_at > ?',
      expiresAt, session.session_id, now),
    query(env, `UPDATE live_grants SET expires_at = MAX(expires_at, ?)
      WHERE session_id = ? AND receiver = 'browser' AND expires_at > ?
        AND EXISTS (SELECT 1 FROM live_sessions s WHERE s.id = live_grants.session_id AND s.expires_at >= ?)`,
    expiresAt, session.session_id, now, expiresAt),
    insert,
  ])).at(-1) : await insert.run();
  if (!created.meta.changes) throw new LiveError(401, 'La sesión de Directos ha terminado.');
  scheduleCleanup(context, now);
  const media = streamUrl(appOrigin(env), grant, 'index.m3u8');
  const response = json({ source: media.pathname, grant, expiresAt, ...(extendSession && { sessionExpiresAt: expiresAt }) });
  if (extendSession) response.headers.append('Set-Cookie', renewedSessionCookie(request, CAST_SECONDS));
  return response;
}

export async function endPlayback({ request, env }) {
  requireOrigin(request, env);
  const session = await sessionId(request);
  const body = await readJson(request);
  if (!session || !validId(body?.grant)) throw new LiveError(401, 'El permiso de reproducción no es válido.');
  await query(env, 'DELETE FROM live_grants WHERE id = ? AND session_id = ?', await digest(body.grant), session).run();
  return new Response(null, { status: 204, headers: privateHeaders() });
}

export async function requirePlayback(request, env, rawGrant) {
  const now = Date.now();
  if (!validId(rawGrant) || new URL(request.url).origin !== appOrigin(env)) throw new LiveError(404, 'Directo no disponible.');
  const grant = await query(env, `SELECT g.*, s.user_id, s.checked_until
    FROM live_grants g JOIN live_sessions s ON s.id = g.session_id
    WHERE g.id = ? AND g.expires_at > ? AND s.expires_at > ?`, await digest(rawGrant), now, now).first();
  if (!grant) throw new LiveError(401, 'El permiso de reproducción ha caducado o se ha revocado.');
  if (grant.receiver === 'browser' && await sessionId(request) !== grant.session_id) {
    throw new LiveError(401, 'Identifícate con Discord para ver este directo.');
  }
  await refreshRole(env, grant, now);
  return grant;
}
