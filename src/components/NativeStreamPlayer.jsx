import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Cast } from 'lucide-react';
import { extractIdentifier } from '../utils';
import { API_BASE } from '../config';

export default function NativeStreamPlayer({ streamSid, streamPassword, channel, usePatreon, t }) {
    const containerRef = useRef(null);
    const playerInstanceRef = useRef(null);
    const hlsInstanceRef = useRef(null);
    const m3u8UrlRef = useRef(null); 
    
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('Autenticando...');

    const handleCastRequest = () => {
        if (!m3u8UrlRef.current) return;

        if (window.cast && window.cast.framework) {
            try {
                const castContext = window.cast.framework.CastContext.getInstance();
                
                const loadMediaToCast = (session) => {
                    const origin = window.location.origin.includes('localhost') ? 'https://elppstrmstv.pages.dev' : window.location.origin;
                    const absoluteUrl = m3u8UrlRef.current.startsWith('http') 
                        ? m3u8UrlRef.current 
                        : origin + m3u8UrlRef.current;
                        
                    const mediaInfo = new window.chrome.cast.media.MediaInfo(absoluteUrl, 'application/x-mpegurl');
                    mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
                    mediaInfo.metadata.title = 'Directo - ElPepeStreams';
                    
                    const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
                    
                    session.loadMedia(request).then(
                        () => console.log('Chromecast: Vídeo cargado correctamente.'),
                        (err) => {
                            console.error('Chromecast Error:', err);
                            alert("El televisor no pudo reproducir el formato.");
                        }
                    );
                };

                const currentSession = castContext.getCurrentSession();
                
                if (currentSession) {
                    loadMediaToCast(currentSession);
                } else {
                    castContext.requestSession().then(
                        () => {
                            const newSession = castContext.getCurrentSession();
                            if (newSession) loadMediaToCast(newSession);
                        },
                        (err) => console.log('Cast cancelado.', err)
                    );
                }
            } catch (e) {
                alert(t.error_cast);
            }
        } else {
            alert(t.error_cast);
        }
    };

    useEffect(() => {
        let isMounted = true;

        const initPlayer = async () => {
            setError(null);
            setStatus('Autenticando...');
            try {
                const cleanSid = streamSid ? streamSid.replace('angelthump.sid=', '') : '';
                const cleanPass = streamPassword ? streamPassword.trim() : '';
                const isValidPass = cleanPass && cleanPass !== t.sin_pass && !cleanPass.includes('••••') && !cleanPass.includes('❌') && !cleanPass.includes('Verificando');
                const identifier = extractIdentifier(cleanSid);

                const payload = { channel: channel, patreon: usePatreon };
                const requestHeaders = { 'Content-Type': 'application/json' };
                
                if (usePatreon && cleanSid) {
                    payload.sid = cleanSid;
                    if (identifier) {
                        payload.identifier = identifier;
                        requestHeaders['identifier'] = identifier; 
                    }
                } else if (!usePatreon && isValidPass) {
                    payload.password = cleanPass;
                }

                const res = await fetch(`${API_BASE}/angelthump`, {
                    method: 'POST',
                    headers: requestHeaders,
                    body: JSON.stringify(payload)
                });
                
                let data = {};
                try { data = await res.json(); } catch(e) {}
                
                if (!res.ok) throw new Error(data.error || "Error al verificar las credenciales");
                if (!data.token) throw new Error("Angelthump no devolvió ningún token válido.");

                const rawM3u8 = `https://vigor.angelthump.com/hls/${channel}.m3u8?token=${data.token}`;
                let m3u8Url = `${API_BASE}/angelthump?url=${encodeURIComponent(rawM3u8)}`;
                
                if (usePatreon && identifier) {
                    m3u8Url += `&identifier=${encodeURIComponent(identifier)}&sid=${encodeURIComponent(cleanSid)}`;
                }

                m3u8UrlRef.current = m3u8Url;

                if (!isMounted) return;

                if (!document.getElementById('plyr-css')) {
                    const link = document.createElement('link');
                    link.id = 'plyr-css';
                    link.rel = 'stylesheet';
                    link.href = 'https://cdn.plyr.io/3.7.8/plyr.css';
                    document.head.appendChild(link);
                }
                
                if (!document.getElementById('plyr-custom-style')) {
                    const style = document.createElement('style');
                    style.id = 'plyr-custom-style';
                    style.innerHTML = `
                        :root { --plyr-color-main: #e5a00d; }
                        .plyr { width: 100% !important; height: 100% !important; display: flex; flex-direction: column; justify-content: center; }
                        .plyr__video-wrapper { width: 100% !important; height: 100% !important; display: flex; align-items: center; justify-content: center; background: black; }
                        .plyr video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
                    `;
                    document.head.appendChild(style);
                }

                const loadScript = (src, globalVar) => new Promise((resolve) => {
                    if (globalVar && window[globalVar]) return resolve();
                    const script = document.createElement('script');
                    script.src = src;
                    script.onload = resolve;
                    document.head.appendChild(script);
                });

                await new Promise((resolve) => {
                    if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
                        return resolve();
                    }
                    window.__onGCastApiAvailable = function(isAvailable) {
                        if (isAvailable && window.cast && window.chrome && window.chrome.cast) {
                            window.cast.framework.CastContext.getInstance().setOptions({
                                receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
                                autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
                            });
                        }
                        resolve();
                    };
                    if (!document.getElementById('cast-sdk')) {
                        const script = document.createElement('script');
                        script.id = 'cast-sdk';
                        script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
                        document.head.appendChild(script);
                    }
                    setTimeout(resolve, 1500); 
                });

                await Promise.all([
                    loadScript('https://cdn.jsdelivr.net/npm/hls.js@1', 'Hls'),
                    loadScript('https://cdn.plyr.io/3.7.8/plyr.polyfilled.js', 'Plyr')
                ]);

                if (!isMounted) return;

                if (hlsInstanceRef.current) hlsInstanceRef.current.destroy();
                if (playerInstanceRef.current) playerInstanceRef.current.destroy();

                if (containerRef.current) {
                    containerRef.current.innerHTML = '<video id="native-video-player" playsinline style="width: 100%; height: 100%; background: black;"></video>';
                }
                const videoEl = document.getElementById('native-video-player');
                if (!videoEl) throw new Error("No se pudo inyectar el elemento de vídeo.");

                const plyrOptions = {
                    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
                    settings: ['quality'],
                    autoplay: true
                };

                if (window.Hls.isSupported()) {
                    const hls = new window.Hls();
                    hlsInstanceRef.current = hls;
                    hls.loadSource(m3u8Url);
                    hls.attachMedia(videoEl);
                    
                    hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
                        if (!isMounted) return;
                        playerInstanceRef.current = new window.Plyr(videoEl, plyrOptions);
                        setStatus(''); 
                        videoEl.play().catch(e => console.log("Clic requerido para auto-play."));
                    });

                    hls.on(window.Hls.Events.ERROR, (event, data) => {
                        if (data.fatal && isMounted) {
                            if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                                hls.startLoad();
                            } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
                                hls.recoverMediaError();
                            } else {
                                setError('Error crítico de red. Refresca la página.');
                                setStatus('');
                            }
                        }
                    });

                } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
                    videoEl.src = m3u8Url;
                    videoEl.addEventListener('loadedmetadata', function () {
                        if (!isMounted) return;
                        playerInstanceRef.current = new window.Plyr(videoEl, plyrOptions);
                        setStatus('');
                        videoEl.play().catch(() => {});
                    });
                }
            } catch (err) {
                if (!isMounted) return;
                setError(err.message);
                setStatus('');
            }
        };

        initPlayer();

        return () => {
            isMounted = false;
            if (hlsInstanceRef.current) hlsInstanceRef.current.destroy();
            if (playerInstanceRef.current) playerInstanceRef.current.destroy();
        };
    }, [streamSid, streamPassword, channel, usePatreon]);

    return (
        <div className="w-full h-full bg-black relative flex items-center justify-center group/vid">
            {status && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20 flex-col gap-4">
                    <div className="w-10 h-10 border-4 border-[#e5a00d] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[#e5a00d] font-bold text-sm tracking-widest uppercase text-center px-4">{status}</span>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-20 flex-col gap-3 p-6 text-center">
                    <AlertTriangle size={48} className="text-red-500" />
                    <span className="text-red-500 font-bold text-lg">Error del Reproductor</span>
                    <span className="text-gray-400 text-sm max-w-md">{error}</span>
                </div>
            )}
            
            <div ref={containerRef} className="w-full h-full absolute inset-0 z-10 flex flex-col justify-center"></div>

            {!status && !error && (
                <div className="absolute top-4 right-4 z-30 opacity-100 lg:opacity-0 lg:group-hover/vid:opacity-100 transition-opacity duration-300">
                    <button
                        onClick={handleCastRequest}
                        className="bg-black/60 hover:bg-[#e5a00d] text-white hover:text-black backdrop-blur-md border border-white/10 p-2.5 rounded-full transition-all shadow-lg flex items-center justify-center"
                        title={t.enviar_tv}
                    >
                        <Cast size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}