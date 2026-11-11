import { appOrigin, fetchProvider, json, LiveError, privateHeaders, requireOrigin } from './live-http.js';
import { digest, randomId, validId } from './live-crypto.js';
import { db, query, rateLimit, scheduleCleanup } from './live-store.js';
import { hasPremiumCredential } from './angelthump.js';

const DISCORD = 'https://discord.com';
const SESSION_COOKIE = '__Host-pp_session';
const LOGIN_COOKIE = '__Host-pp_login';
const SESSION_SECONDS = 12 * 60 * 60;
const ROLE_CHECK_MS = 5 * 60 * 1000;

function cookie(request, name) {
  const prefix = `${name}=`;
  const value = request.headers.get('Cookie')?.split(';').map(entry => entry.trim())
    .find(entry => entry.startsWith(prefix))?.slice(prefix.length);
  return validId(value) ? value : null;
}

function setCookie(name, value, seconds) {
  return `${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`;
}

function redirect(url, cookies = []) {
  const headers = privateHeaders({ Location: url });
  for (const entry of cookies) headers.append('Set-Cookie', entry);
  return new Response(null, { status: 303, headers });
}

function discordConfig(env) {
  const roles = [env.ROLE_ID, env.PATREON_ROLE_ID, env.PATREON_COLLABORATOR_ROLE_ID].filter(Boolean);
  if (!roles.length || !roles.every(role => /^\d+$/.test(role)) || !/^\d+$/.test(env.GUILD_ID || '') || !env.BOT_TOKEN) {
    throw new LiveError(503, 'Los roles de Discord requieren configuración.');
  }
  return roles;
}

async function discordRoleAllowed(env, userId) {
  const roles = discordConfig(env);
  const result = await fetchProvider(`${DISCORD}/api/v10/guilds/${env.GUILD_ID}/members/${userId}`, {
    headers: { Authorization: `Bot ${env.BOT_TOKEN}` },
  });
  if (result.status === 404) return false;
  if (result.status === 429) throw new LiveError(503, 'Discord está ocupado. Inténtalo en un momento.', 5);
  if (!result.ok) throw new LiveError(503, 'No se pudo verificar el rol con Discord.');
  const member = await result.json();
  return Array.isArray(member.roles) && roles.some(role => member.roles.includes(role));
}

export async function sessionId(request) {
  const value = cookie(request, SESSION_COOKIE);
  return value ? digest(value) : null;
}

export function renewedSessionCookie(request, seconds) {
  const value = cookie(request, SESSION_COOKIE);
  if (!value) throw new LiveError(401, 'La sesión de Directos ha terminado.');
  return setCookie(SESSION_COOKIE, value, seconds);
}

async function revokeSession(env, id) {
  if (id) await query(env, 'DELETE FROM live_sessions WHERE id = ?', id).run();
}

function discordRedirect(env) {
  return `${appOrigin(env)}/api/auth/callback`;
}

export async function startLogin(context) {
  const { request, env } = context;
  const origin = appOrigin(env);
  if (new URL(request.url).origin !== origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new LiveError(403, 'Abre Directos para iniciar sesión.');
  }
  if (!env.CLIENT_ID || !env.CLIENT_SECRET) throw new LiveError(503, 'El acceso con Discord requiere configuración.');
  discordConfig(env);
  const now = Date.now();
  await rateLimit(env, 'login', request.headers.get('CF-Connecting-IP') || 'local', 12, 60, now);
  const login = randomId();
  const state = randomId();
  const verifier = randomId();
  await query(env, 'INSERT INTO live_logins (id, state_hash, verifier, expires_at) VALUES (?, ?, ?, ?)',
    await digest(login), await digest(state), verifier, now + 600000).run();
  scheduleCleanup(context, now);
  const url = new URL('/oauth2/authorize', DISCORD);
  url.search = new URLSearchParams({
    client_id: env.CLIENT_ID, response_type: 'code', scope: 'identify', redirect_uri: discordRedirect(env),
    state, code_challenge: await digest(verifier), code_challenge_method: 'S256',
  });
  return redirect(url.href, [setCookie(LOGIN_COOKIE, login, 600)]);
}

