export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    const rawTitle = url.searchParams.get('title');
    const year = url.searchParams.get('year') || '';
    const lang = url.searchParams.get('lang') || 'es';
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // NORMALIZADOR ESTRICTO DE IDIOMAS (Para que TMDB no devuelva "Comedy" en vez de "Comèdia")
    let fetchLang = lang;
    if (lang === 'ca') fetchLang = 'ca-ES';
    if (lang === 'es') fetchLang = 'es-ES';
    if (lang === 'en') fetchLang = 'en-US';

    if (!rawTitle) {
        return new Response(JSON.stringify({ error: "Parámetro 'title' requerido." }), { status: 400 });
    }

    const TMDB_API_KEY = env.TMDB_API_KEY;

    try {
        const cache = caches.default;
        const cacheUrl = new URL(request.url);
        cacheUrl.searchParams.delete('refresh');
        const cacheKey = new Request(cacheUrl.toString());
        
        if (!forceRefresh) {
            let response = await cache.match(cacheKey);
            if (response) return response;
        }

        let cleanTitle = rawTitle.replace(/\(\d{4}\)/g, '').trim();
        let altTitle = cleanTitle.replace(/\s+[1-9]$/, '').trim(); 
        let ultraCleanTitle = altTitle.replace(/[:\-]/g, ' ').replace(/\by\b/gi, ' ').replace(/\s+/g, ' ').trim();
        
        let matchedId = null;
        let isCollectionMatch = false;

        const fetchMovieId = async (query, y, l) => {
            let sUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=${l}&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
            if (y && y !== '?') sUrl += `&primary_release_year=${y}`;
            const res = await fetch(sUrl);
            const data = await res.json();
            return data.results && data.results.length > 0 ? data.results[0].id : null;
        };

        const tryFindMovie = async (searchYear) => {
            // ANCLAJE AL ESPAÑOL: Como el Excel está en español, forzamos buscar el ID primero en 'es-ES'
            // Esto evita que las películas desaparezcan al cambiar a catalán o inglés
            let id = await fetchMovieId(cleanTitle, searchYear, 'es-ES');
            if (!id && cleanTitle !== altTitle) id = await fetchMovieId(altTitle, searchYear, 'es-ES');
            if (!id && altTitle !== ultraCleanTitle) id = await fetchMovieId(ultraCleanTitle, searchYear, 'es-ES');
            
            // Si el título del Excel estuviera en inglés, probamos un rescate final
            if (!id) id = await fetchMovieId(cleanTitle, searchYear, 'en-US'); 
            return id;
        };

        if (year && year !== '?') matchedId = await tryFindMovie(year);

        let collectionData = null;
        if (!matchedId) {
            // Las colecciones también se buscan ancladas a 'es-ES'
            const cUrl = `https://api.themoviedb.org/3/search/collection?api_key=${TMDB_API_KEY}&language=es-ES&query=${encodeURIComponent(altTitle)}&page=1`;
            const cRes = await fetch(cUrl);
            const cData = await cRes.json();
            if (cData.results && cData.results.length > 0) {
                const collId = cData.results[0].id;
                // Una vez encontrado el ID, la info se extrae en el idioma seleccionado (fetchLang)
                const detailsRes = await fetch(`https://api.themoviedb.org/3/collection/${collId}?api_key=${TMDB_API_KEY}&language=${fetchLang}`);
                collectionData = await detailsRes.json();
                isCollectionMatch = true;
            }
        }

        if (!matchedId && !isCollectionMatch) matchedId = await tryFindMovie(null);

        let result = {
            tmdbTitle: null, year: null, overview: null, poster: null, backdrop: null, genres: [], collection: null, rating: null
        };

        if (matchedId) {
            // Extraer la información en el idioma traducido exacto de la App
            const detailsRes = await fetch(`https://api.themoviedb.org/3/movie/${matchedId}?api_key=${TMDB_API_KEY}&language=${fetchLang}`);
            let details = await detailsRes.json();

            // REGLA DE PRIORIDAD EXTENDIDA (Ahora cubre también los Géneros vacíos)
            const fallbackLang = lang.startsWith('es') ? 'en-US' : 'es-ES';
            
            if (!details.overview || !details.poster_path || !details.genres || details.genres.length === 0) {
                const fallbackRes = await fetch(`https://api.themoviedb.org/3/movie/${matchedId}?api_key=${TMDB_API_KEY}&language=${fallbackLang}`);
                const fallbackDetails = await fallbackRes.json();

                if (!details.overview) details.overview = fallbackDetails.overview;
                if (!details.poster_path) details.poster_path = fallbackDetails.poster_path;
                if (!details.title) details.title = fallbackDetails.title;
                if (!details.genres || details.genres.length === 0) details.genres = fallbackDetails.genres;
                
                // Doble fallback
                if ((!details.overview || !details.poster_path) && fallbackLang !== 'en-US') {
                    const fb2 = await fetch(`https://api.themoviedb.org/3/movie/${matchedId}?api_key=${TMDB_API_KEY}&language=en-US`);
                    const fbD2 = await fb2.json();
                    if (!details.overview) details.overview = fbD2.overview;
                    if (!details.poster_path) details.poster_path = fbD2.poster_path;
                    if (!details.genres || details.genres.length === 0) details.genres = fbD2.genres;
                }
            }

            result.tmdbTitle = details.title;
            result.year = (details.release_date || '').split('-')[0];
            result.overview = details.overview;
            result.poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
            result.backdrop = details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : null;
            result.rating = details.vote_average ? details.vote_average.toFixed(1) : null;

            if (details.belongs_to_collection) {
                result.collection = {
                    id: details.belongs_to_collection.id,
                    name: details.belongs_to_collection.name,
                    poster: details.belongs_to_collection.poster_path ? `https://image.tmdb.org/t/p/w500${details.belongs_to_collection.poster_path}` : null,
                    backdrop: details.belongs_to_collection.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.belongs_to_collection.backdrop_path}` : null
                };
            }
            if (details.genres) result.genres = details.genres.map(g => g.name);

        } else if (isCollectionMatch && collectionData) {
            const cFbLang = lang.startsWith('es') ? 'en-US' : 'es-ES';
            if (!collectionData.overview || !collectionData.poster_path) {
                const cFbRes = await fetch(`https://api.themoviedb.org/3/collection/${collectionData.id}?api_key=${TMDB_API_KEY}&language=${cFbLang}`);
                const cFbD = await cFbRes.json();
                if (!collectionData.overview) collectionData.overview = cFbD.overview;
                if (!collectionData.poster_path) collectionData.poster_path = cFbD.poster_path;
            }

            result.tmdbTitle = collectionData.name;
            result.overview = collectionData.overview;
            result.poster = collectionData.poster_path ? `https://image.tmdb.org/t/p/w500${collectionData.poster_path}` : null;
            result.backdrop = collectionData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${collectionData.backdrop_path}` : null;
            
            if (collectionData.parts && collectionData.parts.length > 0) {
                const firstPart = collectionData.parts[0];
                result.year = (firstPart.release_date || '').split('-')[0];
                result.rating = firstPart.vote_average ? firstPart.vote_average.toFixed(1) : null;
            }
            result.collection = { id: collectionData.id, name: collectionData.name, poster: result.poster, backdrop: result.backdrop };
            result.genres = ["Saga"];
        }

        const jsonResponse = new Response(JSON.stringify(result), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=604800, s-maxage=604800"
            }
        });

        context.waitUntil(cache.put(cacheKey, jsonResponse.clone()));
        return jsonResponse;

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}