import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Home, Film, Download, X, Info, ChevronRight, ChevronLeft, AlertTriangle, Monitor, Layers, Star, Grid, List as ListIcon, Filter, ArrowDownWideNarrow, Globe, Calendar, Tv, Radio, Server, Lock, CheckCircle, RefreshCw } from 'lucide-react';

// --- CONFIGURACIÓN ---
const TMDB_API_KEY = "342815a2b6a677bbc29fd13a6e3c1c3a"; 
const SHEET_ID = "104RB6GK9_m_nzIakTU3MJLaDJPwt9fYmfHF3ikyixFE";
const CACHE_VERSION = "v2_multilang"; 
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; 
const STREAM_CHANNEL = "elpintaunas"; 

// --- API BACKEND (Cloudflare) ---
const API_BASE = "/api"; 

const LANGUAGE_MAP = {
  'es': 'Español', 'es-es': 'Español (España)', 'es-mx': 'Español (Latino)',
  'en': 'Inglés', 'en-us': 'Inglés (EEUU)', 'en-gb': 'Inglés (Reino Unido)',
  'cat': 'Catalán', 'ca': 'Catalán', 'va': 'Valenciano', 'val': 'Valenciano',
  'eus': 'Euskera', 'eu': 'Euskera', 'gal': 'Gallego', 'gl': 'Gallego',
  'fr': 'Francés', 'it': 'Italiano', 'de': 'Alemán', 'ja': 'Japonés', 'jp': 'Japonés', 'ko': 'Coreano', 'pt': 'Portugués'
};

// --- DICCIONARIO DE GÉNEROS ---
const GENRE_TRANSLATIONS = {
    'Acción': { ca: 'Acció', gl: 'Acción', eu: 'Ekintza', es: 'Acción' },
    'Action': { ca: 'Acció', gl: 'Acción', eu: 'Ekintza', es: 'Acción' },
    'Aventura': { ca: 'Aventura', gl: 'Aventura', eu: 'Abentura', es: 'Aventura' },
    'Adventure': { ca: 'Aventura', gl: 'Aventura', eu: 'Abentura', es: 'Aventura' },
    'Animación': { ca: 'Animació', gl: 'Animación', eu: 'Animazioa', es: 'Animación' },
    'Animation': { ca: 'Animació', gl: 'Animación', eu: 'Animazioa', es: 'Animación' },
    'Comedia': { ca: 'Comèdia', gl: 'Comedia', eu: 'Komedia', es: 'Comedia' },
    'Comedy': { ca: 'Comèdia', gl: 'Comedia', eu: 'Komedia', es: 'Comedia' },
    'Crimen': { ca: 'Crim', gl: 'Crime', eu: 'Krimena', es: 'Crimen' },
    'Crime': { ca: 'Crim', gl: 'Crime', eu: 'Krimena', es: 'Crimen' },
    'Documental': { ca: 'Documental', gl: 'Documental', eu: 'Dokumentala', es: 'Documental' },
    'Documentary': { ca: 'Documental', gl: 'Documental', eu: 'Dokumentala', es: 'Documental' },
    'Drama': { ca: 'Drama', gl: 'Drama', eu: 'Drama', es: 'Drama' },
    'Familia': { ca: 'Família', gl: 'Familia', eu: 'Familia', es: 'Familia' },
    'Family': { ca: 'Família', gl: 'Familia', eu: 'Familia', es: 'Familia' },
    'Fantasía': { ca: 'Fantasia', gl: 'Fantasía', eu: 'Fantasia', es: 'Fantasía' },
    'Fantasy': { ca: 'Fantasia', gl: 'Fantasía', eu: 'Fantasia', es: 'Fantasía' },
    'Historia': { ca: 'Història', gl: 'Historia', eu: 'Historia', es: 'Historia' },
    'History': { ca: 'Història', gl: 'Historia', eu: 'Historia', es: 'Historia' },
    'Terror': { ca: 'Terror', gl: 'Terror', eu: 'Beldurra', es: 'Terror' },
    'Horror': { ca: 'Terror', gl: 'Terror', eu: 'Beldurra', es: 'Terror' },
    'Música': { ca: 'Música', gl: 'Música', eu: 'Musika', es: 'Música' },
    'Music': { ca: 'Música', gl: 'Música', eu: 'Musika', es: 'Música' },
    'Misterio': { ca: 'Misteri', gl: 'Misterio', eu: 'Misterioa', es: 'Misterio' },
    'Mystery': { ca: 'Misteri', gl: 'Misterio', eu: 'Misterioa', es: 'Misterio' },
    'Romance': { ca: 'Romanç', gl: 'Romance', eu: 'Erromantzea', es: 'Romance' },
    'Ciencia ficción': { ca: 'Ciència ficció', gl: 'Ciencia ficción', eu: 'Zientzia fikzioa', es: 'Ciencia ficción' },
    'Science Fiction': { ca: 'Ciència ficció', gl: 'Ciencia ficción', eu: 'Zientzia fikzioa', es: 'Ciencia ficción' },
    'Película de TV': { ca: 'Pel·lícula de TV', gl: 'Película de TV', eu: 'Telebistako filma', es: 'Película de TV' },
    'TV Movie': { ca: 'Pel·lícula de TV', gl: 'Película de TV', eu: 'Telebistako filma', es: 'Película de TV' },
    'Suspense': { ca: 'Suspens', gl: 'Suspense', eu: 'Suspensea', es: 'Suspense' },
    'Thriller': { ca: 'Suspens', gl: 'Suspense', eu: 'Suspensea', es: 'Suspense' },
    'Bélica': { ca: 'Bèl·lica', gl: 'Bélica', eu: 'Gerra', es: 'Bélica' },
    'War': { ca: 'Bèl·lica', gl: 'Bélica', eu: 'Gerra', es: 'Bélica' },
    'Western': { ca: 'Western', gl: 'Western', eu: 'Western', es: 'Western' }
};

const LANG_TRANSLATIONS = {
    'es': {
        'Español': 'Español', 'Español (España)': 'Español (España)', 'Español (Latino)': 'Español (Latino)',
        'Inglés': 'Inglés', 'Inglés (EEUU)': 'Inglés (EEUU)', 'Inglés (Reino Unido)': 'Inglés (Reino Unido)',
        'Catalán': 'Catalán', 'Valenciano': 'Valenciano', 'Euskera': 'Euskera', 'Gallego': 'Gallego',
        'Francés': 'Francés', 'Italiano': 'Italiano', 'Alemán': 'Alemán', 'Japonés': 'Japonés', 'Portugués': 'Portugués'
    },
    'ca': {
        'Español': 'Espanyol', 'Español (España)': 'Espanyol (Espanya)', 'Español (Latino)': 'Espanyol (Llatí)',
        'Inglés': 'Anglès', 'Inglés (EEUU)': 'Anglès (EUA)', 'Inglés (Reino Unido)': 'Anglès (Regne Unit)',
        'Catalán': 'Català', 'Valenciano': 'Valencià', 'Euskera': 'Basc', 'Gallego': 'Gallec',
        'Francés': 'Francès', 'Italiano': 'Italià', 'Alemán': 'Alemany', 'Japonés': 'Japonès', 'Portugués': 'Portuguès'
    },
    'gl': {
        'Español': 'Español', 'Español (España)': 'Español (España)', 'Español (Latino)': 'Español (Latino)',
        'Inglés': 'Inglés', 'Inglés (EEUU)': 'Inglés (EEUU)', 'Inglés (Reino Unido)': 'Inglés (Reino Unido)',
        'Catalán': 'Catalán', 'Valenciano': 'Valenciano', 'Euskera': 'Euskera', 'Gallego': 'Galego',
        'Francés': 'Francés', 'Italiano': 'Italiano', 'Alemán': 'Alemán', 'Japonés': 'Xaponés', 'Portugués': 'Portugués'
    },
    'eu': {
        'Español': 'Gaztelania', 'Español (España)': 'Gaztelania (Espainia)', 'Español (Latino)': 'Gaztelania (Latino)',
        'Inglés': 'Ingelesa', 'Inglés (EEUU)': 'Ingelesa (AEB)', 'Inglés (Reino Unido)': 'Ingelesa (Erresuma Batua)',
        'Catalán': 'Katalana', 'Valenciano': 'Valentziera', 'Euskera': 'Euskara', 'Gallego': 'Galiziera',
        'Francés': 'Frantsesa', 'Italiano': 'Italiera', 'Alemán': 'Alemana', 'Japonés': 'Japoniera', 'Portugués': 'Portugesa'
    }
};

