import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { variantHeight } from '../../shared/hls-quality';
import { requestPlayback, revokePlayback } from '../lib/live';
import CastButton from './CastButton';
import 'plyr/dist/plyr.css';
import playerIcons from 'plyr/dist/plyr.svg';

function playlistError(details) {
  const xhr = details.networkDetails;
  if (!(xhr instanceof XMLHttpRequest) || xhr.responseType && xhr.responseType !== 'text' ||
      !xhr.getResponseHeader('Content-Type')?.includes('application/json')) return null;
  try {
    const url = new URL(xhr.responseURL);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/stream/')) return null;
    const { error } = JSON.parse(xhr.responseText);
    return typeof error === 'string' && error.length <= 240 ? error : null;
  } catch { return null; }
}

export default function NativeStreamPlayer({ channel, mode, t, onAccessLost, onSessionRenewed }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Autenticando…');
  const [readySource, setReadySource] = useState(null);
  const [quality, setQuality] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const pauseLocal = useCallback(() => playerRef.current?.pause(), []);

  useEffect(() => {
    let active = true;
    let hls;
    let player;
    let grant;
    let retryTimer;
    let networkRetries = 0;
    let mediaRetries = 0;
    const controller = new AbortController();
    const authTimeout = setTimeout(() => controller.abort(), 15000);
    const container = containerRef.current;

    const fail = message => {
      if (!active) return;
      setError(message);
      setStatus('');
    };
    const init = async () => {
      setError(null);
      setReadySource(null);
      setQuality(null);
      setStatus('Autenticando…');
      try {
        await Promise.resolve();
        if (!active) return;
        const playback = await requestPlayback(channel, mode, 'browser', controller.signal);
        grant = playback.grant;
        if (!active) { revokePlayback(grant); return; }
        const source = playback.source;
        setStatus('Cargando directo…');
        const video = document.createElement('video');
        const native = video.canPlayType('application/vnd.apple.mpegurl');
        const agent = navigator.userAgent;
        const desktopChromium = /Windows NT|Macintosh|X11/.test(agent) && /\b(?:Chrome|Chromium|Edg)\//.test(agent);
        const preferNative = native && !desktopChromium;
        const [{ default: Plyr }, hlsModule] = await Promise.all([
          import('plyr'), preferNative ? null : import('hls.js'),
        ]);
        if (!active) return;
        const Hls = hlsModule?.default;
        video.playsInline = true;
        video.controls = true;
        video.className = 'w-full h-full';
        container.replaceChildren(video);
        const options = {
          controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'settings', 'pip', 'airplay', 'fullscreen'],
          settings: [], storage: { enabled: false }, autoplay: true, playsinline: true,
          iconUrl: playerIcons,
          fullscreen: { container: '.stream-player' },
        };
        const setupQuality = (heights, apply) => {
          if (heights.length < 2) return;
          options.settings = ['quality'];
          options.quality = {
            default: 0, options: [0, ...heights], forced: true,
            onChange: resolution => {
              apply(resolution);
              setQuality(resolution);
            },
          };
          options.i18n = { qualityLabel: { 0: 'Auto' } };
        };
        const ready = () => {
          if (!active) return;
          clearTimeout(retryTimer);
          if (!player) {
            player = new Plyr(video, options);
            playerRef.current = player;
            const controls = container.querySelector('.plyr__controls');
            if (controls) {
              const castSlot = document.createElement('div');
              castSlot.className = 'plyr__controls__item stream-cast';
              controls.insertBefore(castSlot, controls.querySelector('[data-plyr="fullscreen"]'));
              setReadySource({ channel, mode, castSlot });
            }
          }
          setStatus('');
          video.play().catch(() => { /* Autoplay may require a user gesture. */ });
        };
        // Safari and TVs with native HLS should use their own media stack.
        if (native && !Hls?.isSupported()) {
          const manifest = await fetch(source, { signal: controller.signal });
          if (!manifest.ok) {
            const data = await manifest.json().catch(() => ({}));
            const error = new Error(data.error || 'No se pudo cargar la lista del directo.');
            error.status = manifest.status;
            throw error;
          }
          const heights = [...new Set((await manifest.text()).split(/\r?\n/).map(line => variantHeight(line.trim())).filter(Boolean))];
          if (!active) return;
          setupQuality(heights, resolution => {
            const url = new URL(source, window.location.origin);
            if (resolution) url.searchParams.set('quality', resolution);
            if (video.src === url.href) return;
            const playing = !video.paused;
            video.src = url.href;
            if (playing) video.play().catch(() => { /* A user gesture may be required. */ });
          });
          video.addEventListener('error', () => fail('El directo no está disponible o este dispositivo no admite su formato.'), { signal: controller.signal });
          video.addEventListener('loadedmetadata', ready, { once: true, signal: controller.signal });
          retryTimer = setTimeout(() => fail('El directo no responde. Comprueba la conexión y vuelve a intentarlo.'), 20000);
          video.src = new URL(source, window.location.origin).href;
        } else if (Hls?.isSupported()) {
          hls = new Hls();
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (player) return;
            const heights = [...new Set(hls.levels.map(level => level.height).filter(Boolean))];
            setupQuality(heights, resolution => {
              hls.currentLevel = resolution === 0 ? -1 : hls.levels.findIndex(level => level.height === resolution);
            });
            ready();
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!active || !data.fatal) return;
            const upstreamError = playlistError(data);
            if ([401, 403].includes(data.response?.code)) {
              hls.stopLoad();
              onAccessLost('El permiso de Directos ha terminado. Vuelve a identificarte con Discord.');
            } else if (upstreamError) {
              hls.stopLoad();
              fail(upstreamError);
            } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries++ < 2) {
              clearTimeout(retryTimer);
              retryTimer = setTimeout(() => { if (active) hls.startLoad(); }, 1000);
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 1) {
              hls.recoverMediaError();
            } else {
              hls.stopLoad();
              fail('No se puede reproducir el directo. El canal puede estar desconectado o la conexión bloqueada.');
            }
          });
          hls.attachMedia(video);
          hls.loadSource(source);
        } else {
          fail('Este navegador no admite el formato del directo. Prueba con una versión actual de Chrome o Safari.');
        }
      } catch (err) {
        if (active && [401, 403].includes(err.status)) { onAccessLost(err.message); return; }
        fail(err.name === 'AbortError' ? 'La conexión ha tardado demasiado. Vuelve a intentarlo.' : err.message);
      } finally { clearTimeout(authTimeout); }
    };
    init();
    return () => {
      active = false;
      controller.abort();
      revokePlayback(grant);
      clearTimeout(authTimeout);
      clearTimeout(retryTimer);
      hls?.destroy();
      player?.destroy();
      if (playerRef.current === player) playerRef.current = null;
      container?.replaceChildren();
    };
  }, [channel, mode, attempt, onAccessLost]);

  return (
    <div className="stream-player w-full h-full bg-black relative flex items-center justify-center">
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-10" />
      {readySource?.channel === channel && readySource.mode === mode && !error && createPortal(
        <CastButton channel={channel} mode={mode} quality={quality} onConnected={pauseLocal} onSessionRenewed={onSessionRenewed} t={t} />,
        readySource.castSlot,
      )}
      {status && !error && <div role="status" className="absolute inset-0 flex items-center justify-center bg-black/90 z-20 flex-col gap-4">
        <div className="w-10 h-10 border-4 border-[#e5a00d] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#e5a00d] font-bold text-sm tracking-widest uppercase text-center px-4">{status}</span>
      </div>}
      {error && <div role="alert" className="absolute inset-0 flex items-center justify-center bg-black/95 z-20 flex-col gap-3 p-6 text-center">
        <AlertTriangle size={48} className="text-red-500" />
        <span className="text-red-500 font-bold text-lg">Error del reproductor</span>
        <span className="text-gray-400 text-sm max-w-md">{error}</span>
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded-lg bg-[#e5a00d] px-4 py-2 font-bold text-black">Reintentar</button>
      </div>}
    </div>
  );
}
