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

    // Iconos de Chromecast clásicos y limpios
    const svgCastNormal = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/></svg>`;
    const svgCastTachado = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

    window.loadCastMedia = (session) => {
        if (!m3u8UrlRef.current) return;

        const origin = window.location.origin.includes('localhost') ? 'https://elppstrmstv.pages.dev' : window.location.origin;
        const absoluteUrl = (m3u8UrlRef.current.startsWith('http') ? m3u8UrlRef.current : origin + m3u8UrlRef.current) + '&ext=.m3u8';
            
        const mediaInfo = new window.chrome.cast.media.MediaInfo(absoluteUrl, 'application/x-mpegurl');
        mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE; 

        // --- SE PASA A FMP4 PARA QUE FUNCIONE EN TV ---
        mediaInfo.hlsSegmentFormat = window.chrome.cast.media.HlsSegmentFormat.FMP4;
        mediaInfo.hlsVideoSegmentFormat = window.chrome.cast.media.HlsVideoSegmentFormat.FMP4;
        // --------------------------------------------------------

        mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = 'Directo - ElPepeStreams';
        
        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
        request.autoplay = true; // Forzamos el auto-play en la tele
        
        session.loadMedia(request).then(
            () => {
                console.log('Chromecast: Vídeo cargado correctamente.');
                // Si arranca en la tele, pausamos el reproductor de la web
                if (playerInstanceRef.current) playerInstanceRef.current.pause();
            },
            (err) => {
                console.error('Chromecast Error:', err);
                alert("El televisor no pudo reproducir el formato de AngelThump.");
            }
        );
    };

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

                // Siempre pedimos la URL MAESTRA (contiene las sub-rutas dinámicas correctas)
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

                // Configuración Base de Plyr
                const basePlyrOptions = {
                    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'settings', 'pip', 'airplay', 'fullscreen'],
                    settings: ['quality'],
                    storage: { enabled: false }, 
                    autoplay: true
                };

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
                            iconContainer.style.display = 'flex';
                            iconContainer.style.alignItems = 'center';
                            
                            btn.appendChild(iconContainer);
                            btn.appendChild(tooltip);
                            castWrapper.appendChild(btn);

                            btn.addEventListener('click', async () => {
                                const context = window.cast?.framework?.CastContext?.getInstance();
                                if (context) {
                                    try { await context.requestSession(); } 
                                    catch (e) { console.log("Conexión Cast cancelada."); }
                                }
                            });

                            window.updateCustomCastButtonState = (state) => {
                                if (state === window.cast?.framework?.CastState?.NO_DEVICES_AVAILABLE) {
                                    iconContainer.innerHTML = svgCastTachado;
                                    iconContainer.style.color = '#9ca3af'; 
                                    btn.style.cursor = 'not-allowed';
                                    tooltip.innerText = 'TV no encontrada';
                                } else if (state === window.cast?.framework?.CastState?.CONNECTED) {
                                    iconContainer.innerHTML = svgCastNormal;
                                    iconContainer.style.color = '#e5a00d'; 
                                    btn.style.cursor = 'pointer';
                                    tooltip.innerText = 'Desconectar TV';
                                } else {
                                    iconContainer.innerHTML = svgCastNormal;
                                    iconContainer.style.color = 'white'; 
                                    btn.style.cursor = 'pointer';
                                    tooltip.innerText = 'Enviar a TV';
                                }
                            };

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
                    
                    // Cuando HLS.js lee el manifiesto maestro, inyectamos las calidades detectadas a Plyr
                    hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
                        if (!isMounted) return;
                        
                        const availableQualities = hls.levels.map(l => l.height).filter(h => h);
                        let finalOptions = { ...basePlyrOptions };

                        // Si hay calidades detectadas (ej: 1080, 720), montamos el menú
                        if (availableQualities.length > 0) {
                            availableQualities.unshift(0); // 0 significa "Auto"
                            finalOptions.quality = {
                                default: 0,
                                options: availableQualities,
                                forced: true,
                                onChange: (newQuality) => {
                                    if (newQuality === 0) {
                                        hls.currentLevel = -1; // -1 es Auto en hls.js
                                    } else {
                                        // Buscamos la calidad elegida y cambiamos "al vuelo"
                                        const levelIndex = hls.levels.findIndex(l => l.height === newQuality);
                                        if (levelIndex !== -1) hls.currentLevel = levelIndex;
                                    }
                                }
                            };
                            finalOptions.i18n = {
                                qualityLabel: { 0: 'Auto', 1080: '1080p', 720: '720p', 480: '480p' }
                            };
                        }

                        playerInstanceRef.current = new window.Plyr(videoEl, finalOptions);
                        setupCustomCastButton(playerInstanceRef.current);
                        setStatus(''); 
                        videoEl.play().catch(e => console.log("Clic requerido para auto-play."));
                    });

                    hls.on(window.Hls.Events.ERROR, (event, data) => {
                        if (data.fatal && isMounted) {
                            if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                                setTimeout(() => hls.startLoad(), 1000);
                            } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
                                hls.recoverMediaError();
                            } else {
                                setError('Error crítico del reproductor.');
                                setStatus('');
                            }
                        }
                    });

                } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
                    // Soporte iOS / Safari Nativo (Gestionan la calidad por sí mismos)
                    videoEl.src = m3u8Url;
                    videoEl.addEventListener('error', () => {
                        if (isMounted) { setError(`El canal está offline.`); setStatus(''); }
                    });
                    videoEl.addEventListener('loadedmetadata', function () {
                        if (!isMounted) return;
                        // Ocultamos la tuerca en iOS porque Apple controla las calidades
                        basePlyrOptions.settings = [];
                        playerInstanceRef.current = new window.Plyr(videoEl, basePlyrOptions);
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
    }, [streamSid, streamPassword, channel, usePatreon]); // <-- Ya no depende de quality

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