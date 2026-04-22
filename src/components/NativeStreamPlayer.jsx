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
    const [quality, setQuality] = useState(1080); // 1080 para 'src', 720 para 'medium'

    // Exponemos la función de cast de forma global para que el listener pueda acceder siempre a la URL más reciente
    window.loadCastMedia = (session) => {
        if (!m3u8UrlRef.current) return;

        const origin = window.location.origin.includes('localhost') ? 'https://elppstrmstv.pages.dev' : window.location.origin;
        // Engañamos a las TVs Samsung/LG añadiendo &ext=.m3u8 al final para que el parser lo reconozca
        const absoluteUrl = (m3u8UrlRef.current.startsWith('http') ? m3u8UrlRef.current : origin + m3u8UrlRef.current) + '&ext=.m3u8';
            
        const mediaInfo = new window.chrome.cast.media.MediaInfo(absoluteUrl, 'application/x-mpegurl');
        mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE; // CRÍTICO para Smart TVs
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

    // --- ROTACIÓN AUTOMÁTICA EN MÓVILES ---
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

    // --- LÓGICA PRINCIPAL DEL REPRODUCTOR ---
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

                // Seleccionamos el archivo de streaming según la calidad elegida
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
                            
                            // Escucha cuando se conecta un TV para inyectar la URL del stream
                            context.addEventListener(
                                window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
                                (event) => {
                                    if (event.sessionState === window.cast.framework.SessionState.SESSION_STARTED) {
                                        window.loadCastMedia(context.getCurrentSession());
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

                // --- CONFIGURACIÓN PLYR CON CALIDAD MANUAL ---
                const plyrOptions = {
                    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
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
                    autoplay: true
                };

                // --- INYECTAR BOTÓN CHROMECAST DENTRO DE PLYR ---
                const setupCustomCastButton = (player) => {
                    player.on('ready', () => {
                        const controls = document.querySelector('.plyr__controls');
                        if (controls && !document.getElementById('plyr-cast-btn')) {
                            const castContainer = document.createElement('div');
                            castContainer.id = 'plyr-cast-btn';
                            castContainer.className = 'plyr__controls__item plyr__control';
                            castContainer.style.display = 'flex';
                            castContainer.style.alignItems = 'center';
                            castContainer.style.justifyContent = 'center';
                            castContainer.style.padding = '0 5px';
                            // Invocamos el botón nativo de Google Cast
                            castContainer.innerHTML = `<google-cast-launcher style="width: 22px; height: 22px; cursor: pointer; --connected-color: #e5a00d; --disconnected-color: white;"></google-cast-launcher>`;
                            
                            // Insertar justo antes del botón de Pantalla Completa
                            const fullscreenBtn = controls.querySelector('[data-plyr="fullscreen"]');
                            if (fullscreenBtn) {
                                controls.insertBefore(castContainer, fullscreenBtn);
                            } else {
                                controls.appendChild(castContainer);
                            }
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
                    // Soporte Nativo (iOS Safari)
                    videoEl.src = m3u8Url;
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
    }, [streamSid, streamPassword, channel, usePatreon, quality]); // Recarga si cambias la calidad

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