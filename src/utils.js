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

export const fetchTMDB = async (title, year, appLang, refresh = false, retries = 2) => {
    try {
        let url = `/api/tmdb?title=${encodeURIComponent(title)}&year=${encodeURIComponent(year)}&lang=${appLang}`;
        if (refresh) url += `&refresh=true`;
        
        const res = await fetch(url);
        // Si hay error (ej. límite de Cloudflare), reintentamos tras medio segundo
        if (!res.ok) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return fetchTMDB(title, year, appLang, refresh, retries - 1);
            }
            return null;
        }
        return await res.json();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return fetchTMDB(title, year, appLang, refresh, retries - 1);
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

export const translateLangs = (lang, appLang) => {
    if (!lang) return 'N/A';
    return lang.toString().trim();
};

export const parseCSV = (text) => {
    const rows = []; let row = []; let current = ''; let inQuotes = false;
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