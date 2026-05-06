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

        // Limpieza de fechas entre paréntesis para no confundir a TMDB
        let cleanTitle = rawTitle.replace(/\(\d{4}\)/g, '').trim();
        let tmdbData = null;
        let isCollectionMatch = false;

        // Función auxiliar estricta: SOLO busca películas (/search/movie)
        const fetchMovie = async (query, y, l) => {
            let sUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=${l}&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
            if (y && y !== '?') sUrl += `&primary_release_year=${y}`;
            const res = await fetch(sUrl);
            const data = await res.json();
            return data.results && data.results.length > 0 ? data.results[0] : null;
        };

        // PASO 1: Película + Año exacto en Español
        let item = await fetchMovie(cleanTitle, year, lang);

        // PASO 2: Película + Año exacto en Inglés
        if (!item && year && year !== '?') {
            item = await fetchMovie(cleanTitle, year, 'en-US');
        }

        // PASO 3: Búsqueda como Saga / Colección en Español
        let collectionData = null;
        if (!item) {
            const cUrl = `https://api.themoviedb.org/3/search/collection?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(cleanTitle)}&page=1`;
            const cRes = await fetch(cUrl);
            const cData = await cRes.json();
            if (cData.results && cData.results.length > 0) {
                const collSummary = cData.results[0];
                const detailsRes = await fetch(`https://api.themoviedb.org/3/collection/${collSummary.id}?api_key=${TMDB_API_KEY}&language=${lang}`);
                collectionData = await detailsRes.json();
                isCollectionMatch = true;
            }
        }

        // PASO 4: Rescate final -> Película SIN Año en Español
        if (!item && !collectionData) {
            item = await fetchMovie(cleanTitle, null, lang);
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

        if (item) {
            result.tmdbTitle = item.title;
            result.year = (item.release_date || '').split('-')[0];
            result.overview = item.overview;
            result.poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
            result.backdrop = item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null;
            result.rating = item.vote_average ? item.vote_average.toFixed(1) : null;

            const detailsRes = await fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}&language=${lang}`);
            const detailsData = await detailsRes.json();
            
            if (detailsData.belongs_to_collection) {
                result.collection = {
                    id: detailsData.belongs_to_collection.id,
                    name: detailsData.belongs_to_collection.name,
                    poster: detailsData.belongs_to_collection.poster_path ? `https://image.tmdb.org/t/p/w500${detailsData.belongs_to_collection.poster_path}` : null,
                    backdrop: detailsData.belongs_to_collection.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detailsData.belongs_to_collection.backdrop_path}` : null
                };
            }
            if (detailsData.genres) result.genres = detailsData.genres.map(g => g.name);

        } else if (collectionData) {
            result.tmdbTitle = collectionData.name;
            result.overview = collectionData.overview;
            result.poster = collectionData.poster_path ? `https://image.tmdb.org/t/p/w500${collectionData.poster_path}` : null;
            result.backdrop = collectionData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${collectionData.backdrop_path}` : null;
            
            // Si es una saga pura, tomamos el año y la nota de la primera película de la colección
            if (collectionData.parts && collectionData.parts.length > 0) {
                const firstPart = collectionData.parts[0];
                result.year = (firstPart.release_date || '').split('-')[0];
                result.rating = firstPart.vote_average ? firstPart.vote_average.toFixed(1) : null;
            }

            result.collection = {
                id: collectionData.id,
                name: collectionData.name,
                poster: result.poster,
                backdrop: result.backdrop
            };
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