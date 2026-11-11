import { useEffect, useRef, useState } from 'react';
import { Cast } from 'lucide-react';
import { createCastRequest, detectHlsFormat, getCastMediaUrl, isCastCancellation, loadGoogleCast } from '../lib/cast';
import { requestPlayback, revokePlayback } from '../lib/live';

function activeGrant(media) {
  try {
    const url = new URL(media?.contentId);
    if (url.origin !== window.location.origin) return null;
    return url.pathname.match(/^\/api\/stream\/([\w-]{43})\/index\.m3u8$/)?.[1] || null;
  } catch { return null; }
}

export default function CastButton({ channel, mode, onConnected, onSessionRenewed, t }) {
  const [context, setContext] = useState(null);
  const [castState, setCastState] = useState('INITIALIZING');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastLoad = useRef(null);
  const connectedCallback = useRef(onConnected);
  useEffect(() => { connectedCallback.current = onConnected; }, [onConnected]);

  useEffect(() => {
    let active = true;
    let detach = () => {};
    loadGoogleCast().then(castContext => {
      if (!active) return;
      const update = () => setCastState(castContext.getCastState());
      const eventType = window.cast.framework.CastContextEventType.CAST_STATE_CHANGED;
      castContext.addEventListener(eventType, update);
      detach = () => castContext.removeEventListener(eventType, update);
      setContext(castContext);
      update();
    }).catch(err => {
      if (active) { setCastState('UNAVAILABLE'); setError(err.message); }
    });
    return () => { active = false; detach(); };
  }, []);

  useEffect(() => {
    if (!context) return;
    let active = true;
    let controller;
    let generation = 0;
    let loading = false;
    let timeout;
    const reportError = err => {
      if (active) setError(err.name === 'AbortError'
        ? 'La conexión con el directo ha tardado demasiado. Desconecta la TV y vuelve a intentarlo.'
        : err.message || 'La TV no pudo cargar el directo. Comprueba que tiene acceso a la web.');
    };
    const load = async () => {
      const session = context.getCurrentSession();
      if (!session || loading) return;
      const broadcast = `${channel}:${mode}`;
      const mediaSession = session.getMediaSession?.();
      const media = mediaSession?.media;
      const previous = activeGrant(media);
      if (previous && media.customData?.broadcast === broadcast && media.customData?.expiresAt > Date.now() && mediaSession.playerState !== 'IDLE') {
        lastLoad.current = previous;
        connectedCallback.current();
        return;
      }
      loading = true;
      const currentGeneration = ++generation;
      controller = new AbortController();
      setBusy(true);
      setError('');
      timeout = setTimeout(() => controller.abort(), 25000);
      let permit;
      let sent = false;
      try {
        permit = await requestPlayback(channel, mode, 'cast', controller.signal);
        if (active && Number.isFinite(permit.sessionExpiresAt)) onSessionRenewed(permit.sessionExpiresAt);
        const url = getCastMediaUrl(permit.source, window.location.origin);
        const format = await detectHlsFormat(url, { signal: controller.signal });
        if (!active || currentGeneration !== generation || context.getCurrentSession() !== session) return;
        const request = createCastRequest(window, url, format);
        request.media.customData = { broadcast, expiresAt: permit.expiresAt };
        await Promise.race([
          session.loadMedia(request),
          new Promise((_resolve, reject) => {
            controller.signal.addEventListener('abort', () => reject(new Error('La TV ha tardado demasiado en cargar el directo. Desconecta y vuelve a intentarlo.')), { once: true });
          }),
        ]);
        if (active && currentGeneration === generation && context.getCurrentSession() === session) {
          sent = true;
          lastLoad.current = permit.grant;
          if (previous && previous !== permit.grant) revokePlayback(previous);
          connectedCallback.current();
        }
      } catch (err) {
        if (active && currentGeneration === generation) reportError(err);
      } finally {
        if (permit && !sent) revokePlayback(permit.grant);
        if (currentGeneration === generation) {
          loading = false;
          clearTimeout(timeout);
          if (active) setBusy(false);
        }
      }
    };
    const onSession = event => {
      const states = window.cast.framework.SessionState;
      if (event.sessionState === states.SESSION_STARTED || event.sessionState === states.SESSION_RESUMED) {
        load().catch(reportError);
      } else if (event.sessionState === states.SESSION_ENDED) {
        generation++;
        controller?.abort();
        clearTimeout(timeout);
        loading = false;
        revokePlayback(lastLoad.current);
        lastLoad.current = null;
        setBusy(false);
      }
    };
    const type = window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED;
    context.addEventListener(type, onSession);
    load().catch(reportError);
    return () => {
      active = false;
      clearTimeout(timeout);
      controller?.abort();
      context.removeEventListener(type, onSession);
    };
  }, [context, channel, mode, onSessionRenewed]);

  const connected = castState === 'CONNECTED';
  const handleClick = async () => {
    if (!context) return;
    setError('');
    try {
      const session = context.getCurrentSession();
      if (session) {
        const grant = lastLoad.current || activeGrant(session.getMediaSession?.()?.media);
        lastLoad.current = null;
        context.endCurrentSession(true);
        revokePlayback(grant);
      }
      else await context.requestSession();
    } catch (err) {
      if (!isCastCancellation(err)) setError('No se pudo conectar con la TV. Comprueba Chrome, los permisos de red local y la conexión Wi-Fi.');
    }
  };
  const initializing = castState === 'INITIALIZING' || castState === 'CONNECTING';
  const label = connected ? 'Desconectar TV' : initializing ? 'Buscando TV…' : (t.enviar_tv || 'Enviar a TV');
  return (
    <div className="absolute top-3 right-3 z-30 max-w-[85%] text-right">
      <button type="button" onClick={handleClick} disabled={!context || initializing || busy}
        aria-label={label} aria-pressed={connected} aria-busy={busy} title={label}
        className={`inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-xs font-bold shadow-lg disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e5a00d] ${connected ? 'text-[#e5a00d]' : 'text-white'}`}>
        <Cast size={18} aria-hidden="true" /> {busy ? 'Cargando en TV…' : label}
      </button>
      {castState === 'NO_DEVICES_AVAILABLE' && <p role="status" className="mt-1 rounded bg-black/85 p-2 text-xs text-gray-200">No se detecta ninguna TV. Comprueba la misma red Wi-Fi y los permisos de red local.</p>}
      {error && <p role="alert" className="mt-1 rounded bg-black/90 p-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
