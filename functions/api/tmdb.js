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
    if (!TMDB_API_KEY) {
        return new Response(JSON.stringify({ error: "Variable de entorno TMDB_API_KEY no configurada." }), { status: 500 });
    }

    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url);
        let response = await cache.match(cacheKey);

        if (response) {
            return response;
        }

        // 1. Limpieza de título: Quitamos posibles fechas entre paréntesis que confunden a TMDB
        let cleanTitle = rawTitle.replace(/\(\d{4}\)/g, '').trim();

        // 2. Búsqueda estricta (Películas + Año exacto) para la máxima precisión
        let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(cleanTitle)}&page=1&include_adult=false`;
        if (year && year !== '?') {
            searchUrl += `&primary_release_year=${year}`;
        }

        let tmdbRes = await fetch(searchUrl);
        let tmdbData = await tmdbRes.json();

        // 3. Fallback: Si no hay resultados exactos, hacemos búsqueda general sin restricción de año
        if (!tmdbData.results || tmdbData.results.length === 0) {
            const fallbackUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(cleanTitle)}&page=1&include_adult=false`;
            tmdbRes = await fetch(fallbackUrl);
            tmdbData = await tmdbRes.json();
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

        if (tmdbData.results && tmdbData.results.length > 0) {
            const item = tmdbData.results[0];

            result.tmdbTitle = item.title || item.name;
            result.year = (item.release_date || item.first_air_date || '').split('-')[0];
            result.overview = item.overview;
            result.poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
            result.backdrop = item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null;
            result.rating = item.vote_average ? item.vote_average.toFixed(1) : null;

            // Determinar si es Película o Serie (Las de search/movie no traen media_type)
            const isTV = item.media_type === 'tv' || item.first_air_date !== undefined;

            if (!isTV) { 
                // Extraer la colección y géneros de la película
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
                if (detailsData.genres) {
                    result.genres = detailsData.genres.map(g => g.name);
                }
            } else {
                 // Extraer géneros de la serie
                 const detailsRes = await fetch(`https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&language=${lang}`);
                 const detailsData = await detailsRes.json();
                 if (detailsData.genres) {
                    result.genres = detailsData.genres.map(g => g.name);
                }
            }
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
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
}