import { API_BASE } from './config';
export { parseCSV } from '../shared/csv.js';

// ==========================================
// src/utils.js
// ==========================================

export const fetchTMDB = async (title, year, appLang, refresh = false, retries = 2, signal) => {
    try {
        let url = `${API_BASE}/tmdb?title=${encodeURIComponent(title)}&year=${encodeURIComponent(year)}&lang=${appLang}`;
        if (refresh) url += `&refresh=true`;
        
        const res = await fetch(url, { signal });
        // Si hay error (ej. límite de Cloudflare), reintentamos tras medio segundo
        if (!res.ok) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return fetchTMDB(title, year, appLang, refresh, retries - 1, signal);
            }
            return null;
        }
        return await res.json();
    } catch (error) {
        if (signal?.aborted) throw error;
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return fetchTMDB(title, year, appLang, refresh, retries - 1, signal);
        }
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
// AÑADIDO: 255 a SD
// ==========================================
export const formatVideoQuality = (quality) => {
    if (!quality) return '';
    const q = quality.toString().toUpperCase().trim();
    if (q.includes('4K') || q.includes('2160')) return '4K';
    if (q.includes('1080') || q.includes('720') || q.includes('HD')) return 'HD';
    // Se ha añadido 255 aquí
    if (q.includes('480') || q.includes('360') || q.includes('255') || q.includes('SD')) return 'SD';
    return q; 
};

export const translateLangs = (lang) => {
    if (!lang) return 'N/A';
    return lang.toString().trim();
};
