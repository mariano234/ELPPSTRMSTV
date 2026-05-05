useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/library');
        if (!response.ok) throw new Error("Error en la sincronización de la biblioteca.");
        const rawItems = await response.json();
        
        const chunkSize = 25; 
        const enriched = [];
        const translatedNoDesc = t.sin_descripcion;
        
        for (let i = 0; i < rawItems.length; i += chunkSize) {
          const chunk = rawItems.slice(i, i + chunkSize);
          const chunkEnriched = await Promise.all(chunk.map(async (row, idx) => {
            const tmdb = await fetchTMDB(row.title, row.year, appLang);
            
            return {
              id: `item-${i + idx}`,
              isSaga: false,
              title: row.title, 
              displayTitle: tmdb?.tmdbTitle || row.title, 
              year: tmdb?.year || row.year,
              description: tmdb?.overview || translatedNoDesc,
              image: tmdb?.poster || `https://via.placeholder.com/500x750/1a1a1c/e5a00d?text=${encodeURIComponent(row.title)}`,
              backdrop: tmdb?.backdrop || tmdb?.poster,
              videoQuality: formatVideoQuality(row.quality),
              language: translateLangs(row.language, appLang),
              link: row.link,
              genres: tmdb?.genres?.length ? tmdb.genres : ["Otros"],
              collection: tmdb?.collection || null,
              rating: tmdb?.rating || 'N/A'
            };
          }));
          enriched.push(...chunkEnriched);
        }

        const sagaMap = new Map();
        enriched.forEach(item => {
            if (item.collection) {
                if (!sagaMap.has(item.collection.id)) {
                    sagaMap.set(item.collection.id, {
                        isSaga: true,
                        id: `saga-${item.collection.id}`,
                        title: item.collection.name,
                        displayTitle: item.collection.name,
                        image: item.collection.poster || item.image,
                        backdrop: item.collection.backdrop || item.backdrop,
                        movies: [],
                        genres: item.genres 
                    });
                }
                sagaMap.get(item.collection.id).movies.push(item);
            }
        });
        
        const sagasArray = Array.from(sagaMap.values());
        sagasArray.forEach(saga => saga.movies.sort((a, b) => parseInt(a.year || 0) - parseInt(b.year || 0)));

        setItems(enriched);
        setSagas(sagasArray);
        
        const topMoviesFetch = enriched.filter(m => parseFloat(m.rating) > 7.0);
        const poolFetch = topMoviesFetch.length > 0 ? topMoviesFetch : enriched;
        setHeroItem(poolFetch[Math.floor(Math.random() * poolFetch.length)]);
        
        setLoading(false);

      } catch (err) { 
          setError(err.message); 
          setLoading(false); 
      }
    };

    loadContent();
  }, [appLang, t.sin_descripcion]);