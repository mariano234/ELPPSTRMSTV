import { getStreamToken, masterUrl } from './angelthump.js';
import { digest, seal, unseal, validId } from './live-crypto.js';
import { appOrigin, errorResponse, fetchProvider, LiveError, privateHeaders } from './live-http.js';
import { requirePlayback, streamUrl } from './live-playback.js';
import { variantHeight } from '../shared/hls-quality.js';

const HOSTS = [
  'vigor.angelthump.com', 'video-cdn.angelthump.com', 'ams1.angelthump.com',
  'sfo1.angelthump.com', 'nyc-patreon.angelthump.com',
];
const PLAYLIST_TAGS = new Set(['#EXT-X-MEDIA', '#EXT-X-I-FRAME-STREAM-INF', '#EXT-X-IMAGE-STREAM-INF']);
const RESOURCE_TAGS = new Set(['#EXT-X-KEY', '#EXT-X-SESSION-KEY', '#EXT-X-MAP', '#EXT-X-PART', '#EXT-X-PRELOAD-HINT']);
const URI_ATTR = /\bURI="([^"]+)"/g;
const MAX_MANIFEST = 512 * 1024;
const masterCache = new Map();

function allowedUrl(value, env, base) {
  let url;
  try { url = new URL(value, base); } catch { throw new LiveError(502, 'AngelThump devolvió una dirección de vídeo inválida.'); }
  const extra = (env.ANGELTHUMP_MEDIA_HOSTS || '').split(',').map(host => host.trim().toLowerCase());
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new LiveError(502, 'El origen de este recurso de vídeo no está autorizado.');
  }
  if (![...HOSTS, ...extra].includes(url.hostname)) {
    throw new LiveError(502, `El servidor de vídeo ${url.hostname.slice(0, 160)} no está autorizado.`);
  }
  return url;
}

async function fetchMedia(value, env, init = {}) {
  let target = allowedUrl(value, env);
  const headers = new Headers({ Referer: 'https://angelthump.com/' });
  if (init.range) headers.set('Range', init.range);
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetchProvider(target.href, { method: init.method || 'GET', headers }, { timeout: 15000 });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, target };
    const next = response.headers.get('Location');
    await response.body?.cancel();
    if (!next || hop === 3) throw new LiveError(502, 'AngelThump devolvió una redirección inválida.');
    target = allowedUrl(next, env, target);
  }
}

class OriginExpired extends Error {}

async function rejectOrigin(response, playlist) {
  await response.body?.cancel();
  if ([401, 403].includes(response.status)) {
    if (playlist) throw new OriginExpired();
    throw new LiveError(503, 'El fragmento ha caducado. El reproductor debe actualizar la lista.', 1);
  }
  if (response.status === 404) throw new LiveError(404, playlist ? 'La emisión no está disponible.' : 'El fragmento ya no está disponible.');
  if (response.status === 416) throw new LiveError(416, 'Rango de vídeo inválido.');
  if (response.status === 429) throw new LiveError(503, 'AngelThump está ocupado.', 5);
  throw new LiveError(502, 'AngelThump no pudo servir el vídeo.');
}

async function readManifest(response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (reader) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_MANIFEST) {
      await reader.cancel();
      throw new LiveError(502, 'La lista de reproducción excede el tamaño permitido.');
    }
    text += decoder.decode(value, { stream: true });
  }
  text = (text + decoder.decode()).trim();
  if (!/^#EXTM3U(?:\r?\n|$)/.test(text)) throw new LiveError(502, 'AngelThump no devolvió una lista HLS válida.');
  return text;
}

