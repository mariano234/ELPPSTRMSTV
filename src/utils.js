// ==========================================
// src/utils.js
// ==========================================

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

export const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

// ==========================================
// Lógica estricta de Calidades
// ==========================================
export const formatVideoQuality = (quality) => {
    if (!quality) return '';
    const q = quality.toString().toUpperCase().trim();
    
    if (q.includes('4K') || q.includes('2160')) return '4K';
    if (q.includes('1080') || q.includes('720') || q.includes('HD')) return 'HD';
    if (q.includes('480') || q.includes('360') || q.includes('SD')) return 'SD';
    
    return q; 
};

export const translateLangs = (lang, appLang) => {
    if (!lang) return 'N/A';
    return lang.toString().trim();
};

export const parseCSV = (text) => {
    return [];
};