const UI_TRANSLATIONS = {
  'es': {
    inicio: 'INICIO', pelis: 'PELIS', series: 'SERIES', directos: 'DIRECTOS',
    buscar: 'Buscar películas...', recomendados: 'Recomendados de hoy',
    mejor_valoradas: 'Mejor Valoradas', ultimos: 'Últimos Lanzamientos',
    sagas: 'Sagas y Colecciones', ver_todos: 'Ver todos',
    filtro_genero: '+ Género', filtro_calidad: '+ Calidad', filtro_idioma: '+ Idioma',
    filtro_ano: '+ Año', orden_defecto: 'Orden por defecto', orden_az: 'Alfabético (A - Z)',
    orden_za: 'Alfabético (Z - A)', orden_rating: 'Mejor Valoradas', orden_year: 'Más Recientes',
    limpiar: 'Limpiar todos', resultados: 'Resultados de búsqueda',
    cargar_mas: 'Cargar más resultados', restantes: 'restantes',
    volver: 'VOLVER', recomendado_para_ti: 'RECOMENDADO PARA TI', ver_detalles: 'VER DETALLES',
    coleccion_oficial: 'Colección Oficial', pelis_biblioteca: 'Películas en tu biblioteca',
    descargar: 'DESCARGAR A MI BIBLIOTECA', enlace_no_disp: 'ENLACE NO DISPONIBLE',
    mas_saga: 'Más de esta saga', titulos_similares: 'Títulos similares recomendados',
    sin_descripcion: 'Sin descripción disponible.', sinc_biblio: 'Sincronizando con tu biblioteca...',
    calidad: 'Calidad', idiomas: 'Idiomas', año: 'Año', error_fallo: 'Vaya, algo ha fallado',
    proximamente: 'Próximamente...', prep_series: 'Estamos preparando todo el catálogo de series para integrarlo en la plataforma. ¡Vuelve muy pronto!',
    acceso_premium: 'Acceso Premium', pass_directo: 'Autenticación Requerida',
    desc_directo: 'El directo está protegido. Verifica que tienes el rol requerido en nuestro servidor de Discord para acceder.',
    verificando: 'Verificando...', refrescar_pass: 'Refrescar Sesión', verificar_rol: 'Verificar mi Rol en Discord',
    vacio: 'Vacío', sin_pass: 'Sin Contraseña', serv_patreon: 'Premium (Patreon)', serv_normal: 'Normal (Público)',
    acceso_concedido: 'Acceso VIP Concedido',
    credenciales_inyectadas: 'Tus credenciales se han inyectado automáticamente en el reproductor. ¡Disfruta del directo!',
    selecciona_servidor: 'Selecciona tu Servidor',
    servidor_no_disp: 'Servidor Premium no disponible con tu rol actual.',
    panel_servidor: 'Panel de Control'
  },
  'ca': {
    inicio: 'INICI', pelis: 'PEL·LIS', series: 'SÈRIES', directos: 'DIRECTES',
    buscar: 'Cercar pel·lícules...', recomendados: 'Recomanats d\'avui',
    mejor_valoradas: 'Més ben valorades', ultimos: 'Últims Llançaments',
    sagas: 'Sagues i Col·leccions', ver_todos: 'Veure tots',
    filtro_genero: '+ Gènere', filtro_calidad: '+ Qualitat', filtro_idioma: '+ Idioma',
    filtro_ano: '+ Any', orden_defecto: 'Ordre per defecte', orden_az: 'Alfabètic (A - Z)',
    orden_za: 'Alfabètic (Z - A)', orden_rating: 'Més ben valorades', orden_year: 'Més Recents',
    limpiar: 'Netejar tots', resultados: 'Resultats de cerca',
    cargar_mas: 'Carregar més resultats', restantes: 'restants',
    volver: 'TORNAR', recomendado_para_ti: 'RECOMANAT PER A TU', ver_detalles: 'VEURE DETALLS',
    coleccion_oficial: 'Col·lecció Oficial', pelis_biblioteca: 'Pel·lícules a la teva biblioteca',
    descargar: 'DESCARREGAR A LA MEVA BIBLIOTECA', enlace_no_disp: 'ENLLAÇ NO DISPONIBLE',
    mas_saga: 'Més d\'aquesta saga', titulos_similares: 'Títols similars recomanats',
    sin_descripcion: 'Sense descripció disponible.', sinc_biblio: 'Sincronitzant amb la teva biblioteca...',
    calidad: 'Qualitat', idiomas: 'Idiomes', año: 'Any', error_fallo: 'Vaja, alguna cosa ha fallat',
    proximamente: 'Aviat...', prep_series: 'Estem preparant tot el catàleg de sèries per integrar-lo a la plataforma. Torna molt aviat!',
    acceso_premium: 'Accés Premium', pass_directo: 'Autenticació Requerida',
    desc_directo: 'El directe està protegit. Verifica que tens el rol requerit al nostre servidor de Discord per accedir-hi.',
    verificando: 'Verificant...', refrescar_pass: 'Refrescar Sessió', verificar_rol: 'Verificar el meu Rol a Discord',
    vacio: 'Buit', sin_pass: 'Sense Contrasenya', serv_patreon: 'Premium (Patreon)', serv_normal: 'Normal (Públic)',
    acceso_concedido: 'Accés VIP Concedit',
    credenciales_inyectadas: 'Les teves credencials s\'han injectat automàticament al reproductor. Gaudeix del directe!',
    selecciona_servidor: 'Selecciona el teu Servidor',
    servidor_no_disp: 'Servidor Premium no disponible amb el teu rol actual.',
    panel_servidor: 'Tauler de Control'
  },
  'gl': {
    inicio: 'INICIO', pelis: 'PELIS', series: 'SERIES', directos: 'DIRECTOS',
    buscar: 'Buscar películas...', recomendados: 'Recomendados de hoxe',
    mejor_valoradas: 'Mellor Valoradas', ultimos: 'Últimos Lanzamentos',
    sagas: 'Sagas e Coleccións', ver_todos: 'Ver todos',
    filtro_genero: '+ Xénero', filtro_calidad: '+ Calidade', filtro_idioma: '+ Idioma',
    filtro_ano: '+ Ano', orden_defecto: 'Orde por defecto', orden_az: 'Alfabético (A - Z)',
    orden_za: 'Alfabético (Z - A)', orden_rating: 'Mellor Valoradas', orden_year: 'Máis Recentes',
    limpiar: 'Limpar todos', resultados: 'Resultados da busca',
    cargar_mas: 'Cargar máis resultados', restantes: 'restantes',
    volver: 'VOLVER', recomendado_para_ti: 'RECOMENDADO PARA TI', ver_detalles: 'VER DETALLES',
    coleccion_oficial: 'Colección Oficial', pelis_biblioteca: 'Películas na túa biblioteca',
    descargar: 'DESCARGAR Á MIÑA BIBLIOTECA', enlace_no_disp: 'ENLACE NON DISPOÑIBLE',
    mas_saga: 'Máis desta saga', titulos_similares: 'Títulos similares recomendados',
    sin_descripcion: 'Sen descrición dispoñible.', sinc_biblio: 'Sincronizando coa túa biblioteca...',
    calidad: 'Calidade', idiomas: 'Idiomas', año: 'Ano', error_fallo: 'Oes, algo fallou',
    proximamente: 'Proximamente...', prep_series: 'Estamos a preparar todo o catálogo de series para integralo na plataforma. Volve moi pronto!',
    acceso_premium: 'Acceso Premium', pass_directo: 'Autenticación Requirida',
    desc_directo: 'O directo está protexido. Verifica que tes o rol requirido no noso servidor de Discord para acceder.',
    verificando: 'Verificando...', refrescar_pass: 'Refrescar Sesión', verificar_rol: 'Verificar o meu Rol en Discord',
    vacio: 'Baleiro', sin_pass: 'Sen Contrasinal', serv_patreon: 'Premium (Patreon)', serv_normal: 'Normal (Público)',
    acceso_concedido: 'Acceso VIP Concedido',
    credenciales_inyectadas: 'As túas credenciais inxectáronse automaticamente no reprodutor. Goza do directo!',
    selecciona_servidor: 'Selecciona o teu Servidor',
    servidor_no_disp: 'Servidor Premium non dispoñible co teu rol actual.',
    panel_servidor: 'Panel de Control'
  },
  'eu': {
    inicio: 'HASIERA', pelis: 'FILMAK', series: 'TELESAILAK', directos: 'ZUZENEKOAK',
    buscar: 'Filmak bilatu...', recomendados: 'Gaurko gomendioak',
    mejor_valoradas: 'Balorazio onenak', ultimos: 'Azken Argitalpenak',
    sagas: 'Sagak eta Bildumak', ver_todos: 'Ikusi guztiak',
    filtro_genero: '+ Generoa', filtro_calidad: '+ Kalitatea', filtro_idioma: '+ Hizkuntza',
    filtro_ano: '+ Urtea', orden_defecto: 'Ordena lehenetsia', orden_az: 'Alfabetikoa (A - Z)',
    orden_za: 'Alfabetikoa (Z - A)', orden_rating: 'Balorazio onenak', orden_year: 'Berrienak',
    limpiar: 'Garbitu denak', resultados: 'Bilaketaren emaitzak',
    cargar_mas: 'Emaitza gehiago kargatu', restantes: 'falta dira',
    volver: 'ITZULI', recomendado_para_ti: 'ZURETZAT GOMENDATUA', ver_detalles: 'IKUSI XEHETASUNAK',
    coleccion_oficial: 'Bilduma Ofiziala', pelis_biblioteca: 'Filmak zure liburutegian',
    descargar: 'NIRE LIBURUTEGIRA DESKARGATU', enlace_no_disp: 'ESTEKA EZ DAGO ESKURAGARRI',
    mas_saga: 'Saga honetako gehiago', titulos_similares: 'Gomendatutako antzeko tituluak',
    sin_descripcion: 'Ez dago deskribapenik eskuragarri.', sinc_biblio: 'Zure liburutegiarekin sinkronizatzen...',
    calidad: 'Kalitatea', idiomas: 'Hizkuntzak', año: 'Urtea', error_fallo: 'Ene, zerbaitek huts egin du',
    proximamente: 'Laster...', prep_series: 'Telesailen katalogo osoa prestatzen ari gara plataforman integratzeko. Itzuli laster!',
    acceso_premium: 'Premium Sarbidea', pass_directo: 'Autentifikazioa Beharrezkoa',
    desc_directo: 'Zuzenekoa babestuta dago. Egiaztatu Discord zerbitzarian beharrezko rola duzula sartzeko.',
    verificando: 'Egiaztatzen...', refrescar_pass: 'Saioa Freskatu', verificar_rol: 'Nire Rola Discord-en Egiaztatu',
    vacio: 'Hutsik', sin_pass: 'Pasahitzik Ez', serv_patreon: 'Premium (Patreon)', serv_normal: 'Normala (Publikoa)',
    acceso_concedido: 'VIP Sarbidea Baimenduta',
    credenciales_inyectadas: 'Zure kredentzialak automatikoki txertatu dira erreproduzitzailean. Gozatu zuzenekoaz!',
    selecciona_servidor: 'Hautatu zure Zerbitzaria',
    servidor_no_disp: 'Premium Zerbitzaria ez dago erabilgarri zure uneko rolarekin.',
    panel_servidor: 'Kontrol Panela'
  }
};

// EXTRACCIÓN DEL IDENTIFIER (Funciona a la perfección)
const extractIdentifier = (sid) => {
  if (!sid) return null;
  let str = sid;
  if (str.startsWith('s%3A')) str = decodeURIComponent(str);
  if (str.startsWith('s:')) return str.substring(2).split('.')[0];
  if (str.startsWith('ey')) {
      try {
          const decoded = JSON.parse(atob(str.split('.')[1]));
          return decoded.id || decoded.userId || decoded.sub || str;
      } catch (e) { return str; }
  }
  return str;
};