// A rendition is identified by its HLS attributes so its URL survives a token renewal.
async function parsePlaylist(text) {
  const nodes = [];
  const seen = new Map();
  let variant = null;
  const selector = async attrs => {
    const hash = (await digest(attrs)).slice(0, 22);
    const occurrence = seen.get(hash) || 0;
    seen.set(hash, occurrence + 1);
    return `${hash}.${occurrence}`;
  };
  for (const row of text.split(/\r?\n/)) {
    const line = row.trim();
    if (!line) continue;
    if (!line.startsWith('#')) {
      nodes.push({ line, variant, refs: [{ uri: line, playlist: Boolean(variant), id: variant ? await selector(variant) : null }] });
      variant = null;
      continue;
    }
    if (!line.startsWith('#EXT')) continue;
    const tag = line.split(':', 1)[0];
    if (tag === '#EXT-X-STREAM-INF') variant = line;
    if (['#EXT-X-CONTENT-STEERING', '#EXT-X-RENDITION-REPORT', '#EXT-X-SESSION-DATA', '#EXT-X-DEFINE'].includes(tag)) continue;
    const refs = [];
    for (const match of line.matchAll(URI_ATTR)) {
      if (!PLAYLIST_TAGS.has(tag) && !RESOURCE_TAGS.has(tag)) throw new LiveError(502, 'El formato de la lista HLS requiere revisión.');
      const playlist = PLAYLIST_TAGS.has(tag);
      refs.push({ uri: match[1], full: match[0], playlist,
        inline: ['#EXT-X-KEY', '#EXT-X-SESSION-KEY'].includes(tag) && match[1].startsWith('data:'),
        id: playlist ? await selector(line.replace(URI_ATTR, 'URI=""')) : null });
    }
    if (/\bURI=/.test(line) && !refs.length) throw new LiveError(502, 'La lista HLS contiene una referencia inválida.');
    nodes.push({ line, refs });
  }
  return nodes;
}

async function getPlaylist(env, url, version, ancestor) {
  const key = `${version}:${url.href}`;
  const cached = ancestor && masterCache.get(key);
  if (cached?.until > Date.now()) return cached.playlist;
  const { response, target } = await fetchMedia(url.href, env);
  if (response.status !== 200) await rejectOrigin(response, true);
  const playlist = { target, nodes: await parsePlaylist(await readManifest(response)) };
  if (ancestor) {
    masterCache.set(key, { playlist, until: Date.now() + 15000 });
    if (masterCache.size > 32) masterCache.delete(masterCache.keys().next().value);
  }
  return playlist;
}

function appendHlsParams(url, requestUrl) {
  for (const name of ['_HLS_msn', '_HLS_part']) {
    const value = requestUrl.searchParams.get(name);
    if (value && /^\d{1,12}$/.test(value)) url.searchParams.set(name, value);
  }
  const skip = requestUrl.searchParams.get('_HLS_skip');
  if (skip === 'YES' || skip === 'v2') url.searchParams.set('_HLS_skip', skip);
}

async function resolvePlaylist(env, grant, token, version, trail, requestUrl) {
  let next = masterUrl(grant.channel, token);
  for (let depth = 0; depth <= trail.length; depth++) {
    const ancestor = depth < trail.length;
    if (!ancestor) appendHlsParams(next, requestUrl);
    const playlist = await getPlaylist(env, next, version, ancestor);
    if (!ancestor) return playlist;
    const reference = playlist.nodes.flatMap(node => node.refs).find(ref => ref.id === trail[depth]);
    if (!reference) throw new LiveError(404, 'La calidad seleccionada ya no está disponible.');
    next = allowedUrl(reference.uri, env, playlist.target);
  }
}

