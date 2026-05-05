// ==========================================
// src/utils.js
// ==========================================

// Extrae el identificador único de la cookie SID de AngelThump/Patreon
export const extractIdentifier = (sid) => {
    if (!sid) return null;
    try {
        const decoded = decodeURIComponent(sid);
        if (decoded.startsWith('s:')) {
            return decoded.split(':')[1].split('.')[0];
        }
        return decoded;
    } catch (e) {
        return null;
    }
};

// Petición al nuevo proxy de Cloudflare para TMDB (con caché)
export const fetchTMDB = async (title, year, appLang) => {
    try {
        const url = `/api/tmdb?title=${encodeURIComponent(title)}&year=${encodeURIComponent(year)}&lang=${appLang}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (error) {
        console.error("Error al obtener metadatos de TMDB:", error);
        return null;
    }
};

// Mezcla aleatoriamente los elementos de un array (usado en el catálogo)
export const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

// Formatea la etiqueta de calidad de vídeo
export const formatVideoQuality = (quality) => {
    if (!quality) return '';
    return quality.toString().trim().toUpperCase();
};

// Formatea los lenguajes/idiomas
export const translateLangs = (lang, appLang) => {
    if (!lang) return 'N/A';
    return lang.toString().trim();
};

// ParseCSV obsoleto (ahora lo hace el backend de Cloudflare en /api/library)
// Se mantiene exportada como función vacía por si algún componente antiguo aún la importa.
export const parseCSV = (text) => {
    return [];
};