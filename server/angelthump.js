import { fetchProvider, LiveError } from './live-http.js';
import { query } from './live-store.js';
import { randomId, seal, unseal } from './live-crypto.js';

export const PRIMARY_CHANNEL = 'elpintaunas';
export const CHANNELS = [PRIMARY_CHANNEL, `${PRIMARY_CHANNEL}_1`];
const PLAYER_ORIGIN = 'https://player.angelthump.com';
const DEFAULT_IDENTIFIER = 'SwnpX0RnA99YdRj0SPqs';
let cachedDiscordCredentials;

function parseCredentials(raw) {
  const text = raw.replace(/[*`]/g, '').trim();
  const passwordLine = text.match(/^[ \t]*contrase(?:ñ|n)a[ \t]*:[ \t]*(.*)$/im);
  const cookieLine = text.match(/^[ \t]*cookie[ \t]*:[ \t]*(.*)$/im);
  const [first, second] = text.split('|');
  return {
    password: (passwordLine?.[1] ?? (cookieLine ? '' : first)).trim().replace(/^['"]|['"]$/g, ''),
    sid: (cookieLine?.[1] ?? second ?? '').trim().replace(/^['"]|['"]$/g, ''),
  };
}

function discordCredentials(env) {
  const { BOT_TOKEN: bot, CHANNEL_ID: channel, CREDENTIAL_AUTHOR_ID: author } = env;
  const previous = cachedDiscordCredentials;
  if (previous && previous.bot === bot && previous.channel === channel && previous.author === author && previous.until > Date.now()) {
    return previous.result;
  }
  const result = (async () => {
    if (!env.BOT_TOKEN || !/^\d+$/.test(env.CHANNEL_ID)) throw new LiveError(503, 'El canal de credenciales requiere configuración.');
    const res = await fetchProvider(`https://discord.com/api/v10/channels/${env.CHANNEL_ID}/messages?limit=1`, {
      headers: { Authorization: `Bot ${env.BOT_TOKEN}` },
    });
    if (!res.ok) throw new LiveError(503, 'No se pudieron consultar las credenciales de la emisión.');
    const [message] = await res.json();
    if (!message?.content || (env.CREDENTIAL_AUTHOR_ID && message.author?.id !== env.CREDENTIAL_AUTHOR_ID)) {
      throw new LiveError(503, 'El canal privado no contiene credenciales válidas.');
    }
    return parseCredentials(message.content);
  })();
  cachedDiscordCredentials = { bot, channel, author, until: Date.now() + 15000, result };
  return result;
}

function normalizeSid(value) {
  const sid = (value || '').trim().replace(/^angelthump\.sid=/, '').split(';')[0];
  return /^[\x21-\x7e]+$/.test(sid) ? sid : '';
}

export async function hasPremiumCredential(env) {
  if (env.ANGELTHUMP_SID !== undefined) return Boolean(normalizeSid(env.ANGELTHUMP_SID));
  if (!env.CHANNEL_ID) return false;
  try { return Boolean(normalizeSid((await discordCredentials(env)).sid)); } catch { return false; }
}

async function streamCredentials(env, channel, mode) {
  const premium = mode === 'premium';
  let value = premium ? env.ANGELTHUMP_SID : env.ANGELTHUMP_PASSWORD;
  if (!premium && channel !== PRIMARY_CHANNEL) return '';
  if (value === undefined && env.CHANNEL_ID) {
    const credentials = await discordCredentials(env);
    value = premium ? credentials.sid : credentials.password;
  }
  if (premium) {
    const sid = normalizeSid(value);
    if (!sid) throw new LiveError(409, 'El servidor Premium requiere una cookie válida de AngelThump.');
    return sid;
  }
  if (value === undefined) throw new LiveError(503, 'El canal principal requiere configuración.');
  return /^(sin contraseña|sense contrasenya|sen contrasinal|pasahitzik ez)$/i.test(value.trim()) ? '' : value;
}

