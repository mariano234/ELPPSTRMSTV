import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { extractIdentifier } from '../utils';
import { API_BASE } from '../config';

export default function NativeStreamPlayer({ streamSid, streamPassword, channel, usePatreon, t }) {
    const containerRef = useRef(null);
    const playerInstanceRef = useRef(null);
    const hlsInstanceRef = useRef(null);
    const m3u8UrlRef = useRef(null); 
    
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('Autenticando...');
    const [quality, setQuality] = useState(1080);

    // Función global para cargar el vídeo en el Chromecast
    window.loadCastMedia = (session) => {
        if (!m3u8UrlRef.current) return;

        const origin = window.location.origin.includes('localhost') ? 'https://elppstrmstv.pages.dev' : window.location.origin;
        const absoluteUrl = (m3u8UrlRef.current.startsWith('http') ? m3u8UrlRef.current : origin + m3u8UrlRef.current) + '&ext=.m3u8';
            
        const mediaInfo = new window.chrome.cast.media.MediaInfo(absoluteUrl, 'application/x-mpegurl');
        mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE; 
        mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = 'Directo - ElPepeStreams';
        
        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
        
        session.loadMedia(request).then(
            () => console.log('Chromecast: Vídeo cargado correctamente.'),
            (err) => {
                console.error('Chromecast Error:', err);
                alert("El televisor no pudo reproducir el formato de AngelThump.");
            }
        );
    };

    // Bloqueo de rotación de pantalla en móviles
    useEffect(() => {
        const handleFullscreenChange = () => {
            if (document.fullscreenElement) {
                try {
                    if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
                        window.screen.orientation.lock('landscape').catch(() => {});
                    }
                } catch (e) {}
            } else {
                try {
                    if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
                        window.screen.orientation.unlock();
                    }
                } catch (e) {}
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Inicialización del Reproductor
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

                const targetFile = quality === 1080 ? `${channel}.m3u8` : `${channel}_medium.m3u8`;
                const rawM3u8 = `https://vigor.angelthump.com/hls/${targetFile}?token=${data.token}`;
                
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
                        /* Forzamos a que el deslizador de volumen desaparezca */
                        .plyr__volume input[type="range"] { display: none !important; }
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

                // Inicializar Chromecast
                await new Promise((resolve) => {
                    if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
                        return resolve();
                    }
                    window.__onGCastApiAvailable = function(isAvailable) {
                        if (isAvailable && window.cast && window.chrome && window.chrome.cast) {
                            const context = window.cast.framework.CastContext.getInstance();
                            context.setOptions({
                                receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
                                autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
                            });
                            
                            context.addEventListener(
                                window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
                                (event) => {
                                    if (event.sessionState === window.cast.framework.SessionState.SESSION_STARTED) {
                                        window.loadCastMedia(context.getCurrentSession());
                                    }
                                }
                            );

                            // Escuchador de estado para actualizar el botón visual
                            context.addEventListener(
                                window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
                                (event) => {
                                    if (window.updateCustomCastButtonState) {
                                        window.updateCustomCastButtonState(event.castState);
                                    }
                                }
                            );
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
                    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'settings', 'pip', 'airplay', 'fullscreen'],
                    settings: ['quality'],
                    quality: {
                        default: quality,
                        options: [1080, 720],
                        forced: true,
                        onChange: (newQuality) => {
                            if (newQuality !== quality) setQuality(newQuality);
                        }
                    },
                    i18n: {
                        qualityLabel: {
                            1080: '1080p (Source)',
                            720: '720p (Medium)'
                        }
                    },
                    storage: { enabled: false }, 
                    autoplay: true
                };

                // FABRICACIÓN DEL BOTÓN CHROMECAST PERSONALIZADO
                const setupCustomCastButton = (player) => {
                    player.on('ready', () => {
                        const controls = document.querySelector('.plyr__controls');
                        if (controls && !document.getElementById('plyr-custom-cast-btn')) {
                            const castWrapper = document.createElement('div');
                            castWrapper.id = 'plyr-custom-cast-btn';
                            castWrapper.className = 'plyr__controls__item';
                            castWrapper.style.display = 'flex';
                            castWrapper.style.alignItems = 'center';
                            
                            const btn = document.createElement('button');
                            btn.className = 'plyr__control';
                            btn.type = 'button';
                            btn.style.position = 'relative';
                            btn.style.display = 'flex';
                            btn.style.alignItems = 'center';
                            btn.style.justifyContent = 'center';
                            btn.style.width = '34px';
                            btn.style.height = '34px';

                            const tooltip = document.createElement('span');
                            tooltip.className = 'plyr__tooltip';
                            tooltip.innerText = 'Buscando TV...';

                            const iconContainer = document.createElement('div');
                            
                            btn.appendChild(iconContainer);
                            btn.appendChild(tooltip);
                            castWrapper.appendChild(btn);

                            // Lógica de click para solicitar envío a la TV
                            btn.addEventListener('click', async () => {
                                const context = window.cast?.framework?.CastContext?.getInstance();
                                if (context) {
                                    try { await context.requestSession(); } 
                                    catch (e) { console.log("Conexión Cast cancelada."); }
                                }
                            });

                            // Función para actualizar los iconos y el color
                            window.updateCustomCastButtonState = (state) => {
                                const svgNormal = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 20a2 2 0 0 0 2-2"/><path d="M2 16a6 6 0 0 1 6 6"/><path d="M2 12a10 10 0 0 1 10 10"/></svg>`;
                                const svgTachado = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 20a2 2 0 0 0 2-2"/><path d="M2 16a6 6 0 0 1 6 6"/><path d="M2 12a10 10 0 0 1 10 10"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"/></svg>`;

                                if (state === window.cast?.framework?.CastState?.NO_DEVICES_AVAILABLE) {
                                    iconContainer.innerHTML = svgTachado;
                                    iconContainer.style.color = '#9ca3af'; // Gris tachado
                                    btn.style.cursor = 'not-allowed';
                                    tooltip.innerText = 'TV no encontrada';
                                } else if (state === window.cast?.framework?.CastState?.CONNECTED) {
                                    iconContainer.innerHTML = svgNormal;
                                    iconContainer.style.color = '#e5a00d'; // Naranja activo
                                    btn.style.cursor = 'pointer';
                                    tooltip.innerText = 'Desconectar TV';
                                } else {
                                    iconContainer.innerHTML = svgNormal;
                                    iconContainer.style.color = 'white'; // Blanco listo para usar
                                    btn.style.cursor = 'pointer';
                                    tooltip.innerText = 'Enviar a TV';
                                }
                            };

                            // Estado inicial
                            if (window.cast?.framework?.CastContext) {
                                window.updateCustomCastButtonState(window.cast.framework.CastContext.getInstance().getCastState());
                            } else {
                                window.updateCustomCastButtonState('NO_DEVICES_AVAILABLE');
                            }

                            const fullscreenBtn = controls.querySelector('[data-plyr="fullscreen"]');
                            if (fullscreenBtn) controls.insertBefore(castWrapper, fullscreenBtn);
                            else controls.appendChild(castWrapper);
                        }
                    });
                };

                if (window.Hls.isSupported()) {
                    const hls = new window.Hls();
                    hlsInstanceRef.current = hls;
                    hls.loadSource(m3u8Url);
                    hls.attachMedia(videoEl);
                    
                    hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
                        if (!isMounted) return;
                        playerInstanceRef.current = new window.Plyr(videoEl, plyrOptions);
                        setupCustomCastButton(playerInstanceRef.current);
                        setStatus(''); 
                        videoEl.play().catch(e => console.log("Clic requerido para auto-play."));
                    });

                    hls.on(window.Hls.Events.ERROR, (event, data) => {
                        if (data.fatal && isMounted) {
                            if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                                if (data.details === window.Hls.ErrorDetails.MANIFEST_LOAD_ERROR || (data.response && data.response.code >= 400)) {
                                    if (quality === 720) {
                                        console.warn("720p no disponible. Volviendo a 1080p automáticamente...");
                                        setQuality(1080); 
                                    } else {
                                        setError('El directo está offline o el token ha caducado.');
                                        setStatus('');
                                    }
                                } else {
                                    setTimeout(() => hls.startLoad(), 1000);
                                }
                            } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
                                hls.recoverMediaError();
                            } else {
                                setError('Error crítico del reproductor.');
                                setStatus('');
                            }
                        }
                    });

                } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
                    videoEl.src = m3u8Url;
                    videoEl.addEventListener('error', () => {
                        if (isMounted) {
                            if (quality === 720) setQuality(1080);
                            else { setError('El directo está offline.'); setStatus(''); }
                        }
                    });
                    videoEl.addEventListener('loadedmetadata', function () {
                        if (!isMounted) return;
                        playerInstanceRef.current = new window.Plyr(videoEl, plyrOptions);
                        setupCustomCastButton(playerInstanceRef.current);
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
    }, [streamSid, streamPassword, channel, usePatreon, quality]);

    return (
        <div className="w-full h-full bg-black relative flex items-center justify-center">
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
        </div>
    );
}