// --- COMPONENTE REPRODUCTOR NATIVO HLS ---
const NativeStreamPlayer = ({ streamSid, streamPassword, channel, usePatreon, t }) => {
    const containerRef = useRef(null);
    const playerInstanceRef = useRef(null);
    const hlsInstanceRef = useRef(null);
    
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('Autenticando...');

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

                const payload = {
                    channel: channel,
                    patreon: usePatreon
                };
                
                // ¡AQUÍ ESTÁ LA MAGIA! Tu angelthump.js necesita recibir la cabecera 'identifier'
                const requestHeaders = { 
                    'Content-Type': 'application/json' 
                };
                
                if (usePatreon && cleanSid) {
                    payload.sid = cleanSid;
                    if (identifier) {
                        payload.identifier = identifier;
                        requestHeaders['identifier'] = identifier; // INYECTADO COMO HEADER
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
                        if (isAvailable) resolve();
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
                if (!videoEl) throw new Error("No se pudo inyectar el elemento de vídeo de forma segura.");

                const plyrOptions = {
                    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'airplay', 'cast', 'fullscreen'],
                    settings: ['quality'],
                    autoplay: true,
                    cast: { enabled: true } 
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
                        videoEl.play().catch(e => console.log("Clic requerido para auto-play con audio."));
                    });

                    hls.on(window.Hls.Events.ERROR, (event, data) => {
                        if (data.fatal) {
                            if (!isMounted) return;
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
};

// --- UTILIDADES ---
const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"') { current += '"'; i++; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { row.push(current); current = ''; }
    else if (char === '\n' && !inQuotes) { row.push(current); rows.push(row); row = []; current = ''; }
    else if (char !== '\r') { current += char; }
  }
  if (current !== '' || text[text.length - 1] === ',') row.push(current);
  if (row.length > 0) rows.push(row);
  return rows;
};

const formatVideoQuality = (raw) => {
  if (!raw) return 'SD';
  const s = raw.toLowerCase();
  if (s.includes('2160') || s.includes('4k')) return '4K';
  if (s.includes('1080') || s.includes('fhd')) return 'FHD';
  if (s.includes('720') || s.includes('hd')) return 'HD';
  return 'SD';
};

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// --- COMPONENTE IMAGEN LAZY ---
const LazyImage = ({ src, alt, className, eager = false }) => {
  const [isVisible, setIsVisible] = useState(eager);
  const imgRef = useRef(null);

  useEffect(() => {
    if (eager) return; 

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" } 
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => { if (observer) observer.disconnect(); };
  }, [eager]);

  return (
    <div ref={imgRef} className={`w-full h-full bg-neutral-900 ${!isVisible ? 'animate-pulse' : ''}`}>
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${eager ? '' : 'transition-opacity duration-500 opacity-0'}`}
          onLoad={(e) => { if (!eager) e.target.classList.remove('opacity-0'); }}
          loading={eager ? "eager" : "lazy"}
        />
      )}
    </div>
  );
};

// --- COMPONENTE FILA DE PLEX INTELIGENTE ---
const MovieRow = ({ title, items, onSelect, onCategoryClick, onTitleClick, icon, isModal = false, eager = false, t }) => {
  const rowRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(eager); 
  const [showArrows, setShowArrows] = useState(false);
  
  useEffect(() => {
    if (eager) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { if (observer) observer.disconnect(); };
  }, [eager]);

  useEffect(() => {
    const checkArrows = () => {
      if (rowRef.current) {
        setShowArrows(rowRef.current.scrollWidth > rowRef.current.clientWidth + 10);
      }
    };

    if (isVisible) {
      checkArrows();
      window.addEventListener('resize', checkArrows);
      const timer = setTimeout(checkArrows, 100); 
      return () => {
        window.removeEventListener('resize', checkArrows);
        clearTimeout(timer);
      };
    }
  }, [isVisible, items]);

  const scroll = (direction) => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth + 100 : scrollLeft + clientWidth - 100;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  const MAX_NORMAL = 11;
  const SMART_LIMIT = 15; 
  
  let displayItems, hasMore;

  if (isModal) {
    displayItems = items.slice(0, 15);
    hasMore = false;
  } else {
    if (items.length <= SMART_LIMIT) {
       displayItems = items;
       hasMore = false;
    } else {
       displayItems = items.slice(0, MAX_NORMAL);
       hasMore = true;
    }
  }

  const cardWidthClasses = isModal 
    ? "w-24 sm:w-28 md:w-32 lg:w-36 xl:w-40" 
    : "w-28 sm:w-36 md:w-40 lg:w-48 xl:w-52 2xl:w-56";

  return (
    <div ref={containerRef} className={`${isModal ? 'mb-4' : 'mb-6 md:mb-10'} relative group/row min-h-[180px]`}>
      <h3 
        onClick={() => {
          if (onTitleClick) onTitleClick();
          else if (!isModal) onCategoryClick({title, items, icon});
        }}
        className={`${isModal ? 'text-base md:text-xl px-2' : 'text-lg md:text-2xl px-4 md:px-12'} font-bold text-gray-100 mb-0 md:mb-1 flex items-center gap-2 ${(!isModal || onTitleClick) ? 'hover:text-[#e5a00d] cursor-pointer' : ''} transition-colors w-max`}
      >
        {icon && <span className="text-[#e5a00d] mr-1">{icon}</span>}
        {title} 
        {(!isModal || onTitleClick) && <ChevronRight size={24} className="text-[#e5a00d] opacity-0 group-hover/row:opacity-100 transition-opacity" />}
      </h3>
      
      {isVisible ? (
        <>
          {showArrows && (
            <button onClick={() => scroll('left')} className="absolute left-0 top-[50%] -translate-y-1/2 z-20 bg-black/80 hover:bg-[#e5a00d] text-white p-2 md:p-4 rounded-r-xl opacity-0 group-hover/row:opacity-100 transition-all hidden md:block backdrop-blur-md border-r border-y border-white/10">
              <ChevronLeft size={28} />
            </button>
          )}
          
          {showArrows && (
            <button onClick={() => scroll('right')} className="absolute right-0 top-[50%] -translate-y-1/2 z-20 bg-black/80 hover:bg-[#e5a00d] text-white p-2 md:p-4 rounded-l-xl opacity-0 group-hover/row:opacity-100 transition-all hidden md:block backdrop-blur-md border-l border-y border-white/10">
              <ChevronRight size={28} />
            </button>
          )}

          <div ref={rowRef} className={`flex overflow-x-auto gap-3 md:gap-6 pt-3 md:pt-6 ${isModal ? 'px-2 pb-2 scroll-pl-2' : 'px-4 md:px-12 pb-4 md:pb-6 scroll-pl-4 md:scroll-pl-12'} scrollbar-hide snap-x`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {displayItems.map((item) => (
              <div key={item.id} className={`snap-start shrink-0 ${cardWidthClasses} relative cursor-pointer group transition-all duration-300 flex flex-col`} onClick={() => onSelect(item)}>
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/5 bg-neutral-900 shadow-lg group-hover:scale-105 group-hover:border-[#e5a00d]/50 transition-all duration-300">
                  <LazyImage src={item.image} alt={item.displayTitle || item.title} className="w-full h-full object-cover group-hover:opacity-40" eager={eager} />
                  
                  <div className="absolute inset-0 p-2 md:p-4 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black via-transparent to-transparent">
                     <div className="flex flex-col gap-1 md:gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        <div className="flex items-center gap-1 flex-wrap">
                            {!item.isSaga && (
                              <span className={`backdrop-blur-md text-[9px] md:text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border ${item.videoQuality === '4K' ? 'bg-[#e5a00d]/90 text-black border-[#e5a00d]' : 'bg-white/20 text-white border-white/20'}`}>
                                  <Monitor size={10} /> {item.videoQuality}
                              </span>
                            )}
                            {!item.isSaga && item.rating && item.rating !== 'N/A' && item.rating !== '0.0' && (
                              <span className="backdrop-blur-md text-[9px] md:text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border bg-black/60 text-[#e5a00d] border-[#e5a00d]/50">
                                  <Star size={10} fill="currentColor" /> {item.rating}
                              </span>
                            )}
                        </div>
                     </div>
                  </div>
                </div>
                <h3 className={`mt-2 md:mt-3 ${isModal ? 'text-[11px] md:text-xs' : 'text-xs md:text-sm'} font-semibold text-gray-200 line-clamp-2 leading-normal pb-1 pr-1 group-hover:text-[#e5a00d] transition-colors`}>{item.displayTitle || item.title}</h3>
                {!item.isSaga && <div className="text-[10px] md:text-xs text-gray-500 font-medium">{item.year}</div>}
                {item.isSaga && <div className="text-[10px] md:text-xs text-[#e5a00d] font-medium tracking-wide">{t?.coleccion_oficial || 'COLECCIÓN'}</div>}
              </div>
            ))}

            {hasMore && (
              <div 
                className={`snap-start shrink-0 ${cardWidthClasses} relative cursor-pointer group transition-all duration-300 flex flex-col`} 
                onClick={() => onCategoryClick({title, items, icon})}
              >
                <div className="relative aspect-[2/3] w-full rounded-lg border border-white/10 bg-neutral-900/40 hover:bg-neutral-800 transition-all duration-300 flex flex-col items-center justify-center gap-2 md:gap-3 text-gray-400 hover:text-[#e5a00d] shadow-lg">
                   <div className="p-3 md:p-4 rounded-full bg-black/40 group-hover:scale-110 transition-transform">
                     <Grid size={28} className="md:w-8 md:h-8" />
                   </div>
                   <span className="font-bold text-xs md:text-sm text-center px-2">{t?.ver_todos || 'Ver todos'} ({items.length})</span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={`flex gap-3 md:gap-6 pt-3 md:pt-6 ${isModal ? 'px-2' : 'px-4 md:px-12'} overflow-hidden`}>
           {[...Array(6)].map((_, i) => (
             <div key={i} className={`shrink-0 ${cardWidthClasses} aspect-[2/3] bg-neutral-900/40 rounded-lg animate-pulse`}></div>
           ))}
        </div>
      )}
    </div>
  );
};

// Obtenemos los parámetros iniciales de forma segura antes de montar
const getInitialURLParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
        tab: params.get('tab') || (params.get('code') ? 'directos' : 'inicio'),
        q: params.get('q') || '',
        v: params.get('v') || null,
        cat: params.get('cat') || null,
        code: params.get('code') || null,
        refresh: params.get('refresh') === 'true'
    };
};

let isFetchingDiscord = false;