async function issueToken(env, channel, mode) {
  const premium = mode === 'premium';
  const credential = await streamCredentials(env, channel, mode);
  const headers = new Headers({ 'Content-Type': 'application/json', Origin: PLAYER_ORIGIN,
    Referer: `${PLAYER_ORIGIN}/`, identifier: env.ANGELTHUMP_IDENTIFIER || DEFAULT_IDENTIFIER });
  if (premium) headers.set('Cookie', `angelthump.sid=${credential}`);
  else if (credential) {
    const users = await fetchProvider(`https://api.angelthump.com/v3/users?${new URLSearchParams({ username: channel })}`, { headers });
    if (!users.ok) throw new LiveError(502, 'AngelThump no pudo localizar la emisión.');
    const result = await users.json();
    const id = (Array.isArray(result) ? result : result.data)?.[0]?.id;
    if (typeof id !== 'string' || !id) throw new LiveError(502, 'AngelThump no encontró el canal solicitado.');
    const check = await fetchProvider('https://api.angelthump.com/v3/streams/password', {
      method: 'POST', headers, body: JSON.stringify({ user_id: id, password: credential }),
    });
    if (!check.ok || (await check.json()).error === true) throw new LiveError(502, 'AngelThump rechazó la contraseña del directo.');
    const session = check.headers.get('Set-Cookie')?.split(';')[0];
    if (session) headers.set('Cookie', session);
  }
  const result = await fetchProvider(`https://vigor.angelthump.com/${channel}/token`, {
    method: 'POST', headers, body: JSON.stringify({ patreon: premium }),
  });
  if (result.status === 404) throw new LiveError(404, 'La emisión no está disponible.');
  if (result.status === 429) throw new LiveError(503, 'AngelThump está ocupado. Inténtalo en un momento.', 10);
  if (!result.ok) throw new LiveError(502, 'AngelThump rechazó la solicitud de reproducción.');
  const data = await result.json();
  if (typeof data.token !== 'string' || !data.token || data.token.length > 4096) throw new LiveError(502, 'AngelThump no entregó un permiso de reproducción válido.');
  const setting = Number(env.ANGELTHUMP_RENEW_SECONDS) || 3000;
  const providerSeconds = Number(data.expires_in);
  const renewal = Math.max(30, Math.min(setting, 3600));
  const renewAfter = providerSeconds > 0 ? Math.min(renewal, providerSeconds * 0.85) : renewal;
  return { token: data.token, renewAfter: Math.max(1, renewAfter) * 1000 };
}

export async function getStreamToken(env, { channel, mode, session_id: sessionId }, rejectedVersion = null) {
  if (!CHANNELS.includes(channel) || !['normal', 'premium'].includes(mode)) throw new LiveError(400, 'Emisión inválida.');
  const key = `${sessionId}:${channel}:${mode}`;
  const now = Date.now();
  const saved = await query(env, 'SELECT * FROM live_streams WHERE stream_key = ?', key).first();
  if (saved?.renew_at > now && saved.renew_at !== rejectedVersion) {
    const token = await unseal(env.LIVE_MEDIA_KEY, `stream:${key}`, saved.sealed_token);
    if (typeof token === 'string') return { token, version: saved.renew_at };
  }
  if (saved?.retry_at > now) {
    if (saved.last_failure === 404) throw new LiveError(404, 'La emisión no está disponible.');
    throw new LiveError(503, 'El permiso de vídeo se está renovando. Inténtalo en un momento.', Math.min(10, Math.ceil((saved.retry_at - now) / 1000)));
  }
  const lease = randomId();
  const claim = await query(env, `INSERT INTO live_streams (stream_key, session_id, lease_id, retry_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(stream_key) DO UPDATE SET lease_id = excluded.lease_id, retry_at = excluded.retry_at, last_failure = NULL
    WHERE live_streams.retry_at <= ? AND live_streams.renew_at = ? RETURNING lease_id`,
  key, sessionId, lease, now + 45000, now, saved?.renew_at || 0).first();
  if (!claim) throw new LiveError(503, 'El permiso de vídeo se está renovando.', 1);
  try {
    const { token, renewAfter } = await issueToken(env, channel, mode);
    const issuedAt = Date.now();
    const version = Math.floor(issuedAt + renewAfter);
    const secret = await seal(env.LIVE_MEDIA_KEY, `stream:${key}`, token);
    await query(env, `UPDATE live_streams SET sealed_token = ?, renew_at = ?, retry_at = ?, lease_id = NULL, last_failure = NULL
      WHERE stream_key = ? AND lease_id = ?`, secret, version, issuedAt + Math.min(15000, Math.floor(renewAfter / 2)), key, lease).run();
    return { token, version };
  } catch (error) {
    const status = error instanceof LiveError ? error.status : 502;
    await query(env, `UPDATE live_streams SET retry_at = ?, lease_id = NULL, last_failure = ?, sealed_token = NULL, renew_at = 0
      WHERE stream_key = ? AND lease_id = ?`, Date.now() + 15000, status, key, lease).run();
    throw error;
  }
}

export function masterUrl(channel, token) {
  const url = new URL(`https://vigor.angelthump.com/hls/${channel}.m3u8`);
  url.searchParams.set('token', token);
  return url;
}
