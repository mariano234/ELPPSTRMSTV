export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    const rawTitle = url.searchParams.get('title');
    const year = url.searchParams.get('year') || '';
    const lang = url.searchParams.get('lang') || 'es';

    if (!rawTitle) {
        return new Response(JSON.stringify({ error: "Parámetro 'title' requerido." }), { status: 400 });
    }

    const TMDB_API_KEY = env.TMDB_API_KEY;

    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url);
        let response = await cache.match(cacheKey);
        if (response) return response;

        // 1. LIMPIEZA INTELIGENTE DE TÍTULOS
        let cleanTitle = rawTitle.replace(/\(\d{4}\)/g, '').trim();
        // Generamos un título alternativo quitando números sueltos al final (Ej: "Tyler Rake 1" -> "Tyler Rake")
        let altTitle = cleanTitle.replace(/\s+[1-9]$/, '').trim(); 
        
        let matchedId = null;
        let isCollectionMatch = false;

        // Función estricta: SOLO busca películas, nunca series.
        const fetchMovieId = async (query, y, l) => {
            let sUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=${l}&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
            if (y && y !== '?') sUrl += `&primary_release_year=${y}`;
            const res = await fetch(sUrl);
            const data = await res.json();
            return data.results && data.results.length > 0 ? data.results[0].id : null;
        };

        // ==========================================
        // ALGORITMO DE BÚSQUEDA EN CASCADA
        // ==========================================
        
        // PASO 1: Español + Año Exacto (Primero literal, luego sin el '1' final)
        if (year && year !== '?') {
            matchedId = await fetchMovieId(cleanTitle, year, 'es');
            if (!matchedId && cleanTitle !== altTitle) matchedId = await fetchMovieId(altTitle, year, 'es');
        }

        // PASO 2: Inglés + Año Exacto (Por si el título original en el Excel está en inglés)
        if (!matchedId && year && year !== '?') {
            matchedId = await fetchMovieId(cleanTitle, year, 'en-US');
            if (!matchedId && cleanTitle !== altTitle) matchedId = await fetchMovieId(altTitle, year, 'en-US');
        }

        // PASO 3: Buscar como Saga / Colección (Si no cuadra el año, a veces es el nombre general de la saga)
        let collectionData = null;
        if (!matchedId) {
            const cUrl = `https://api.themoviedb.org/3/search/collection?api_key=${TMDB_API_KEY}&language=es&query=${encodeURIComponent(altTitle)}&page=1`;
            const cRes = await fetch(cUrl);
            const cData = await cRes.json();
            if (cData.results && cData.results.length > 0) {
                const collId = cData.results[0].id;
                const detailsRes = await fetch(`https://api.themoviedb.org/3/collection/${collId}?api_key=${TMDB_API_KEY}&language=${lang}`);
                collectionData = await detailsRes.json();
                isCollectionMatch = true;
            }
        }

        // PASO 4: Rescate final -> Película SIN Año (Solo si todo lo demás falló)
        if (!matchedId && !isCollectionMatch) {
            matchedId = await fetchMovieId(cleanTitle, null, 'es');
            if (!matchedId && cleanTitle !== altTitle) matchedId = await fetchMovieId(altTitle, null, 'es');
        }

        let result = {
            tmdbTitle: null,
            year: null,
            overview: null,
            poster: null,
            backdrop: null,
            genres: [],
            collection: null,
            rating: null
        };

        // ==========================================
        // EXTRACCIÓN DE METADATOS Y REGLA DE PRIORIDAD
        // ==========================================
        if (matchedId) {
            // Solicitamos los datos en el idioma seleccionado por el usuario en la app
            const detailsRes = await fetch(`https://api.themoviedb.org/3/movie/${matchedId}?api_key=${TMDB_API_KEY}&language=${lang}`);
            let details = await detailsRes.json();

            // REGLA DE PRIORIDAD: Si falta descripción o póster en el idioma seleccionado, hacemos fallback
            if (!details.overview || !details.poster_path) {
                const fallbackLang = lang.startsWith('es') ? 'en-US' : 'es-ES';
                const fallbackRes = await fetch(`https://api.themoviedb.org/3/movie/${matchedId}?api_key=${TMDB_API_KEY}&language=${fallbackLang}`);
                const fallbackDetails = await fallbackRes.json();

                if (!details.overview) details.overview = fallbackDetails.overview;
                if (!details.poster_path) details.poster_path = fallbackDetails.poster_path;
                if (!details.title) details.title = fallbackDetails.title; // Salvavidas para títulos vacíos
                
                // Doble fallback a inglés absoluto si el idioma anterior (ej. francés o español) también estaba incompleto
                if ((!details.overview || !details.poster_path) && fallbackLang !== 'en-US') {
                    const fb2 = await fetch(`https://api.themoviedb.org/3/movie/${matchedId}?api_key=${TMDB_API_KEY}&language=en-US`);
                    const fbD2 = await fb2.json();
                    if (!details.overview) details.overview = fbD2.overview;
                    if (!details.poster_path) details.poster_path = fbD2.poster_path;
                }
            }

            // Asignación final de variables limpias
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
            
            // Regla de prioridad aplicada también a las sagas/colecciones
            if (!collectionData.overview || !collectionData.poster_path) {
                const cFbLang = lang.startsWith('es') ? 'en-US' : 'es-ES';
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