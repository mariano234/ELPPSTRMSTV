import { LANGUAGE_MAP, LANG_TRANSLATIONS, GENRE_TRANSLATIONS, TMDB_API_KEY } from './config';

export const parseCSV = (text) => {
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

export const formatVideoQuality = (raw) => {
  if (!raw) return 'SD';
  const s = raw.toLowerCase();
  if (s.includes('2160') || s.includes('4k')) return '4K';
  if (s.includes('1080') || s.includes('fhd')) return 'FHD';
  if (s.includes('720') || s.includes('hd')) return 'HD';
  return 'SD';
};

export const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const extractIdentifier = (sid) => {
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

export const translateLangs = (str, targetLang) => {
    if (!str || str === 'N/A') return 'N/A';
    return str.split(/[,/-]/).map(l => {
        const clean = l.trim().toLowerCase();
        const baseEs = LANGUAGE_MAP[clean] || l.trim();
        return LANG_TRANSLATIONS[targetLang]?.[baseEs] || baseEs;
    }).join(', ');
};

export const fetchTMDB = async (title, year, langToFetch) => {
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