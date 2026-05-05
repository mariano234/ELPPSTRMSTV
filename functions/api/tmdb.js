export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    const title = url.searchParams.get('title');
    const year = url.searchParams.get('year') || '';
    const lang = url.searchParams.get('lang') || 'es';

    if (!title) {
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

        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(title)}&page=1&include_adult=false${year && year !== '?' ? `&primary_release_year=${year}` : ''}`;

        const tmdbRes = await fetch(searchUrl);
        const tmdbData = await tmdbRes.json();

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
            const item = tmdbData.results.find(i => i.media_type === 'movie' || i.media_type === 'tv') || tmdbData.results[0];

            result.tmdbTitle = item.title || item.name;
            result.year = (item.release_date || item.first_air_date || '').split('-')[0];
            result.overview = item.overview;
            result.poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
            result.backdrop = item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null;
            result.rating = item.vote_average ? item.vote_average.toFixed(1) : null;

            if (item.media_type === 'movie') {
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
            } else if (item.media_type === 'tv') {
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