export default function App() {
  const initParams = useMemo(getInitialURLParams, []);

  // ESTADOS DEL IDIOMA
  const [appLang, setAppLang] = useState(localStorage.getItem('elpepestreams_lang') || 'es');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef(null);
  const t = UI_TRANSLATIONS[appLang] || UI_TRANSLATIONS['es'];

  // Clicar fuera para cerrar el menú de idiomas
  useEffect(() => {
    const handleClickOutside = (event) => {
        if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
            setIsLangMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ESTADOS DE LA BASE DE DATOS
  const [items, setItems] = useState([]);
  const [sagas, setSagas] = useState([]);
  
  // ESTADOS DE NAVEGACIÓN
  const [activeTab, setActiveTab] = useState(initParams.tab); 
  const [searchQuery, setSearchQuery] = useState(initParams.q);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // ESTADOS DE CARGA
  const [dataFetched, setDataFetched] = useState(false);
  const [loading, setLoading] = useState(initParams.tab === 'inicio' || initParams.tab === 'pelis');
  const [error, setError] = useState(null);
  const [heroItem, setHeroItem] = useState(null);
  const hasFetchedRef = useRef(false);
  
  const initialVRef = useRef(initParams.v);
  const initialCatRef = useRef(initParams.cat);

  const [isScrolled, setIsScrolled] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); 

  // ESTADOS DE REPRODUCTOR
  const [streamPassword, setStreamPassword] = useState("••••••••••••");
  const [streamSid, setStreamSid] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [usePatreon, setUsePatreon] = useState(false); 
  
  const [visibleCount, setVisibleCount] = useState(100);
  const [sortBy, setSortBy] = useState('default');
  const [filterGenres, setFilterGenres] = useState([]);
  const [filterQualities, setFilterQualities] = useState([]);
  const [filterLanguages, setFilterLanguages] = useState([]);
  const [filterYears, setFilterYears] = useState([]);

  useEffect(() => {
    document.title = "ElPepeStreams";
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍿</text></svg>";
    
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- CAMBIO DE IDIOMA ---
  useEffect(() => {
     localStorage.setItem('elpepestreams_lang', appLang);
     setSelectedCategory(null);
     if (hasFetchedRef.current && (activeTab === 'inicio' || activeTab === 'pelis')) {
        setLoading(true);
        fetchContent(appLang);
     }
  }, [appLang]);

  // --- SINCRONIZADOR DE URL ---
  useEffect(() => {
    const url = new URL(window.location);
    let changed = false;

    if (url.searchParams.has('code')) {
        url.searchParams.delete('code');
        changed = true;
    }
    if (url.searchParams.has('refresh')) {
        url.searchParams.delete('refresh');
        changed = true;
    }

    const currentTab = url.searchParams.get('tab');
    if (activeTab === 'inicio') {
        if (currentTab) { url.searchParams.delete('tab'); changed = true; }
    } else {
        if (currentTab !== activeTab) { url.searchParams.set('tab', activeTab); changed = true; }
    }

    const currentQ = url.searchParams.get('q');
    if (searchQuery) {
        if (currentQ !== searchQuery) { url.searchParams.set('q', searchQuery); changed = true; }
    } else {
        if (currentQ) { url.searchParams.delete('q'); changed = true; }
    }

    const currentV = url.searchParams.get('v');
    if (selectedItem) {
        if (currentV !== selectedItem.id) { url.searchParams.set('v', selectedItem.id); changed = true; }
    } else {
        if (currentV) { url.searchParams.delete('v'); changed = true; }
    }

    const currentCat = url.searchParams.get('cat');
    if (selectedCategory) {
        if (currentCat !== selectedCategory.title) { url.searchParams.set('cat', selectedCategory.title); changed = true; }
    } else {
        if (currentCat) { url.searchParams.delete('cat'); changed = true; }
    }

    if (changed) {
        window.history.replaceState({}, '', url);
    }
  }, [activeTab, selectedItem, searchQuery, selectedCategory]);

  // --- MOTOR DE AUTENTICACIÓN MEJORADO ---
  useEffect(() => {
    const savedPassword = sessionStorage.getItem('stream_password');
    const savedSid = sessionStorage.getItem('stream_sid');
    const authTime = sessionStorage.getItem('stream_auth_time');

    const CACHE_LIFETIME = 12 * 60 * 60 * 1000;
    const isCacheValid = authTime && (Date.now() - parseInt(authTime) < CACHE_LIFETIME);

    if (savedPassword && isCacheValid) {
        setStreamPassword(savedPassword);
        if (savedSid) {
            setStreamSid(savedSid);
            setUsePatreon(true); 
        } else {
            setUsePatreon(false);
        }
    } else {
        sessionStorage.removeItem('stream_password');
        sessionStorage.removeItem('stream_sid');
        sessionStorage.removeItem('stream_auth_time');
    }

    const code = initParams.code;
    
    if (code) {
        if (isFetchingDiscord) return;
        isFetchingDiscord = true;

        setIsVerifying(true);
        setStreamPassword(t.verificando);
        
        fetch(`${API_BASE}/verificar?code=${code}`)
            .then(async res => {
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`HTTP ${res.status}: ${text}`);
                }
                return res.json();
            })
            .then(data => {
                if(data.success) {
                    if (!data.password || data.password.trim() === "") {
                        setStreamPassword("❌ Activa 'Message Content Intent' en el Bot");
                    } else {
                        let cleanText = data.password.replace(/[*`]/g, '').trim();
                        cleanText = cleanText.replace(/^['"]|['"]$/g, '').trim();
                        
                        let finalPass = "";
                        let finalSid = null;

                        const lines = cleanText.split('\n');
                        for (const line of lines) {
                            const lowerLine = line.toLowerCase();
                            if (lowerLine.includes('contraseña:') || lowerLine.includes('contrasena:')) {
                                finalPass = line.substring(lowerLine.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '');
                            } else if (lowerLine.includes('cookie:')) {
                                let rawSid = line.substring(lowerLine.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '');
                                if (rawSid.includes('angelthump.sid=')) {
                                    rawSid = rawSid.split('angelthump.sid=')[1].trim();
                                }
                                if (rawSid) rawSid = rawSid.split(';')[0].trim(); // LIMPIEZA EXTRA DE SEMICOLONS
                                finalSid = rawSid;
                            }
                        }

                        if (!finalPass && !finalSid) {
                            if (cleanText.includes('|')) {
                                const parts = cleanText.split('|');
                                finalPass = parts[0].trim().replace(/^['"]|['"]$/g, '');
                                let rawSid = parts[1] ? parts[1].trim().replace(/^['"]|['"]$/g, '') : null;
                                if (rawSid && rawSid.includes('angelthump.sid=')) {
                                    rawSid = rawSid.split('angelthump.sid=')[1].trim();
                                }
                                if (rawSid) rawSid = rawSid.split(';')[0].trim(); // LIMPIEZA EXTRA DE SEMICOLONS
                                finalSid = rawSid;
                            } else {
                                finalPass = cleanText.replace(/Contrase.*?:/i, '').trim().replace(/^['"]|['"]$/g, '');
                            }
                        }

                        setStreamPassword(finalPass || t.sin_pass);
                        sessionStorage.setItem('stream_password', finalPass || t.sin_pass);
                        sessionStorage.setItem('stream_auth_time', Date.now().toString());
                        
                        if (finalSid) {
                            setStreamSid(finalSid);
                            sessionStorage.setItem('stream_sid', finalSid);
                            setUsePatreon(true);
                        } else {
                            setStreamSid(null);
                            sessionStorage.removeItem('stream_sid');
                            setUsePatreon(false);
                        }
                    }
                } else {
                    setStreamPassword("❌ " + (data.error || "Rol Denegado"));
                }
            })
            .catch(err => {
                console.error("Detalle técnico:", err);
                setStreamPassword("❌ Error Backend: " + err.message);
            })
            .finally(() => {
                setIsVerifying(false);
                isFetchingDiscord = false;
            });
    }
  }, [initParams.code, t.verificando, t.sin_pass]);

  useEffect(() => {
      if (activeTab === 'directos' && !isVerifying) {
          const authTime = sessionStorage.getItem('stream_auth_time');
          const CACHE_LIFETIME = 12 * 60 * 60 * 1000;
          if (authTime && (Date.now() - parseInt(authTime) > CACHE_LIFETIME)) {
              sessionStorage.removeItem('stream_password');
              sessionStorage.removeItem('stream_sid');
              sessionStorage.removeItem('stream_auth_time');
              setStreamPassword("••••••••••••");
              setStreamSid(null);
              setUsePatreon(false);
          }
      }
  }, [activeTab, isVerifying]);

  const translateLangs = (str, targetLang) => {
    if (!str || str === 'N/A') return 'N/A';
    return str.split(/[,/-]/).map(l => {
      const clean = l.trim().toLowerCase();
      const baseEs = LANGUAGE_MAP[clean] || l.trim();
      return LANG_TRANSLATIONS[targetLang]?.[baseEs] || baseEs;
    }).join(', ');
  };

  const fetchTMDB = async (title, year, langToFetch) => {
    try {
      let cleanTitle = title.replace(/\[.*?\]/g, ' ').replace(/\(.*?\)/g, ' ').replace(/[\[\]\(\)]/g, '').replace(/!/g, '').replace(/\s1$/, '').trim();
      const query = encodeURIComponent(cleanTitle);
      const cleanYear = year ? year.toString().match(/\d{4}/)?.[0] : '';
      
      const tmdbLangMap = { 'es': 'es-ES', 'ca': 'ca-ES', 'gl': 'gl-ES', 'eu': 'eu-ES' };
      const apiLang = tmdbLangMap[langToFetch] || 'es-ES';

      let searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${query}&language=es-ES&primary_release_year=${cleanYear || ''}`);
      let data = await searchRes.json();
      
      if ((!data.results || data.results.length === 0) && cleanYear) {
         searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${query}&language=es-ES`);
         data = await searchRes.json();
      }
      if ((!data.results || data.results.length === 0) && cleanTitle.match(/[:\-]/)) {
         const shortTitle = cleanTitle.split(/[:\-]/)[0].trim();
         searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(shortTitle)}&language=es-ES&primary_release_year=${cleanYear || ''}`);
         data = await searchRes.json();
      }
      
      if (data.results?.[0]) {
        const tmdbId = data.results[0].id;
        
        let detailRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=${apiLang}`);
        let movie = await detailRes.json();

        let fallbackRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-ES`);
        let movieEs = await fallbackRes.json();

        if (!movie.overview && langToFetch !== 'es') {
             movie.overview = movieEs.overview;
             movie.title = movieEs.title;
             movie.poster_path = movieEs.poster_path;
             movie.backdrop_path = movieEs.backdrop_path;
        } else {
             if (!movie.poster_path) movie.poster_path = movieEs.poster_path;
             if (!movie.backdrop_path) movie.backdrop_path = movieEs.backdrop_path;
        }

        const rawGenres = movie.genres?.length > 0 ? movie.genres : movieEs.genres;
        const translatedGenres = rawGenres?.map(g => {
            return GENRE_TRANSLATIONS[g.name]?.[langToFetch] || GENRE_TRANSLATIONS[g.name]?.['es'] || g.name;
        }) || [];
        
        return {
          tmdbTitle: movie.title, 
          overview: movie.overview,
          poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          year: movie.release_date?.split('-')[0],
          genres: translatedGenres,
          collection: movie.belongs_to_collection ? { id: movie.belongs_to_collection.id, name: movie.belongs_to_collection.name, poster: movie.belongs_to_collection.poster_path ? `https://image.tmdb.org/t/p/w500${movie.belongs_to_collection.poster_path}` : null, backdrop: movie.belongs_to_collection.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.belongs_to_collection.backdrop_path}` : null } : null,
          rating: movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'
        };
      }
    } catch (e) { console.warn("TMDB Error:", e); }
    return null;
  };

  const fetchContent = async (currentLang) => {
    try {
      const forceRefresh = initParams.refresh;

      const cacheKeyName = `plex_library_full_cache_${currentLang}`;
      const cachedRaw = localStorage.getItem(cacheKeyName);
      let existingItemsMap = new Map();
      if (cachedRaw && !forceRefresh) {
          try {
              const parsed = JSON.parse(cachedRaw);
              const isExpired = !parsed.timestamp || (Date.now() - parsed.timestamp > CACHE_TTL);
              if (parsed.version === CACHE_VERSION && !isExpired && parsed.items) {
                  parsed.items.forEach(i => existingItemsMap.set(`${i.title.toLowerCase()}_${i.year}`, i));
              }
          } catch(e) {}
      }

      const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`);
      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      
      const headerRowIdx = parsedData.findIndex(row => row.some(c => typeof c === 'string' && (c.toLowerCase().includes('título') || c.toLowerCase().includes('title'))));
      const validHeaderIdx = headerRowIdx !== -1 ? headerRowIdx : 0;
      
      const headers = parsedData[validHeaderIdx].map(h => (h || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
      
      const idxTitle = getIdx(['titulo', 'title']);
      const idxYear = getIdx(['ano', 'year', 'año']);
      const idxLang = getIdx(['idioma', 'lenguaje']);
      const idxQual = getIdx(['calidad']);
      const idxGen  = getIdx(['genero', 'género']);
      
      let idxLink = getIdx(['lnkf']);
      if (idxLink === -1) {
          idxLink = getIdx(['link final', 'url final', 'descarga']);
      }

      const rawRows = parsedData.slice(validHeaderIdx + 1).filter(r => r[idxTitle]);
      const chunkSize = 25; 
      const enriched = [];
      const translatedNoDesc = UI_TRANSLATIONS[currentLang].sin_descripcion;
      
      for (let i = 0; i < rawRows.length; i += chunkSize) {
        const chunk = rawRows.slice(i, i + chunkSize);
        const chunkEnriched = await Promise.all(chunk.map(async (row, idx) => {
          const title = row[idxTitle];
          const year = row[idxYear] || '?';
          const cacheKey = `${title.toLowerCase()}_${year}`;
          
          let rawLink = '';
          if (idxLink !== -1 && row[idxLink] && typeof row[idxLink] === 'string' && row[idxLink].trim().includes('http')) {
              rawLink = row[idxLink]; 
          } else {
              const cellHttp = [...row].reverse().find(c => c && typeof c === 'string' && (c.trim().includes('http') || c.trim().includes('www.')));
              if (cellHttp) rawLink = cellHttp;
          }
          
          let finalLink = rawLink.trim();
          if (!finalLink || finalLink.toLowerCase() === 'link' || finalLink.toLowerCase() === 'lnkf') finalLink = '#';
          else if (finalLink !== '#' && !finalLink.startsWith('http')) finalLink = 'https://' + finalLink;

          const newQuality = formatVideoQuality(idxQual !== -1 ? row[idxQual] : '');
          const newLang = idxLang !== -1 ? translateLangs(row[idxLang], currentLang) : 'N/A';
          const newGenresCsv = (idxGen !== -1 && row[idxGen]) ? [GENRE_TRANSLATIONS[row[idxGen]]?.[currentLang] || row[idxGen]] : [GENRE_TRANSLATIONS['Otros']?.[currentLang] || "Otros"];

          if (existingItemsMap.has(cacheKey)) {
              const cachedItem = existingItemsMap.get(cacheKey);
              return {
                  ...cachedItem,
                  id: `item-${i + idx}`,
                  videoQuality: newQuality,
                  language: newLang,
                  link: finalLink
              };
          }

          const tmdb = await fetchTMDB(title, year, currentLang);
          
          return {
            id: `item-${i + idx}`,
            isSaga: false,
            title: title, 
            displayTitle: tmdb?.tmdbTitle || title, 
            year: tmdb?.year || year,
            description: tmdb?.overview || translatedNoDesc,
            image: tmdb?.poster || `https://via.placeholder.com/500x750/1a1a1c/e5a00d?text=${encodeURIComponent(title)}`,
            backdrop: tmdb?.backdrop || tmdb?.poster,
            videoQuality: newQuality,
            language: newLang,
            link: finalLink,
            genres: tmdb?.genres?.length ? tmdb.genres : newGenresCsv,
            collection: tmdb?.collection || null,
            rating: tmdb?.rating || 'N/A'
          };
        }));
        enriched.push(...chunkEnriched);
      }

      const sagaMap = new Map();
      enriched.forEach(item => {
          if (item.collection) {
              if (!sagaMap.has(item.collection.id)) {
                  sagaMap.set(item.collection.id, {
                      isSaga: true,
                      id: `saga-${item.collection.id}`,
                      title: item.collection.name,
                      displayTitle: item.collection.name,
                      image: item.collection.poster || item.image,
                      backdrop: item.collection.backdrop || item.backdrop,
                      movies: [],
                      genres: item.genres 
                  });
              }
              sagaMap.get(item.collection.id).movies.push(item);
          }
      });
      
      const sagasArray = Array.from(sagaMap.values());
      sagasArray.forEach(saga => {
          saga.movies.sort((a, b) => parseInt(a.year || 0) - parseInt(b.year || 0));
      });

      setItems(enriched);
      setSagas(sagasArray);
      
      setHeroItem(prev => {
          if (prev) {
              const updatedHero = enriched.find(i => i.id === prev.id);
              if (updatedHero) return updatedHero;
          }
          const topMovies = enriched.filter(m => parseFloat(m.rating) > 7.0);
          const pool = topMovies.length > 0 ? topMovies : enriched;
          return pool[Math.floor(Math.random() * pool.length)];
      });

      setDataFetched(true);
      setLoading(false);

      try {
          localStorage.setItem(cacheKeyName, JSON.stringify({ version: CACHE_VERSION, timestamp: Date.now(), items: enriched, sagas: sagasArray }));
      } catch (e) {
          localStorage.removeItem(cacheKeyName); 
          try { localStorage.setItem(cacheKeyName, JSON.stringify({ version: CACHE_VERSION, timestamp: Date.now(), items: enriched, sagas: sagasArray })); } catch(e2){}
      }

      if (initialVRef.current) {
          const v = initialVRef.current;
          const foundSaga = sagasArray.find(s => s.id === v);
          const foundItem = enriched.find(i => i.id === v);
          if (foundSaga) setSelectedItem(foundSaga);
          else if (foundItem) setSelectedItem(foundItem);
          initialVRef.current = null;
      }
      
    } catch (err) { setError(err.message); setLoading(false); }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    
    if (activeTab === 'inicio' || activeTab === 'pelis') {
        hasFetchedRef.current = true;

        const forceRefresh = initParams.refresh;

        const cachedRaw = localStorage.getItem(`plex_library_full_cache_${appLang}`);
        if (cachedRaw && !forceRefresh) {
            try {
                const parsed = JSON.parse(cachedRaw);
                const isExpired = !parsed.timestamp || (Date.now() - parsed.timestamp > CACHE_TTL);
                if (parsed.version === CACHE_VERSION && !isExpired && parsed.items && parsed.items.length > 0) {
                    setItems(parsed.items);
                    setSagas(parsed.sagas || []);
                    setDataFetched(true);
                    setLoading(false);
                    
                    setHeroItem(prev => {
                        if (prev) {
                            const updatedHero = parsed.items.find(i => i.id === prev.id);
                            if (updatedHero) return updatedHero;
                        }
                        const topMovies = parsed.items.filter(m => parseFloat(m.rating) > 7.0);
                        const pool = topMovies.length > 0 ? topMovies : parsed.items;
                        return pool[Math.floor(Math.random() * pool.length)];
                    });
                } else {
                    setLoading(true);
                }
            } catch(e) { setLoading(true); }
        } else {
            setLoading(true);
        }

        fetchContent(appLang);
    }
  }, [activeTab]);

  useEffect(() => {
     setVisibleCount(100);
     setSortBy('default');
     setFilterGenres([]);
     setFilterQualities([]);
     setFilterLanguages([]);
     setFilterYears([]);
     if (searchQuery && dataFetched) {
         setSelectedCategory(null);
         window.scrollTo({ top: 0, behavior: 'smooth' });
     }
  }, [searchQuery, dataFetched]);

  useEffect(() => {
     setVisibleCount(100);
     setSortBy('default');
     setFilterGenres([]);
     setFilterQualities([]);
     setFilterLanguages([]);
     setFilterYears([]);
     if (selectedCategory && dataFetched) {
         window.scrollTo({ top: 0, behavior: 'smooth' });
     }
  }, [selectedCategory, dataFetched]);

  const categories = useMemo(() => {
    if (searchQuery || items.length === 0) return [];
    
    let cats = [];
    cats.push({ title: t.recomendados, items: shuffleArray(items).slice(0, 30), icon: <Star size={22}/> });

    const topRated = [...items].sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0)).slice(0, 100);
    cats.push({ title: t.mejor_valoradas, items: topRated, icon: null });

    const currentYear = new Date().getFullYear();
    const recentReleases = [...items].filter(i => parseInt(i.year) === currentYear || parseInt(i.year) === currentYear - 1).sort((a, b) => parseInt(b.year) - parseInt(a.year));
    if (recentReleases.length > 0) {
        cats.push({ title: t.ultimos, items: recentReleases, icon: <Film size={22}/> });
    }

    if (sagas.length > 0) {
        cats.push({ title: t.sagas, items: shuffleArray(sagas), icon: <Layers size={22}/> });
    }

    const allGenres = [...new Set(items.flatMap(i => i.genres))].sort();
    let genreCats = [];
    allGenres.forEach(g => {
      const filtered = items.filter(i => i.genres.includes(g));
      if (filtered.length > 2) genreCats.push({ title: g, items: shuffleArray(filtered), icon: null });
    });

    genreCats = shuffleArray(genreCats);

    return [...cats, ...genreCats];
  }, [items, sagas, searchQuery, t]);

  useEffect(() => {
      if (categories.length > 0 && initialCatRef.current) {
          const foundCat = categories.find(c => c.title === initialCatRef.current);
          if (foundCat) setSelectedCategory(foundCat);
          initialCatRef.current = null;
      }
  }, [categories]);

  const rawDisplayItems = searchQuery 
    ? items.filter(i => 
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (i.displayTitle && i.displayTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        i.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (selectedCategory ? selectedCategory.items : []);

  const availableGenres = useMemo(() => {
    const genres = new Set();
    rawDisplayItems.forEach(i => { if(i.genres) i.genres.forEach(g => genres.add(g)); });
    return Array.from(genres).sort();
  }, [rawDisplayItems]);

  const availableQualities = useMemo(() => {
    const qualities = new Set();
    rawDisplayItems.forEach(i => { if(i.videoQuality && i.videoQuality !== 'N/A') qualities.add(i.videoQuality); });
    return Array.from(qualities).sort((a, b) => b.localeCompare(a));
  }, [rawDisplayItems]);

  const availableLanguages = useMemo(() => {
    const languages = new Set();
    rawDisplayItems.forEach(i => {
      if(i.language && i.language !== 'N/A') {
         i.language.split(',').forEach(l => languages.add(l.trim()));
      }
    });
    return Array.from(languages).sort();
  }, [rawDisplayItems]);

  const availableYears = useMemo(() => {
    const years = new Set();
    rawDisplayItems.forEach(i => { if(i.year && i.year !== '?' && i.year !== 'N/A') years.add(i.year.toString()); });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [rawDisplayItems]);

  const processedDisplayItems = useMemo(() => {
    let result = [...rawDisplayItems];
    
    if (filterGenres.length > 0) result = result.filter(i => i.genres?.some(g => filterGenres.includes(g)));
    if (filterQualities.length > 0) result = result.filter(i => filterQualities.includes(i.videoQuality));
    if (filterLanguages.length > 0) result = result.filter(i => {
         if (!i.language) return false;
         const itemLangs = i.language.split(',').map(l => l.trim());
         return itemLangs.some(l => filterLanguages.includes(l));
    });
    if (filterYears.length > 0) result = result.filter(i => filterYears.includes(i.year?.toString()));

    if (sortBy === 'az') result.sort((a, b) => (a.displayTitle || a.title).localeCompare(b.displayTitle || b.title));
    else if (sortBy === 'za') result.sort((a, b) => (b.displayTitle || b.title).localeCompare(a.displayTitle || a.title));
    else if (sortBy === 'rating') result.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
    else if (sortBy === 'year') result.sort((a, b) => parseInt(b.year || 0) - parseInt(a.year || 0));

    return result;
  }, [rawDisplayItems, filterGenres, filterQualities, filterLanguages, filterYears, sortBy]);

  const paginatedItems = processedDisplayItems.slice(0, visibleCount);

  const sagaItems = useMemo(() => {
     if (!selectedItem || selectedItem.isSaga || !selectedItem.collection) return [];
     return items.filter(i => !i.isSaga && i.collection?.id === selectedItem.collection.id && i.id !== selectedItem.id);
  }, [selectedItem, items]);

  const renderGridOrList = (arrayToRender) => {
    if (arrayToRender.length === 0) return <div className="text-gray-500 font-medium py-10 text-center w-full">No se encontraron resultados para estos filtros.</div>;

    if (viewMode === 'list') {
      return (
        <div className="flex flex-col gap-3 md:gap-4 w-full">
          {arrayToRender.map(item => (
            <div key={item.id} className="group cursor-pointer flex gap-4 md:gap-6 bg-neutral-900/30 hover:bg-neutral-800/60 border border-white/5 rounded-xl p-3 md:p-4 transition-all" onClick={() => setSelectedItem(item)}>
               <div className="w-20 md:w-28 shrink-0 aspect-[2/3] rounded-lg overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                 <LazyImage src={item.image} alt={item.displayTitle || item.title} className="w-full h-full object-cover" />
               </div>
               <div className="flex flex-col justify-center flex-1">
                 <h4 className="font-bold text-sm md:text-xl text-white mb-1 md:mb-2 group-hover:text-[#e5a00d] transition-colors">{item.displayTitle || item.title}</h4>
                 {!item.isSaga && (
                   <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm text-gray-400 mb-2 md:mb-3">
                     <span className="font-bold text-white">{item.year}</span>
                     {item.rating && item.rating !== 'N/A' && <span className="flex items-center gap-1 text-[#e5a00d]"><Star size={12} fill="currentColor"/> {item.rating}</span>}
                     {item.videoQuality && <span className="border border-gray-600 px-1.5 py-0.5 rounded text-[10px] md:text-xs">{item.videoQuality}</span>}
                     <span className="hidden sm:inline">•</span>
                     <span className="hidden sm:inline">{item.genres.join(', ')}</span>
                   </div>
                 )}
                 {item.isSaga && <div className="text-xs md:text-sm text-[#e5a00d] font-bold tracking-widest mb-2 uppercase">{t.coleccion_oficial}</div>}
                 <p className="text-xs md:text-sm text-gray-500 line-clamp-2 md:line-clamp-3">{item.description}</p>
               </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-6">
        {arrayToRender.map(item => (
          <div key={item.id} className="group cursor-pointer flex flex-col" onClick={() => setSelectedItem(item)}>
            <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-neutral-900 group-hover:scale-105 transition-transform duration-300 shadow-xl">
              <LazyImage src={item.image} alt={item.displayTitle || item.title} className="w-full h-full object-cover" />
            </div>
            <h4 className="mt-2 md:mt-3 font-bold text-[11px] md:text-sm line-clamp-2 leading-normal pb-1 pr-1 group-hover:text-[#e5a00d] transition-colors">{item.displayTitle || item.title}</h4>
          </div>
        ))}
      </div>
    );
  };

  const renderFiltersAndSorting = () => {
    const hasActiveFilters = filterGenres.length > 0 || filterQualities.length > 0 || filterLanguages.length > 0 || filterYears.length > 0;

    return (
      <div className="flex flex-col gap-3 md:gap-4 w-full lg:w-auto mt-4 md:mt-0">
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full">
          
          <div className="relative flex-1 min-w-[130px] lg:flex-none">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <select 
              value="default" 
              onChange={e => { if (e.target.value !== 'default' && !filterGenres.includes(e.target.value)) setFilterGenres([...filterGenres, e.target.value]); }} 
              className="appearance-none bg-neutral-900 border border-white/20 text-xs md:text-sm rounded-lg pl-8 pr-3 py-2 md:py-2.5 text-white outline-none focus:border-[#e5a00d] w-full cursor-pointer truncate"
            >
              <option value="default" disabled>{t.filtro_genero}</option>
              {availableGenres.filter(g => !filterGenres.includes(g)).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="relative flex-1 min-w-[110px] lg:flex-none">
            <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <select 
              value="default" 
              onChange={e => { if (e.target.value !== 'default' && !filterQualities.includes(e.target.value)) setFilterQualities([...filterQualities, e.target.value]); }} 
              className="appearance-none bg-neutral-900 border border-white/20 text-xs md:text-sm rounded-lg pl-8 pr-3 py-2 md:py-2.5 text-white outline-none focus:border-[#e5a00d] w-full cursor-pointer truncate"
            >
              <option value="default" disabled>{t.filtro_calidad}</option>
              {availableQualities.filter(q => !filterQualities.includes(q)).map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>

          <div className="relative flex-1 min-w-[120px] lg:flex-none">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <select 
              value="default" 
              onChange={e => { if (e.target.value !== 'default' && !filterLanguages.includes(e.target.value)) setFilterLanguages([...filterLanguages, e.target.value]); }} 
              className="appearance-none bg-neutral-900 border border-white/20 text-xs md:text-sm rounded-lg pl-8 pr-3 py-2 md:py-2.5 text-white outline-none focus:border-[#e5a00d] w-full cursor-pointer truncate"
            >
              <option value="default" disabled>{t.filtro_idioma}</option>
              {availableLanguages.filter(l => !filterLanguages.includes(l)).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="relative flex-1 min-w-[100px] lg:flex-none">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <select 
              value="default" 
              onChange={e => { if (e.target.value !== 'default' && !filterYears.includes(e.target.value)) setFilterYears([...filterYears, e.target.value]); }} 
              className="appearance-none bg-neutral-900 border border-white/20 text-xs md:text-sm rounded-lg pl-8 pr-3 py-2 md:py-2.5 text-white outline-none focus:border-[#e5a00d] w-full cursor-pointer truncate"
            >
              <option value="default" disabled>{t.filtro_ano}</option>
              {availableYears.filter(y => !filterYears.includes(y)).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="relative flex-1 min-w-[150px] lg:flex-none">
            <ArrowDownWideNarrow className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)} 
              className="appearance-none bg-neutral-900 border border-white/20 text-xs md:text-sm rounded-lg pl-8 pr-3 py-2 md:py-2.5 text-white outline-none focus:border-[#e5a00d] w-full cursor-pointer truncate"
            >
              <option value="default">{t.orden_defecto}</option>
              <option value="az">{t.orden_az}</option>
              <option value="za">{t.orden_za}</option>
              <option value="rating">{t.orden_rating}</option>
              <option value="year">{t.orden_year}</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 font-medium mr-1">Filtros:</span>
            {filterGenres.map(g => <span key={g} onClick={() => setFilterGenres(filterGenres.filter(x => x !== g))} className="bg-[#e5a00d]/10 text-[#e5a00d] border border-[#e5a00d]/30 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-colors">{g} <X size={12} /></span>)}
            {filterQualities.map(q => <span key={q} onClick={() => setFilterQualities(filterQualities.filter(x => x !== q))} className="bg-[#e5a00d]/10 text-[#e5a00d] border border-[#e5a00d]/30 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-colors">{q} <X size={12} /></span>)}
            {filterLanguages.map(l => <span key={l} onClick={() => setFilterLanguages(filterLanguages.filter(x => x !== l))} className="bg-[#e5a00d]/10 text-[#e5a00d] border border-[#e5a00d]/30 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-colors">{l} <X size={12} /></span>)}
            {filterYears.map(y => <span key={y} onClick={() => setFilterYears(filterYears.filter(x => x !== y))} className="bg-[#e5a00d]/10 text-[#e5a00d] border border-[#e5a00d]/30 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-colors">{y} <X size={12} /></span>)}
            <button onClick={() => { setFilterGenres([]); setFilterQualities([]); setFilterLanguages([]); setFilterYears([]); }} className="text-[11px] text-gray-400 hover:text-white underline ml-2 transition-colors">{t.limpiar}</button>
          </div>
        )}
      </div>
    );
  };

  const isLogged = streamPassword && !streamPassword.includes('❌') && !streamPassword.includes('••••') && !streamPassword.includes('Verificando') && !streamPassword.includes('Verificant') && !streamPassword.includes('Egiaztatzen');

  return (
    <div className={`bg-[#0f0f0f] text-gray-200 font-sans selection:bg-[#e5a00d] selection:text-black overflow-x-hidden ${activeTab === 'directos' ? 'min-h-screen pb-6' : 'min-h-screen pb-20'}`}>
      
      <style>{`
        /* FORZAR FONDO GLOBAL PARA QUE LA BARRA TRANSPARENTE NO QUEDE BLANCA */
        html, body { background-color: #0f0f0f; color: #fff; }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #e5a00d; }
        * { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.15) transparent; }
      `}</style>

      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-[#141414]/95 backdrop-blur-md shadow-2xl' : 'bg-gradient-to-b from-black/90 to-transparent'}`}>
        <div className="px-4 md:px-12 py-3 md:py-4 flex flex-col lg:flex-row items-center justify-between gap-3 md:gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-8 w-full lg:w-auto">
            <div className="flex items-center gap-1 text-[#e5a00d] font-black text-2xl md:text-3xl tracking-tighter cursor-pointer shrink-0" onClick={() => {setActiveTab('inicio'); setSearchQuery(""); setSelectedCategory(null);}}>
              <ChevronRight size={28} className="-mr-2 md:-mr-3" />
              <span>ElPepe<span className="text-white font-light">Streams</span></span>
            </div>

            <div className="flex items-center gap-3 md:gap-6 text-[11px] sm:text-xs md:text-sm font-bold tracking-wide overflow-x-auto w-full sm:w-auto scrollbar-hide justify-center sm:justify-start pb-1 sm:pb-0">
               <button onClick={() => {setActiveTab('inicio'); setSearchQuery(""); setSelectedCategory(null);}} className={`flex items-center gap-1.5 transition-colors whitespace-nowrap px-2 py-1 rounded-md ${activeTab === 'inicio' ? 'text-[#e5a00d] bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Home size={16} className="hidden sm:block"/> {t.inicio}</button>
               <button onClick={() => {setActiveTab('pelis'); setSearchQuery(""); setSelectedCategory(null);}} className={`flex items-center gap-1.5 transition-colors whitespace-nowrap px-2 py-1 rounded-md ${activeTab === 'pelis' ? 'text-[#e5a00d] bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Film size={16} className="hidden sm:block"/> {t.pelis}</button>
               <button onClick={() => {setActiveTab('series'); setSearchQuery(""); setSelectedCategory(null);}} className={`flex items-center gap-1.5 transition-colors whitespace-nowrap px-2 py-1 rounded-md ${activeTab === 'series' ? 'text-[#e5a00d] bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Tv size={16} className="hidden sm:block"/> {t.series}</button>
               <button onClick={() => {setActiveTab('directos'); setSearchQuery(""); setSelectedCategory(null);}} className={`flex items-center gap-1.5 transition-colors whitespace-nowrap px-2 py-1 rounded-md ${activeTab === 'directos' ? 'text-[#e5a00d] bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Radio size={16} className="hidden sm:block"/> {t.directos}</button>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
              {(activeTab === 'inicio' || activeTab === 'pelis') && (
                <div className="relative group w-full lg:w-64 shrink-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#e5a00d] transition-colors" size={16} />
                  <input type="text" placeholder={t.buscar} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-neutral-900/60 border border-white/10 rounded-full py-2.5 pl-10 md:pl-12 pr-4 md:pr-6 w-full focus:outline-none focus:border-[#e5a00d] focus:bg-black transition-all text-xs md:text-sm backdrop-blur-sm" />
                </div>
              )}
              
              <div className="relative group shrink-0 hidden sm:block" ref={langMenuRef}>
                 <div 
                    className={`bg-white/5 hover:bg-white/10 p-2.5 rounded-full border border-white/10 cursor-pointer transition-all flex items-center justify-center ${isLangMenuOpen ? 'bg-white/10 ring-1 ring-white/20' : ''}`}
                    onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                    title="Cambiar idioma"
                 >
                    <Globe size={18} className="text-gray-300 group-hover:text-white transition-colors" />
                 </div>
                 
                 {isLangMenuOpen && (
                    <div className="absolute right-0 mt-3 w-40 bg-[#141414] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                       {[
                          { code: 'es', label: 'Castellano' },
                          { code: 'ca', label: 'Català / Valencià' },
                          { code: 'gl', label: 'Galego' },
                          { code: 'eu', label: 'Euskara' }
                       ].map(lang => (
                          <button
                             key={lang.code}
                             onClick={() => { setAppLang(lang.code); setIsLangMenuOpen(false); }}
                             className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2 ${appLang === lang.code ? 'text-[#e5a00d] bg-[#e5a00d]/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                          >
                             {appLang === lang.code && <span className="w-1.5 h-1.5 rounded-full bg-[#e5a00d] shrink-0"></span>}
                             <span className={appLang === lang.code ? '' : 'ml-3'}>{lang.label}</span>
                          </button>
                       ))}
                    </div>
                 )}
              </div>
          </div>
        </div>
      </nav>

      {loading ? (
        <div className="h-screen flex flex-col items-center justify-center gap-5">
          <div className="w-12 h-12 border-4 border-[#e5a00d] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium animate-pulse">{t.sinc_biblio}</p>
        </div>
      ) : error ? (
        <div className="h-screen flex flex-col items-center justify-center text-center p-10">
          <AlertTriangle size={60} className="text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">{t.error_fallo}</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      ) : (
        <>
          {activeTab === 'directos' && (
            <div className="pt-24 md:pt-[5.5rem] px-4 md:px-12 flex flex-col lg:flex-row gap-4 md:gap-6 h-[calc(100vh-1rem)] pb-4 md:pb-6 lg:pb-8 animate-in fade-in duration-500 w-full">
                
                <div className="flex-1 bg-black rounded-xl overflow-hidden border border-white/10 relative shadow-2xl min-h-[40vh] lg:min-h-0 lg:h-full flex items-center justify-center group/player">
                    <div className="absolute inset-0 w-full h-full">
                        {isLogged ? (
                            <NativeStreamPlayer streamSid={streamSid} streamPassword={streamPassword} channel={STREAM_CHANNEL} usePatreon={usePatreon} t={t} />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-md relative z-10">
                                <div className="bg-[#5865F2]/20 p-6 rounded-full mb-6 border border-[#5865F2]/30 shadow-[0_0_30px_rgba(88,101,242,0.3)]">
                                    <Lock size={64} className="text-[#5865F2]" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">{t.acceso_premium}</h2>
                                <p className="text-gray-400 text-center max-w-sm px-4">{t.desc_directo}</p>
                            </div>
                        )}
                    </div>
                    
                    {isLogged && (
                        <div className="absolute top-4 left-4 z-30 pointer-events-none opacity-0 group-hover/player:opacity-100 transition-opacity">
                            <span className="bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-2 uppercase tracking-widest shadow-lg">
                                <Server size={12} className={usePatreon ? 'text-[#e5a00d]' : 'text-blue-400'} /> 
                                {usePatreon ? t.serv_patreon : t.serv_normal}
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="w-full lg:w-[350px] xl:w-[400px] bg-[#1a1a1c] rounded-xl overflow-hidden border border-white/5 flex flex-col shadow-2xl shrink-0 h-auto lg:h-full overflow-y-auto">
                    <div className="bg-[#141414] p-3 border-b border-white/5 flex justify-center items-center shrink-0">
                       <span className="font-bold text-white text-sm flex items-center gap-2">
                           {isLogged ? <Server size={16} className="text-[#e5a00d]" /> : <Lock size={16} className="text-[#5865F2]" />}
                           {isLogged ? t.panel_servidor : t.acceso_premium}
                       </span>
                    </div>
                    
                    <div className="flex flex-col flex-1 p-4 md:p-6 justify-start items-center text-center">
                        {isLogged ? (
                            <div className="flex flex-col items-center w-full h-full animate-in fade-in zoom-in duration-300">
                                <div className="bg-green-500/10 p-4 rounded-full mb-4 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.15)] shrink-0">
                                    <CheckCircle size={40} className="text-green-500" />
                                </div>
                                <h3 className="text-xl md:text-2xl font-black text-white mb-2 shrink-0">{t.acceso_concedido}</h3>
                                <p className="text-gray-400 text-[11px] md:text-xs mb-8 leading-relaxed shrink-0">
                                    {t.credenciales_inyectadas}
                                </p>

                                <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 md:p-5 mb-6 shadow-inner shrink-0">
                                    <span className="text-[10px] md:text-[11px] text-gray-400 uppercase tracking-widest font-bold flex items-center justify-center gap-2 mb-4">
                                        <Server size={14} className="text-[#e5a00d]" /> {t.selecciona_servidor}
                                    </span>
                                    
                                    <div className="flex bg-[#141414] rounded-lg p-1.5 border border-white/5 relative">
                                        <button 
                                            onClick={() => setUsePatreon(true)}
                                            disabled={!streamSid} 
                                            className={`flex-1 py-2.5 text-xs rounded-md transition-all duration-300 z-10 ${usePatreon ? 'bg-[#e5a00d] text-black font-black shadow-[0_2px_10px_rgba(229,160,13,0.3)]' : 'text-gray-400 hover:text-white font-semibold'} ${!streamSid ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        >
                                            {t.serv_patreon}
                                        </button>
                                        <button 
                                            onClick={() => setUsePatreon(false)}
                                            className={`flex-1 py-2.5 text-xs rounded-md transition-all duration-300 z-10 ${!usePatreon ? 'bg-neutral-700 text-white font-black shadow-md border border-white/10' : 'text-gray-400 hover:text-white font-semibold'}`}
                                        >
                                            {t.serv_normal}
                                        </button>
                                    </div>
                                    
                                    {!streamSid && (
                                        <p className="text-[9px] text-red-400/80 mt-3 font-medium flex items-center justify-center gap-1">
                                            <AlertTriangle size={10} /> {t.servidor_no_disp}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-auto w-full pt-4">
                                    <a 
                                        href="https://discord.com/oauth2/authorize?client_id=1475601631977406605&response_type=code&redirect_uri=https%3A%2F%2Felppstrmstv.pages.dev%2F%3Ftab%3Ddirectos&scope=identify"
                                        className="w-full font-bold py-3 px-6 rounded-lg transition-all border border-white/10 bg-[#202225] hover:bg-[#2f3136] text-gray-300 text-xs flex items-center justify-center gap-2 group"
                                    >
                                        <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> {t.refrescar_pass}
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center w-full h-full animate-in fade-in duration-300">
                                <div className="bg-[#5865F2]/10 p-4 rounded-full mb-4 border border-[#5865F2]/30 shrink-0">
                                    <svg className="w-10 h-10 text-[#5865F2]" fill="currentColor" viewBox="0 0 127.14 96.36">
                                        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77.7,77.7,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.56,65.3c-5.36,0-9.8-4.83-9.8-10.74s4.33-10.74,9.8-10.74,9.84,4.83,9.8,10.74C52.4,60.47,48,65.3,42.56,65.3Zm42,0c-5.36,0-9.8-4.83-9.8-10.74s4.33-10.74,9.8-10.74,9.84,4.83,9.8,10.74C94.4,60.47,90,65.3,84.56,65.3Z"/>
                                    </svg>
                                </div>
                                <h3 className="text-xl md:text-2xl font-black text-white mb-2 shrink-0">{t.pass_directo}</h3>
                                <p className="text-gray-400 text-[11px] md:text-xs mb-8 leading-relaxed shrink-0 max-w-[250px]">
                                    {t.desc_directo}
                                </p>
                                
                                <a 
                                   href="https://discord.com/oauth2/authorize?client_id=1475601631977406605&response_type=code&redirect_uri=https%3A%2F%2Felppstrmstv.pages.dev%2F%3Ftab%3Ddirectos&scope=identify"
                                   className={`font-bold py-3 px-6 rounded-lg transition-all w-full shadow-lg hover:scale-105 flex items-center justify-center gap-2 text-sm shrink-0 ${
                                       isVerifying ? 'opacity-50 pointer-events-none bg-[#5865F2] text-white' : 
                                       'bg-[#5865F2] hover:bg-[#4752C4] text-white'
                                   }`}
                                >
                                    {isVerifying ? (
                                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t.verificando}</>
                                    ) : t.verificar_rol}
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'series' && (
            <div className="pt-32 px-4 md:px-12 flex flex-col items-center justify-center text-center h-[70vh] animate-in zoom-in-95 duration-500">
                <div className="bg-neutral-900/50 p-6 rounded-full border border-white/5 mb-6 shadow-2xl">
                    <Tv size={80} className="text-[#e5a00d]" />
                </div>
                <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter">{t.proximamente}</h2>
                <p className="text-gray-400 text-lg md:text-xl max-w-xl font-light">{t.prep_series}</p>
            </div>
          )}

          {(activeTab === 'inicio' || activeTab === 'pelis') && (
            <div className="animate-in fade-in duration-300">
              {heroItem && !searchQuery && !selectedCategory && (
                <div className="relative h-[50vh] sm:h-[60vh] md:h-[85vh] w-full mb-6 md:mb-12 overflow-hidden mt-20 md:mt-0">
                   {/* Imagen horizontal tanto en móvil como en PC. En móvil recortada por arriba para que quepa bien el texto */}
                   <img src={heroItem.backdrop} className="w-full h-full object-cover object-top sm:object-center opacity-80 md:opacity-100" alt="Hero Banner" />
                   
                   {/* Gradientes oscurecedores para que destaquen las letras */}
                   <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-[#0f0f0f]/80 md:via-[#0f0f0f]/60 to-transparent"></div>
                   <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 md:via-transparent to-transparent"></div>
                   
                   <div className="absolute bottom-6 md:bottom-20 left-4 md:left-12 max-w-[95%] sm:max-w-[80%] md:max-w-3xl z-10 flex flex-col justify-end">
                      <div className="flex items-center gap-2 text-[#e5a00d] font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] mb-2 md:mb-4">
                        <Film size={14} /> {t.recomendado_para_ti}
                      </div>
                      <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2 md:mb-4 leading-tight drop-shadow-2xl line-clamp-2 md:line-clamp-3 pr-4">{heroItem.displayTitle || heroItem.title}</h1>
                      <p className="text-gray-300 text-xs sm:text-sm md:text-base lg:text-lg line-clamp-2 md:line-clamp-3 font-light mb-4 md:mb-6 max-w-xl leading-relaxed">{heroItem.description}</p>
                      <button onClick={() => setSelectedItem(heroItem)} className="flex items-center justify-center gap-2 md:gap-3 bg-[#e5a00d] hover:bg-[#c9890a] text-black font-extrabold py-2 md:py-3 px-6 md:px-8 rounded-full transition-all hover:scale-105 shadow-2xl shadow-[#e5a00d]/20 w-max text-xs md:text-base">
                        <Info size={18} className="md:w-6 md:h-6" /> {t.ver_detalles}
                      </button>
                   </div>
                </div>
              )}

              <div className={searchQuery || selectedCategory ? 'pt-40 md:pt-36 px-4 md:px-12' : '-mt-6 md:-mt-24 relative z-20'}>
                {searchQuery ? (
                   <div>
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
                        <h2 className="text-xl md:text-3xl font-bold text-white">{t.resultados}</h2>
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                          {renderFiltersAndSorting()}
                          <div className="flex items-center gap-1 md:gap-2 bg-neutral-900/80 p-1 rounded-lg border border-white/5 w-max">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><Grid size={16} className="md:w-5 md:h-5" /></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><ListIcon size={16} className="md:w-5 md:h-5" /></button>
                          </div>
                        </div>
                     </div>
                     {renderGridOrList(paginatedItems)}
                     {processedDisplayItems.length > visibleCount && (
                        <div className="flex justify-center mt-10">
                           <button onClick={() => setVisibleCount(v => v + 100)} className="bg-neutral-800 hover:bg-[#e5a00d] text-white hover:text-black font-bold py-3 px-8 rounded-full transition-all border border-white/10 hover:scale-105 text-sm md:text-base shadow-lg">
                              {t.cargar_mas} ({processedDisplayItems.length - visibleCount} {t.restantes})
                           </button>
                        </div>
                     )}
                   </div>
                ) : selectedCategory ? (
                   <div className="animate-in fade-in duration-300">
                     <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-2 text-gray-400 hover:text-[#e5a00d] mb-4 md:mb-8 transition-colors text-sm font-semibold">
                       <ChevronLeft size={20} /> {t.volver}
                     </button>
                     <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 md:mb-8">
                       <h2 className="text-2xl md:text-4xl font-black text-white flex items-center gap-3 tracking-tight">
                         {selectedCategory.icon && <span className="text-[#e5a00d]">{selectedCategory.icon}</span>}
                         {selectedCategory.title}
                       </h2>
                       <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                         {renderFiltersAndSorting()}
                         <div className="flex items-center gap-1 md:gap-2 bg-neutral-900/80 p-1 rounded-lg border border-white/5 w-max">
                           <button onClick={() => setViewMode('grid')} className={`p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><Grid size={16} className="md:w-5 md:h-5" /></button>
                           <button onClick={() => setViewMode('list')} className={`p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><ListIcon size={16} className="md:w-5 md:h-5" /></button>
                         </div>
                       </div>
                     </div>
                     {renderGridOrList(paginatedItems)}
                     {processedDisplayItems.length > visibleCount && (
                        <div className="flex justify-center mt-10">
                           <button onClick={() => setVisibleCount(v => v + 100)} className="bg-neutral-800 hover:bg-[#e5a00d] text-white hover:text-black font-bold py-3 px-8 rounded-full transition-all border border-white/10 hover:scale-105 text-sm md:text-base shadow-lg">
                              {t.cargar_mas} ({processedDisplayItems.length - visibleCount} {t.restantes})
                           </button>
                        </div>
                     )}
                   </div>
                ) : (
                   categories.map((cat, idx) => (
                       <MovieRow key={idx} title={cat.title} items={cat.items} onSelect={setSelectedItem} onCategoryClick={setSelectedCategory} icon={cat.icon} eager={idx === 0} t={t} />
                   ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setSelectedItem(null)}></div>
          <div className="bg-[#1a1a1c] w-full h-full md:h-auto md:max-w-6xl md:rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] relative flex flex-col sm:flex-row max-h-[100vh] sm:max-h-[95vh] border-0 md:border border-white/10 animate-in zoom-in-95 duration-300">
            <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 md:top-6 md:right-6 z-50 p-2 bg-black/50 hover:bg-[#e5a00d] text-white hover:text-black rounded-full transition-all">
              <X size={24} />
            </button>
            <div className="w-full sm:w-[250px] md:w-[300px] lg:w-[400px] relative shrink-0 h-[35vh] sm:h-auto bg-black">
                <img src={selectedItem.image} className="w-full h-full object-contain sm:object-cover" alt="Poster" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1c] via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-[#1a1a1c]/40 sm:to-[#1a1a1c]"></div>
            </div>
            <div className="flex-1 p-6 md:p-10 lg:p-12 flex flex-col overflow-y-auto">
                {selectedItem.isSaga ? (
                    <div className="flex flex-col flex-1">
                        <div className="text-[#e5a00d] font-bold text-xs md:text-sm mb-2 flex items-center gap-1 uppercase tracking-widest"><Layers size={14}/> {t.coleccion_oficial}</div>
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-snug pb-2">{selectedItem.displayTitle || selectedItem.title}</h2>
                        <p className="text-gray-400 text-sm md:text-base lg:text-lg font-light leading-relaxed mb-8">{t.pelis_biblioteca.split(' (')[0]}</p>
                        <div className="mt-4 flex flex-col gap-8 shrink-0 pb-4">
                           <div className="w-full">
                              <h4 className="text-white font-bold text-sm md:text-base mb-4 border-b border-white/10 pb-2">{t.pelis_biblioteca} ({selectedItem.movies.length})</h4>
                              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                                 {selectedItem.movies.map(movie => (
                                    <div key={movie.id} className="cursor-pointer group flex flex-col" onClick={() => setSelectedItem(movie)}>
                                       <div className="aspect-[2/3] rounded-md overflow-hidden relative shadow-lg">
                                           <LazyImage src={movie.image} alt={movie.displayTitle || movie.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                       </div>
                                       <p className="text-[11px] md:text-xs font-semibold text-gray-200 mt-2 line-clamp-2 leading-normal pb-1 group-hover:text-[#e5a00d]">{movie.displayTitle || movie.title}</p>
                                       <p className="text-[9px] md:text-[10px] text-gray-500">{movie.year}</p>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {selectedItem.genres.map(g => (
                            <span key={g} className="text-[#e5a00d] text-[10px] md:text-xs font-black uppercase tracking-widest">{g}</span>
                          ))}
                        </div>
                        {selectedItem.collection && (
                            <div className="text-gray-400 font-bold text-xs md:text-sm mb-2 flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => setSelectedItem(sagas.find(s => s.id === `saga-${selectedItem.collection.id}`))}>
                                <Layers size={14}/> {selectedItem.collection.name} <ChevronRight size={14}/>
                            </div>
                        )}
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-snug pb-2">{selectedItem.displayTitle || selectedItem.title}</h2>
                        <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
                          <div className="flex flex-col">
                            <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{t.año}</span>
                            <span className="text-white font-bold">{selectedItem.year}</span>
                          </div>
                          <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2"></div>
                          <div className="flex flex-col">
                            <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">TMDB</span>
                            <span className="text-white font-bold flex items-center gap-1"><Star size={14} className="text-[#e5a00d]" fill="currentColor"/> {selectedItem.rating}</span>
                          </div>
                          <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2"></div>
                          <div className="flex flex-col">
                            <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{t.calidad}</span>
                            <span className={`inline-flex items-center justify-center leading-none px-2 py-1 rounded text-[10px] md:text-[11px] font-black mt-1 uppercase border ${selectedItem.videoQuality === '4K' ? 'bg-[#e5a00d] text-black border-[#e5a00d]' : 'bg-white/10 text-white border-white/20'}`}>
                                {selectedItem.videoQuality}
                            </span>
                          </div>
                          <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2"></div>
                          <div className="flex flex-col">
                            <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{t.idiomas}</span>
                            <span className="text-gray-300 font-medium text-xs md:text-sm mt-1">{selectedItem.language}</span>
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm md:text-base lg:text-lg font-light leading-relaxed mb-8">{selectedItem.description}</p>
                        {selectedItem.link !== '#' ? (
                           <a href={selectedItem.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-[#e5a00d] hover:bg-[#c9890a] text-black font-black py-4 px-6 md:px-10 rounded-full text-sm md:text-lg transition-all hover:scale-105 shadow-xl shadow-[#e5a00d]/10 w-full md:w-max group shrink-0">
                             <Download size={22} className="group-hover:translate-y-1 transition-transform" /> {t.descargar}
                           </a>
                        ) : (
                           <button disabled className="flex items-center justify-center gap-3 bg-neutral-800 text-gray-500 font-black py-4 px-6 md:px-10 rounded-full text-sm md:text-lg cursor-not-allowed w-full md:w-max shrink-0">
                             <AlertTriangle size={22} /> {t.enlace_no_disp}
                           </button>
                        )}
                        <div className="mt-12 flex flex-col gap-2 shrink-0 pb-4">
                           {sagaItems.length > 0 && (
                              <MovieRow 
                                  title={t.mas_saga}
                                  items={sagaItems} 
                                  onSelect={setSelectedItem} 
                                  icon={<Layers size={18} />} 
                                  isModal={true}
                                  onTitleClick={() => setSelectedItem(sagas.find(s => s.id === `saga-${selectedItem.collection.id}`))}
                                  t={t}
                              />
                           )}
                           {items.filter(i => !i.isSaga && i.id !== selectedItem.id && i.genres.some(g => selectedItem.genres.includes(g))).length > 0 && (
                              <MovieRow 
                                  title={t.titulos_similares}
                                  items={shuffleArray(items.filter(i => !i.isSaga && i.id !== selectedItem.id && i.genres.some(g => selectedItem.genres.includes(g))))} 
                                  onSelect={setSelectedItem} 
                                  icon={<Star size={18} />} 
                                  isModal={true}
                                  t={t}
                              />
                           )}
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}