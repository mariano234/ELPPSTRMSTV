export class LiveError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function privateHeaders(extra) {
  return new Headers({
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: privateHeaders() });
}

export function errorResponse(error) {
  if (!(error instanceof LiveError)) {
    return json({ error: 'El servicio de directos no está disponible temporalmente.' }, 503);
  }
  const response = json({ error: error.message }, error.status);
  if (error.retryAfter) response.headers.set('Retry-After', String(error.retryAfter));
  return response;
}

export function endpoint(handler) {
  return async context => {
    try { return await handler(context); } catch (error) { return errorResponse(error); }
  };
}

export function appOrigin(env) {
  const origin = new URL(env.LIVE_ORIGIN || 'https://elppstrmstv.pages.dev');
  if (origin.protocol !== 'https:' || origin.href !== `${origin.origin}/`) {
    throw new LiveError(503, 'El origen HTTPS de Directos requiere configuración.');
  }
  return origin.origin;
}

export function requireOrigin(request, env) {
  const origin = appOrigin(env);
  if (new URL(request.url).origin !== origin || request.headers.get('Origin') !== origin) {
    throw new LiveError(403, 'La solicitud debe iniciarse en la web de Directos.');
  }
}

export async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    throw new LiveError(415, 'La solicitud debe ser JSON.');
  }
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) {
      await reader.cancel();
      throw new LiveError(413, 'La solicitud es demasiado grande.');
    }
    body += decoder.decode(value, { stream: true });
  }
  try { return JSON.parse(body + decoder.decode()); } catch { throw new LiveError(400, 'Solicitud inválida.'); }
}

export async function fetchProvider(url, init = {}, { timeout = 8000, fetcher = fetch } = {}) {
  try {
    return await fetcher(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(timeout) });
  } catch { throw new LiveError(503, 'El proveedor del directo no responde.', 2); }
}