export async function finishLogin({ request, env }) {
  const url = new URL(request.url);
  const origin = appOrigin(env);
  if (url.origin !== origin) throw new LiveError(403, 'Origen de inicio de sesión inválido.');
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const issuer = url.searchParams.get('iss');
  const login = cookie(request, LOGIN_COOKIE);
  const clear = setCookie(LOGIN_COOKIE, '', 0);
  const finish = reason => redirect(`${origin}/directos?login=${reason}`, [clear]);
  if (!login || !validId(state) || (issuer && issuer !== DISCORD)) return finish('invalid');

  const attempt = await query(env, `DELETE FROM live_logins WHERE id = ? AND state_hash = ? AND expires_at > ?
    RETURNING verifier`, await digest(login), await digest(state), Date.now()).first();
  if (!attempt) return finish('invalid');
  if (url.searchParams.get('error') === 'access_denied') return finish('cancelled');
  if (!code || code.length > 2048) return finish('invalid');
  try {
    const token = await fetchProvider(`${DISCORD}/api/oauth2/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.CLIENT_ID, client_secret: env.CLIENT_SECRET,
        grant_type: 'authorization_code', code, code_verifier: attempt.verifier, redirect_uri: discordRedirect(env) }),
    });
    if (!token.ok) return finish(token.status === 400 ? 'invalid' : 'unavailable');
    const data = await token.json();
    if (typeof data.access_token !== 'string') return finish('unavailable');
    const profile = await fetchProvider(`${DISCORD}/api/v10/users/@me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (!profile.ok) return finish('unavailable');
    const user = await profile.json();
    if (!/^\d+$/.test(user.id || '')) return finish('unavailable');
    if (!await discordRoleAllowed(env, user.id)) {
      await query(env, 'DELETE FROM live_sessions WHERE user_id = ?', user.id).run();
      await revokeSession(env, await sessionId(request));
      return redirect(`${origin}/directos?login=denied`, [clear, setCookie(SESSION_COOKIE, '', 0)]);
    }
    const value = randomId();
    const now = Date.now();
    const previous = await sessionId(request);
    const statements = [query(env, 'INSERT INTO live_sessions (id, user_id, expires_at, checked_until) VALUES (?, ?, ?, ?)',
      await digest(value), user.id, now + SESSION_SECONDS * 1000, now + ROLE_CHECK_MS)];
    if (previous) statements.unshift(query(env, 'DELETE FROM live_sessions WHERE id = ?', previous));
    await db(env).batch(statements);
    return redirect(`${origin}/directos`, [clear, setCookie(SESSION_COOKIE, value, SESSION_SECONDS)]);
  } catch { return finish('unavailable'); }
}

export async function refreshRole(env, session, now = Date.now()) {
  if (session.checked_until > now) return;
  const lease = await query(env, `UPDATE live_sessions SET check_lease_until = ?
    WHERE id = ? AND expires_at > ? AND checked_until <= ? AND check_lease_until <= ? RETURNING id`,
  now + 12000, session.session_id, now, now, now).first();
  if (!lease) {
    const current = await query(env, 'SELECT checked_until FROM live_sessions WHERE id = ? AND expires_at > ?', session.session_id, now).first();
    if (!current) throw new LiveError(401, 'La sesión de Directos ha terminado.');
    if (current.checked_until > now) return;
    throw new LiveError(503, 'Verificando el rol de Discord.', 2);
  }
  if (!await discordRoleAllowed(env, session.user_id)) {
    await query(env, 'DELETE FROM live_sessions WHERE user_id = ?', session.user_id).run();
    throw new LiveError(403, 'Necesitas el rol de Patreon o Colaborador para ver este directo.');
  }
  await query(env, 'UPDATE live_sessions SET checked_until = ?, check_lease_until = 0 WHERE id = ?',
    now + ROLE_CHECK_MS, session.session_id).run();
}

export async function requireSession(request, env) {
  const id = await sessionId(request);
  const now = Date.now();
  const session = id && await query(env, `SELECT id AS session_id, user_id, expires_at, checked_until
    FROM live_sessions WHERE id = ? AND expires_at > ?`, id, now).first();
  if (!session) throw new LiveError(401, 'Identifícate con Discord para acceder a Directos.');
  await refreshRole(env, session, now);
  return session;
}

export async function getSession({ request, env }) {
  const session = await requireSession(request, env);
  return json({ authenticated: true, expiresAt: session.expires_at, premium: await hasPremiumCredential(env) });
}

export async function logout({ request, env }) {
  requireOrigin(request, env);
  await revokeSession(env, await sessionId(request));
  const headers = privateHeaders();
  headers.append('Set-Cookie', setCookie(SESSION_COOKIE, '', 0));
  return new Response(null, { status: 204, headers });
}
