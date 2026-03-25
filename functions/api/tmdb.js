// Diccionario de traducciones de género centralizado en el backend
const GENRE_TRANSLATIONS = {
    'Acción': { ca: 'Acció', gl: 'Acción', eu: 'Ekintza', es: 'Acción' }, 'Action': { ca: 'Acció', gl: 'Acción', eu: 'Ekintza', es: 'Acción' },
    'Aventura': { ca: 'Aventura', gl: 'Aventura', eu: 'Abentura', es: 'Aventura' }, 'Adventure': { ca: 'Aventura', gl: 'Aventura', eu: 'Abentura', es: 'Aventura' },
    'Animación': { ca: 'Animació', gl: 'Animación', eu: 'Animazioa', es: 'Animación' }, 'Animation': { ca: 'Animació', gl: 'Animación', eu: 'Animazioa', es: 'Animación' },
    'Comedia': { ca: 'Comèdia', gl: 'Comedia', eu: 'Komedia', es: 'Comedia' }, 'Comedy': { ca: 'Comèdia', gl: 'Comedia', eu: 'Komedia', es: 'Comedia' },
    'Crimen': { ca: 'Crim', gl: 'Crime', eu: 'Krimena', es: 'Crimen' }, 'Crime': { ca: 'Crim', gl: 'Crime', eu: 'Krimena', es: 'Crimen' },
    'Documental': { ca: 'Documental', gl: 'Documental', eu: 'Dokumentala', es: 'Documental' }, 'Documentary': { ca: 'Documental', gl: 'Documental', eu: 'Dokumentala', es: 'Documental' },
    'Drama': { ca: 'Drama', gl: 'Drama', eu: 'Drama', es: 'Drama' }, 'Familia': { ca: 'Família', gl: 'Familia', eu: 'Familia', es: 'Familia' },
    'Family': { ca: 'Família', gl: 'Familia', eu: 'Familia', es: 'Familia' }, 'Fantasía': { ca: 'Fantasia', gl: 'Fantasía', eu: 'Fantasia', es: 'Fantasía' },
    'Fantasy': { ca: 'Fantasia', gl: 'Fantasía', eu: 'Fantasia', es: 'Fantasía' }, 'Historia': { ca: 'Història', gl: 'Historia', eu: 'Historia', es: 'Historia' },
    'History': { ca: 'Història', gl: 'Historia', eu: 'Historia', es: 'Historia' }, 'Terror': { ca: 'Terror', gl: 'Terror', eu: 'Beldurra', es: 'Terror' },
    'Horror': { ca: 'Terror', gl: 'Terror', eu: 'Beldurra', es: 'Terror' }, 'Música': { ca: 'Música', gl: 'Música', eu: 'Musika', es: 'Música' },
    'Music': { ca: 'Música', gl: 'Música', eu: 'Musika', es: 'Música' }, 'Misterio': { ca: 'Misteri', gl: 'Misterio', eu: 'Misterioa', es: 'Misterio' },
    'Mystery': { ca: 'Misteri', gl: 'Misterio', eu: 'Misterioa', es: 'Misterio' }, 'Romance': { ca: 'Romanç', gl: 'Romance', eu: 'Erromantzea', es: 'Romance' },
    'Ciencia ficción': { ca: 'Ciència ficció', gl: 'Ciencia ficción', eu: 'Zientzia fikzioa', es: 'Ciencia ficción' }, 'Science Fiction': { ca: 'Ciència ficció', gl: 'Ciencia ficción', eu: 'Zientzia fikzioa', es: 'Ciencia ficción' },
    'Película de TV': { ca: 'Pel·lícula de TV', gl: 'Película de TV', eu: 'Telebistako filma', es: 'Película de TV' }, 'TV Movie': { ca: 'Pel·lícula de TV', gl: 'Película de TV', eu: 'Telebistako filma', es: 'Película de TV' },
    'Suspense': { ca: 'Suspens', gl: 'Suspense', eu: 'Suspensea', es: 'Suspense' }, 'Thriller': { ca: 'Suspens', gl: 'Suspense', eu: 'Suspensea', es: 'Suspense' },
    'Bélica': { ca: 'Bèl·lica', gl: 'Bélica', eu: 'Gerra', es: 'Bélica' }, 'War': { ca: 'Bèl·lica', gl: 'Bélica', eu: 'Gerra', es: 'Bélica' },
    'Western': { ca: 'Western', gl: 'Western', eu: 'Western', es: 'Western' }
};

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    const title = url.searchParams.get('title');
    const year = url.searchParams.get('year');
    const langToFetch = url.searchParams.get('lang') || 'es';

    const corsHeaders = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

    if (!title) return new Response(JSON.stringify({ error: "Missing title" }), { status: 400, headers: corsHeaders });

    // Caching System
    const cache = caches.default;
    let response = await cache.match(request);
    if (response) return response;

    // LA KEY AHORA ESTÁ SEGURA EN CLOUDFLARE
    const TMDB_API_KEY = env.TMDB_API_KEY; 

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
        
        let result = null;

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
            
            result = {
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

        // Cachear en Cloudflare Edge durante 7 Días (604800 segundos)
        const jsonResponse = new Response(JSON.stringify(result), {
            headers: {
                ...corsHeaders,
                "Cache-Control": "public, s-maxage=604800, max-age=604800"
            }
        });

        context.waitUntil(cache.put(request, jsonResponse.clone()));
        return jsonResponse;

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}