async function servePlaylist(request, env, rawGrant, grant, headers) {
  headers.set('Content-Type', 'application/x-mpegurl');
  const requestUrl = new URL(request.url);
  const selector = requestUrl.searchParams.get('p');
  const quality = requestUrl.searchParams.get('quality');
  if (quality !== null && (selector || !/^[1-9]\d{0,4}$/.test(quality))) {
    throw new LiveError(400, 'Calidad de vídeo inválida.');
  }
  const path = selector && await unseal(env.LIVE_MEDIA_KEY, 'playlist', selector);
  if (selector && (path?.grant !== rawGrant || !Array.isArray(path.trail) || path.trail.length > 3)) {
    throw new LiveError(404, 'Lista de reproducción inválida.');
  }
  if (request.method === 'HEAD') return new Response(null, { headers });
  const trail = path?.trail || [];
  let bundle = await getStreamToken(env, grant);
  let playlist;
  try { playlist = await resolvePlaylist(env, grant, bundle.token, bundle.version, trail, requestUrl); }
  catch (error) {
    if (!(error instanceof OriginExpired)) throw error;
    bundle = await getStreamToken(env, grant, bundle.version);
    try { playlist = await resolvePlaylist(env, grant, bundle.token, bundle.version, trail, requestUrl); }
    catch (retryError) {
      if (retryError instanceof OriginExpired) throw new LiveError(502, 'AngelThump rechazó el permiso de vídeo renovado.');
      throw retryError;
    }
  }
  const origin = appOrigin(env);
  let { nodes } = playlist;
  if (quality !== null) {
    const selected = Number(quality);
    if (!nodes.some(node => node.variant && variantHeight(node.variant) === selected)) {
      throw new LiveError(404, 'La calidad seleccionada ya no está disponible.');
    }
    nodes = nodes.filter(node => {
      const variant = node.variant || (node.line.startsWith('#EXT-X-STREAM-INF:') ? node.line : null);
      return !variant || variantHeight(variant) === selected;
    });
  }
  const expires = Math.min(grant.expires_at, Date.now() + 10 * 60 * 1000);
  const renderRef = async ref => {
    if (ref.inline) return ref.uri;
    if (ref.uri.includes('{$')) throw new LiveError(502, 'La emisión utiliza referencias HLS que requieren revisión.');
    const target = allowedUrl(ref.uri, env, playlist.target);
    if (ref.playlist) {
      if (trail.length >= 3) throw new LiveError(502, 'La emisión contiene demasiados niveles de listas HLS.');
      const p = await seal(env.LIVE_MEDIA_KEY, 'playlist', { grant: rawGrant, trail: [...trail, ref.id] });
      return streamUrl(origin, rawGrant, 'index.m3u8', { p }).href;
    }
    const s = await seal(env.LIVE_MEDIA_KEY, 'segment', { grant: rawGrant, target: target.href, expires });
    return streamUrl(origin, rawGrant, 'segment', { s }).href;
  };
  const lines = await Promise.all(nodes.map(async node => {
    let line = node.line;
    for (const ref of node.refs) {
      const url = await renderRef(ref);
      line = ref.full ? line.replace(ref.full, `URI="${url}"`) : url;
    }
    return line;
  }));
  return new Response(`${lines.join('\n')}\n`, { headers });
}

async function serveSegment(request, env, rawGrant, headers) {
  const payload = await unseal(env.LIVE_MEDIA_KEY, 'segment', new URL(request.url).searchParams.get('s'));
  if (payload?.grant !== rawGrant || payload.expires <= Date.now()) throw new LiveError(404, 'El fragmento ya no está disponible.');
  const range = request.headers.get('Range');
  if (range && !/^bytes=(?:\d{1,16}-\d{0,16}|-\d{1,16})$/.test(range)) throw new LiveError(416, 'Rango de vídeo inválido.');
  const { response } = await fetchMedia(payload.target, env, { method: request.method, range });
  if (![200, 206].includes(response.status)) await rejectOrigin(response, false);
  const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  const binary = !type || /^(?:video|audio)\/[a-z0-9.+-]+$/.test(type) || ['application/octet-stream', 'application/mp4', 'binary/octet-stream', 'text/vtt'].includes(type);
  if (!binary) {
    await response.body?.cancel();
    throw new LiveError(502, 'El origen no devolvió un fragmento de vídeo válido.');
  }
  headers.set('Content-Type', type || 'application/octet-stream');
  for (const name of ['Accept-Ranges', 'Content-Range', 'Content-Length']) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
}

export async function serveStream({ request, env, params }) {
  const headers = privateHeaders();
  const origin = request.headers.get('Origin');
  const allowedCastOrigins = (env.LIVE_CAST_ORIGINS || 'https://www.gstatic.com').split(',').map(value => value.trim());
  const crossOrigin = origin && origin !== appOrigin(env);
  if (crossOrigin && allowedCastOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    headers.set('Vary', 'Origin');
  }
  try {
    if (crossOrigin && !headers.has('Access-Control-Allow-Origin')) throw new LiveError(403, 'Origen del reproductor no autorizado.');
    const { grant: rawGrant, file } = params;
    if (!validId(rawGrant) || !['index.m3u8', 'segment'].includes(file)) throw new LiveError(404, 'Directo no disponible.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'HEAD'].includes(request.method)) throw new LiveError(405, 'Método no permitido.');
    const grant = await requirePlayback(request, env, rawGrant);
    if (crossOrigin && grant.receiver !== 'cast') throw new LiveError(403, 'Este permiso es solo para el navegador.');
    return file === 'index.m3u8' ? await servePlaylist(request, env, rawGrant, grant, headers)
      : await serveSegment(request, env, rawGrant, headers);
  } catch (error) {
    const result = errorResponse(error);
    for (const [name, value] of headers) if (name.startsWith('access-control-') || name === 'vary') result.headers.set(name, value);
    return request.method === 'HEAD' ? new Response(null, { status: result.status, headers: result.headers }) : result;
  }
}
