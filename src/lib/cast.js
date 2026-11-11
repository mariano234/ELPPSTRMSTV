const SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

// React mounts and channel changes must share one configured SDK per page.
export function createCastLoader(host) {
  let pending;
  let configuredContext;
  return function load() {
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      let timer;
      let script;
      const previousCallback = host.__onGCastApiAvailable;
      const cleanup = () => {
        host.clearTimeout(timer);
        script?.removeEventListener('error', onError);
        if (host.__onGCastApiAvailable === onAvailable) host.__onGCastApiAvailable = previousCallback;
      };
      const fail = message => { cleanup(); reject(new Error(message)); };
      const onAvailable = available => {
        if (!available) return fail('Google Cast no está disponible en este navegador. Prueba con Chrome.');
        try {
          const context = host.cast.framework.CastContext.getInstance();
          if (configuredContext !== context) {
            context.setOptions({
              receiverApplicationId: host.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
              autoJoinPolicy: host.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
            });
            configuredContext = context;
          }
          cleanup();
          resolve(context);
        } catch { fail('No se pudo iniciar Google Cast. Recarga la página para reintentar.'); }
      };
      const onError = () => fail('No se pudo descargar Google Cast. Comprueba tu conexión y recarga la página.');
      if (host.cast?.framework?.CastContext && host.chrome?.cast?.media) {
        onAvailable(true);
        return;
      }
      host.__onGCastApiAvailable = onAvailable;
      timer = host.setTimeout(() => fail('Google Cast no responde. Comprueba tu conexión y recarga la página.'), 12000);
      script = host.document.getElementById('cast-sdk');
      if (!script) {
        script = host.document.createElement('script');
        script.id = 'cast-sdk';
        script.src = SDK_URL;
        script.async = true;
        script.addEventListener('error', onError, { once: true });
        host.document.head.appendChild(script);
      } else script.addEventListener('error', onError, { once: true });
    });
    return pending;
  };
}

let defaultLoader;
export function loadGoogleCast() {
  defaultLoader ??= createCastLoader(window);
  return defaultLoader();
}

export function getCastMediaUrl(source, origin, quality = 0) {
  const url = new URL(source, origin);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname === '::1' || hostname === '0.0.0.0' || /^127\./.test(hostname)) {
    throw new Error('La TV necesita una dirección HTTPS accesible desde su propia conexión. Prueba desde la web publicada.');
  }
  if (url.origin !== new URL(origin).origin || !/^\/api\/stream\/[\w-]{43}\/index\.m3u8$/.test(url.pathname)) {
    throw new Error('La TV necesita un permiso de reproducción de Directos.');
  }
  url.search = '';
  url.hash = '';
  if (quality) url.searchParams.set('quality', quality);
  return url.href;
}

// Cast defaults to MPEG-TS. Request FMP4 only when the media playlist uses it.
export async function detectHlsFormat(source, { signal, fetcher = fetch } = {}) {
  let url = source;
  for (let depth = 0; depth < 3; depth++) {
    const response = await fetcher(url, { signal });
    if (!response.ok) throw new Error('No se pudo obtener la lista de reproducción para la TV.');
    const text = await response.text();
    if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('El servidor no devolvió una lista HLS válida.');
    if (text.includes('#EXT-X-MAP:')) return 'fmp4';
    if (!text.includes('#EXT-X-STREAM-INF:')) return 'ts';
    const variant = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
    if (!variant) break;
    url = new URL(variant, response.url || url).href;
  }
  throw new Error('No se pudo identificar el formato del directo para la TV.');
}

export function createCastRequest(host, mediaUrl, format) {
  const media = host.chrome.cast.media;
  const info = new media.MediaInfo(mediaUrl, 'application/x-mpegurl');
  info.streamType = media.StreamType.LIVE;
  if (format === 'fmp4') {
    info.hlsSegmentFormat = media.HlsSegmentFormat.FMP4;
    info.hlsVideoSegmentFormat = media.HlsVideoSegmentFormat.FMP4;
  }
  info.metadata = new media.GenericMediaMetadata();
  info.metadata.title = 'Directo - ElPepeStreams';
  const request = new media.LoadRequest(info);
  request.autoplay = true;
  return request;
}

export function isCastCancellation(error) {
  return (error?.code || error) === 'cancel';
}
