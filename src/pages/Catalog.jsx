import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Film, Info, Grid, List as ListIcon, Filter, Monitor, Globe, Calendar, ArrowDownWideNarrow, X, AlertTriangle, Layers, Star, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { UI_TRANSLATIONS, SHEET_ID, CACHE_VERSION, CACHE_TTL } from '../config';
import { parseCSV, formatVideoQuality, translateLangs, fetchTMDB, shuffleArray } from '../utils';
import MovieRow from '../components/MovieRow';
import LazyImage from '../components/LazyImage';

export default function Catalog({ appLang, category }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const t = UI_TRANSLATIONS[appLang] || UI_TRANSLATIONS['es'];

  const searchQuery = searchParams.get('q') || "";
  const paramV = searchParams.get('v');

  const [items, setItems] = useState([]);
  const [sagas, setSagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [heroItem, setHeroItem] = useState(null);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  const [viewMode, setViewMode] = useState('grid');
  const [visibleCount, setVisibleCount] = useState(100);
  const [sortBy, setSortBy] = useState('default');
  const [filterGenres, setFilterGenres] = useState([]);
  const [filterQualities, setFilterQualities] = useState([]);
  const [filterLanguages, setFilterLanguages] = useState([]);
  const [filterYears, setFilterYears] = useState([]);

  // Fetch logic
  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const cacheKeyName = `plex_library_full_cache_${appLang}`;
        const cachedRaw = localStorage.getItem(cacheKeyName);

        if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (parsed.version === CACHE_VERSION && (Date.now() - parsed.timestamp < CACHE_TTL)) {
                if (parsed.items && parsed.items.length > 0) {
                    setItems(parsed.items);
                    setSagas(parsed.sagas || []);
                    setHeroItem(parsed.items.filter(m => parseFloat(m.rating) > 7.0)[Math.floor(Math.random() * parsed.items.length)] || parsed.items[0]);
                    setLoading(false);
                    return;
                }
            }
        }

        const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`);
        const csvText = await response.text();
        const parsedData = parseCSV(csvText);
        
        const headerRowIdx = parsedData.findIndex(row => row.some(c => typeof c === 'string' && (c.toLowerCase().includes('título') || c.toLowerCase().includes('title'))));
        const validHeaderIdx = headerRowIdx !== -1 ? headerRowIdx : 0;
        const headers = parsedData[validHeaderIdx].map(h => (h || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
        
        const idxTitle = getIdx(['titulo', 'title']);
        const idxYear = getIdx(['ano', 'year', 'año']);
        const idxLang = getIdx(['idioma', 'lenguaje']);
        const idxQual = getIdx(['calidad']);
        const idxGen  = getIdx(['genero', 'género']);
        let idxLink = getIdx(['lnkf']);
        if (idxLink === -1) idxLink = getIdx(['link final', 'url final', 'descarga']);

        const rawRows = parsedData.slice(validHeaderIdx + 1).filter(r => r[idxTitle]);
        const chunkSize = 25; 
        const enriched = [];
        const translatedNoDesc = t.sin_descripcion;
        
        for (let i = 0; i < rawRows.length; i += chunkSize) {
          const chunk = rawRows.slice(i, i + chunkSize);
          const chunkEnriched = await Promise.all(chunk.map(async (row, idx) => {
            const title = row[idxTitle];
            const year = row[idxYear] || '?';
            
            let rawLink = '';
            if (idxLink !== -1 && row[idxLink] && typeof row[idxLink] === 'string' && row[idxLink].trim().includes('http')) {
                rawLink = row[idxLink]; 
            } else {
                const cellHttp = [...row].reverse().find(c => c && typeof c === 'string' && (c.trim().includes('http') || c.trim().includes('www.')));
                if (cellHttp) rawLink = cellHttp;
            }
            let finalLink = rawLink.trim();
            if (!finalLink || finalLink.toLowerCase() === 'link' || finalLink.toLowerCase() === 'lnkf') finalLink = '#';
            else if (finalLink !== '#' && !finalLink.startsWith('http')) finalLink = 'https://' + finalLink;

            const tmdb = await fetchTMDB(title, year, appLang);
            
            return {
              id: `item-${i + idx}`,
              isSaga: false,
              title: title, 
              displayTitle: tmdb?.tmdbTitle || title, 
              year: tmdb?.year || year,
              description: tmdb?.overview || translatedNoDesc,
              image: tmdb?.poster || `https://via.placeholder.com/500x750/1a1a1c/e5a00d?text=${encodeURIComponent(title)}`,
              backdrop: tmdb?.backdrop || tmdb?.poster,
              videoQuality: formatVideoQuality(idxQual !== -1 ? row[idxQual] : ''),
              language: idxLang !== -1 ? translateLangs(row[idxLang], appLang) : 'N/A',
              link: finalLink,
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
        setHeroItem(enriched.filter(m => parseFloat(m.rating) > 7.0)[Math.floor(Math.random() * enriched.length)] || enriched[0]);
        setLoading(false);

        localStorage.setItem(cacheKeyName, JSON.stringify({ version: CACHE_VERSION, timestamp: Date.now(), items: enriched, sagas: sagasArray }));
      } catch (err) { setError(err.message); setLoading(false); }
    };

    loadContent();
  }, [appLang]);

  // Sync Modal with URL (El botón de Atrás cierra el modal)
  useEffect(() => {
      if (paramV && items.length > 0) {
          const found = items.find(i => i.id === paramV) || sagas.find(s => s.id === paramV);
          if (found) setSelectedItem(found);
      } else if (!paramV) {
          setSelectedItem(null);
      }
  }, [paramV, items, sagas]);

  const openModal = (item) => {
      setSelectedItem(item);
      navigate(`?v=${item.id}${searchQuery ? `&q=${searchQuery}` : ''}`);
  };

  const closeModal = () => {
      setSelectedItem(null);
      navigate(`${searchQuery ? `?q=${searchQuery}` : ''}`);
  };

  const categoriesData = useMemo(() => {
    if (searchQuery || items.length === 0) return [];
    
    let cats = [];
    cats.push({ title: t.recomendados, items: shuffleArray(items).slice(0, 30), icon: <Star size={22}/> });

    const topRated = [...items].sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0)).slice(0, 100);
    cats.push({ title: t.mejor_valoradas, items: topRated, icon: null });

    const currentYear = new Date().getFullYear();
    const recentReleases = [...items].filter(i => parseInt(i.year) === currentYear || parseInt(i.year) === currentYear - 1).sort((a, b) => parseInt(b.year) - parseInt(a.year));
    if (recentReleases.length > 0) {
        cats.push({ title: t.ultimos, items: recentReleases, icon: <Film size={22}/> });
    }

    if (sagas.length > 0) {
        cats.push({ title: t.sagas, items: shuffleArray(sagas), icon: <Layers size={22}/> });
    }

    const allGenres = [...new Set(items.flatMap(i => i.genres))].sort();
    let genreCats = [];
    allGenres.forEach(g => {
      const filtered = items.filter(i => i.genres.includes(g));
      if (filtered.length > 2) genreCats.push({ title: g, items: shuffleArray(filtered), icon: null });
    });

    return [...cats, ...shuffleArray(genreCats)];
  }, [items, sagas, searchQuery, t]);

  const rawDisplayItems = searchQuery 
    ? items.filter(i => 
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (i.displayTitle && i.displayTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        i.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (selectedCategory ? selectedCategory.items : []);

  const availableGenres = useMemo(() => Array.from(new Set(rawDisplayItems.flatMap(i => i.genres || []))).sort(), [rawDisplayItems]);
  const availableQualities = useMemo(() => Array.from(new Set(rawDisplayItems.map(i => i.videoQuality).filter(q => q && q !== 'N/A'))).sort((a, b) => b.localeCompare(a)), [rawDisplayItems]);
  const availableLanguages = useMemo(() => Array.from(new Set(rawDisplayItems.flatMap(i => i.language ? i.language.split(',').map(l => l.trim()) : []).filter(l => l !== 'N/A'))).sort(), [rawDisplayItems]);
  const availableYears = useMemo(() => Array.from(new Set(rawDisplayItems.map(i => i.year).filter(y => y && y !== '?' && y !== 'N/A'))).sort((a, b) => parseInt(b) - parseInt(a)), [rawDisplayItems]);

  const processedDisplayItems = useMemo(() => {
    let result = [...rawDisplayItems];
    if (filterGenres.length > 0) result = result.filter(i => i.genres?.some(g => filterGenres.includes(g)));
    if (filterQualities.length > 0) result = result.filter(i => filterQualities.includes(i.videoQuality));
    if (filterLanguages.length > 0) result = result.filter(i => i.language && i.language.split(',').map(l => l.trim()).some(l => filterLanguages.includes(l)));
    if (filterYears.length > 0) result = result.filter(i => filterYears.includes(i.year?.toString()));

    if (sortBy === 'az') result.sort((a, b) => (a.displayTitle || a.title).localeCompare(b.displayTitle || b.title));
    else if (sortBy === 'za') result.sort((a, b) => (b.displayTitle || b.title).localeCompare(a.displayTitle || a.title));
    else if (sortBy === 'rating') result.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
    else if (sortBy === 'year') result.sort((a, b) => parseInt(b.year || 0) - parseInt(a.year || 0));

    return result;
  }, [rawDisplayItems, filterGenres, filterQualities, filterLanguages, filterYears, sortBy]);

  const sagaItems = useMemo(() => {
     if (!selectedItem || selectedItem.isSaga || !selectedItem.collection) return [];
     return items.filter(i => !i.isSaga && i.collection?.id === selectedItem.collection.id && i.id !== selectedItem.id);
  }, [selectedItem, items]);

  const renderFiltersAndSorting = () => {
    const hasActiveFilters = filterGenres.length > 0 || filterQualities.length > 0 || filterLanguages.length > 0 || filterYears.length > 0;
    return (
      <div className="flex flex-col gap-3 md:gap-4 w-full lg:w-auto mt-4 md:mt-0">
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full">
            <div className="relative flex-1 min-w-[130px] lg:flex-none">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                <select value="default" onChange={e => { if (e.target.value !== 'default' && !filterGenres.includes(e.target.value)) setFilterGenres([...filterGenres, e.target.value]); }} className="appearance-none bg-neutral-900 border border-white/20 text-xs md:text-sm rounded-lg pl-8 pr-3 py-2 text-white outline-none focus:border-[#e5a00d] w-full truncate">
                    <option value="default" disabled>{t.filtro_genero}</option>
                    {availableGenres.filter(g => !filterGenres.includes(g)).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
            </div>
            <div className="relative flex-1 min-w-[150px] lg:flex-none">
                <ArrowDownWideNarrow className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="appearance-none bg-neutral-900 border border-white/20 text-xs md:text-sm rounded-lg pl-8 pr-3 py-2 text-white outline-none focus:border-[#e5a00d] w-full truncate">
                <option value="default">{t.orden_defecto}</option>
                <option value="az">{t.orden_az}</option>
                <option value="za">{t.orden_za}</option>
                <option value="rating">{t.orden_rating}</option>
                <option value="year">{t.orden_year}</option>
                </select>
            </div>
        </div>
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-1">
             <button onClick={() => { setFilterGenres([]); setFilterQualities([]); setFilterLanguages([]); setFilterYears([]); }} className="text-[11px] text-[#e5a00d] underline transition-colors">{t.limpiar}</button>
          </div>
        )}
      </div>
    );
  };

  const renderGridOrList = (arrayToRender) => {
    if (arrayToRender.length === 0) return <div className="text-gray-500 font-medium py-10 text-center w-full">Sin resultados.</div>;

    if (viewMode === 'list') {
      return (
        <div className="flex flex-col gap-3 md:gap-4 w-full">
          {arrayToRender.map(item => (
            <div key={item.id} className="group cursor-pointer flex gap-4 md:gap-6 bg-neutral-900/30 hover:bg-neutral-800/60 border border-white/5 rounded-xl p-3 md:p-4 transition-all" onClick={() => openModal(item)}>
               <div className="w-20 md:w-28 shrink-0 aspect-[2/3] rounded-lg overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                 <LazyImage src={item.image} alt={item.displayTitle || item.title} className="w-full h-full object-cover" />
               </div>
               <div className="flex flex-col justify-center flex-1">
                 <h4 className="font-bold text-sm md:text-xl text-white mb-1 md:mb-2 group-hover:text-[#e5a00d] transition-colors">{item.displayTitle || item.title}</h4>
                 {!item.isSaga && (
                   <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm text-gray-400 mb-2 md:mb-3">
                     <span className="font-bold text-white">{item.year}</span>
                     {item.rating && item.rating !== 'N/A' && <span className="flex items-center gap-1 text-[#e5a00d]"><Star size={12} fill="currentColor"/> {item.rating}</span>}
                     {item.videoQuality && <span className="border border-gray-600 px-1.5 py-0.5 rounded text-[10px] md:text-xs">{item.videoQuality}</span>}
                     <span className="hidden sm:inline">•</span>
                     <span className="hidden sm:inline">{item.genres?.join(', ')}</span>
                   </div>
                 )}
                 {item.isSaga && <div className="text-xs md:text-sm text-[#e5a00d] font-bold tracking-widest mb-2 uppercase">{t.coleccion_oficial}</div>}
                 <p className="text-xs md:text-sm text-gray-500 line-clamp-2 md:line-clamp-3">{item.description}</p>
               </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-6">
        {arrayToRender.map(item => (
          <div key={item.id} className="group cursor-pointer flex flex-col" onClick={() => openModal(item)}>
            <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-neutral-900 group-hover:scale-105 transition-transform duration-300 shadow-xl">
              <LazyImage src={item.image} alt={item.displayTitle || item.title} className="w-full h-full object-cover" />
            </div>
            <h4 className="mt-2 md:mt-3 font-bold text-[11px] md:text-sm line-clamp-2 pb-1 pr-1 group-hover:text-[#e5a00d] transition-colors">{item.displayTitle || item.title}</h4>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
      return (
          <div className="h-screen flex flex-col items-center justify-center gap-5">
            <div className="w-12 h-12 border-4 border-[#e5a00d] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium animate-pulse">{t.sinc_biblio}</p>
          </div>
      );
  }

  return (
    <div className="animate-in fade-in duration-300">
        {heroItem && !searchQuery && !selectedCategory && (
        <div className="relative h-[65vh] md:h-[85vh] w-full mb-6 md:mb-12 overflow-hidden">
            <img src={heroItem.backdrop} className="w-full h-full object-cover object-top sm:object-center opacity-90 md:opacity-100" alt="Hero Banner" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-[#0f0f0f]/80 md:via-[#0f0f0f]/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/20 md:via-transparent to-transparent"></div>
            
            {/* Ajuste de márgenes en el contenedor del Hero */}
            <div className="absolute bottom-6 md:bottom-20 left-4 md:left-12 right-0 z-10 flex flex-col justify-end pt-24 pr-6">
                <div className="flex items-center gap-2 text-[#e5a00d] font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] mb-2 md:mb-4">
                    <Film size={14} /> {t.recomendado_para_ti}
                </div>
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2 md:mb-4 leading-tight drop-shadow-2xl pr-4">
                    {heroItem.displayTitle || heroItem.title}
                </h1>
                {/* Aquí está la corrección del margen derecho de la descripción */}
                <p className="text-gray-300 text-xs sm:text-sm md:text-base lg:text-lg line-clamp-3 font-light mb-4 md:mb-6 max-w-xl leading-relaxed pr-8 md:pr-0">
                    {heroItem.description}
                </p>
                <button onClick={() => openModal(heroItem)} className="flex items-center justify-center gap-2 md:gap-3 bg-[#e5a00d] hover:bg-[#c9890a] text-black font-extrabold py-2 md:py-3 px-6 md:px-8 rounded-full transition-all hover:scale-105 shadow-2xl w-max text-xs md:text-base">
                    <Info size={18} /> {t.ver_detalles}
                </button>
            </div>
        </div>
        )}

        <div className={searchQuery || selectedCategory ? 'pt-36 md:pt-32 px-4 md:px-12' : 'relative z-20 -mt-8 md:-mt-16'}>
            {searchQuery || selectedCategory ? (
                <div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
                    <h2 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2">
                        {selectedCategory && <button onClick={() => setSelectedCategory(null)} className="mr-2 text-gray-400 hover:text-[#e5a00d] transition-colors"><ChevronLeft size={28}/></button>}
                        {searchQuery ? t.resultados : selectedCategory.title}
                    </h2>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        {renderFiltersAndSorting()}
                        <div className="flex items-center gap-1 bg-neutral-900/80 p-1 rounded-lg border border-white/5">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 md:p-2 rounded-md ${viewMode === 'grid' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><Grid size={16}/></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 md:p-2 rounded-md ${viewMode === 'list' ? 'bg-[#e5a00d] text-black shadow' : 'text-gray-400 hover:text-white'}`}><ListIcon size={16}/></button>
                        </div>
                    </div>
                    </div>
                    {renderGridOrList(processedDisplayItems.slice(0, visibleCount))}
                    {processedDisplayItems.length > visibleCount && (
                    <div className="flex justify-center mt-10">
                        <button onClick={() => setVisibleCount(v => v + 100)} className="bg-neutral-800 hover:bg-[#e5a00d] text-white hover:text-black font-bold py-3 px-8 rounded-full border border-white/10 hover:scale-105 text-sm md:text-base">
                            {t.cargar_mas}
                        </button>
                    </div>
                    )}
                </div>
            ) : (
                categoriesData.map((cat, idx) => (
                    <MovieRow key={idx} title={cat.title} items={cat.items} onSelect={openModal} onCategoryClick={setSelectedCategory} icon={cat.icon} eager={idx === 0} t={t} />
                ))
            )}
        </div>

        {/* MODAL CON DETALLES RECUPERADOS */}
        {selectedItem && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
                <div className="absolute inset-0" onClick={closeModal}></div>
                <div className="bg-[#1a1a1c] w-full h-full md:h-auto md:max-w-6xl md:rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] relative flex flex-col sm:flex-row max-h-[100vh] sm:max-h-[95vh] animate-in zoom-in-95 duration-300">
                    <button onClick={closeModal} className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-[#e5a00d] text-white hover:text-black rounded-full transition-all"><X size={24} /></button>
                    <div className="w-full sm:w-[300px] lg:w-[400px] relative shrink-0 h-[35vh] sm:h-auto bg-black">
                        <img src={selectedItem.image} className="w-full h-full object-contain sm:object-cover" alt="Poster" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1c] via-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-[#1a1a1c]"></div>
                    </div>
                    
                    <div className="flex-1 p-6 md:p-10 flex flex-col overflow-y-auto">
                        {selectedItem.isSaga ? (
                            <div className="flex flex-col flex-1">
                                <div className="text-[#e5a00d] font-bold text-xs md:text-sm mb-2 flex items-center gap-1 uppercase tracking-widest"><Layers size={14}/> {t.coleccion_oficial}</div>
                                <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-snug pb-2">{selectedItem.displayTitle || selectedItem.title}</h2>
                                <p className="text-gray-400 text-sm md:text-base lg:text-lg font-light leading-relaxed mb-8">{t.pelis_biblioteca?.split(' (')[0]}</p>
                                <div className="mt-4 flex flex-col gap-8 shrink-0 pb-4">
                                   <div className="w-full">
                                      <h4 className="text-white font-bold text-sm md:text-base mb-4 border-b border-white/10 pb-2">{t.pelis_biblioteca} ({selectedItem.movies?.length})</h4>
                                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                                         {selectedItem.movies?.map(movie => (
                                            <div key={movie.id} className="cursor-pointer group flex flex-col" onClick={() => openModal(movie)}>
                                               <div className="aspect-[2/3] rounded-md overflow-hidden relative shadow-lg">
                                                   <LazyImage src={movie.image} alt={movie.displayTitle || movie.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                               </div>
                                               <p className="text-[11px] md:text-xs font-semibold text-gray-200 mt-2 line-clamp-2 leading-normal pb-1 group-hover:text-[#e5a00d]">{movie.displayTitle || movie.title}</p>
                                               <p className="text-[9px] md:text-[10px] text-gray-500">{movie.year}</p>
                                            </div>
                                         ))}
                                      </div>
                                   </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col flex-1">
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {selectedItem.genres?.map(g => (
                                    <span key={g} className="text-[#e5a00d] text-[10px] md:text-xs font-black uppercase tracking-widest">{g}</span>
                                  ))}
                                </div>
                                {selectedItem.collection && (
                                    <div className="text-gray-400 font-bold text-xs md:text-sm mb-2 flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => openModal(sagas.find(s => s.id === `saga-${selectedItem.collection.id}`))}>
                                        <Layers size={14}/> {selectedItem.collection.name} <ChevronRight size={14}/>
                                    </div>
                                )}
                                <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-snug pb-2">{selectedItem.displayTitle || selectedItem.title}</h2>
                                <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{t.año}</span>
                                    <span className="text-white font-bold">{selectedItem.year}</span>
                                  </div>
                                  <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2"></div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">TMDB</span>
                                    <span className="text-white font-bold flex items-center gap-1"><Star size={14} className="text-[#e5a00d]" fill="currentColor"/> {selectedItem.rating}</span>
                                  </div>
                                  <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2"></div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{t.calidad}</span>
                                    <span className={`inline-flex items-center justify-center leading-none px-2 py-1 rounded text-[10px] md:text-[11px] font-black mt-1 uppercase border ${selectedItem.videoQuality === '4K' ? 'bg-[#e5a00d] text-black border-[#e5a00d]' : 'bg-white/10 text-white border-white/20'}`}>
                                        {selectedItem.videoQuality}
                                    </span>
                                  </div>
                                  <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2"></div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{t.idiomas}</span>
                                    <span className="text-gray-300 font-medium text-xs md:text-sm mt-1">{selectedItem.language}</span>
                                  </div>
                                </div>
                                <p className="text-gray-400 text-sm md:text-base lg:text-lg font-light leading-relaxed mb-8">{selectedItem.description}</p>
                                
                                {selectedItem.link !== '#' ? (
                                   <a href={selectedItem.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-[#e5a00d] hover:bg-[#c9890a] text-black font-black py-4 px-6 md:px-10 rounded-full text-sm md:text-lg transition-all hover:scale-105 shadow-xl shadow-[#e5a00d]/10 w-full md:w-max group shrink-0">
                                     <Download size={22} className="group-hover:translate-y-1 transition-transform" /> {t.descargar}
                                   </a>
                                ) : (
                                   <button disabled className="flex items-center justify-center gap-3 bg-neutral-800 text-gray-500 font-black py-4 px-6 md:px-10 rounded-full text-sm md:text-lg cursor-not-allowed w-full md:w-max shrink-0">
                                     <AlertTriangle size={22} /> {t.enlace_no_disp}
                                   </button>
                                )}
                                
                                <div className="mt-12 flex flex-col gap-2 shrink-0 pb-4">
                                   {sagaItems.length > 0 && (
                                      <MovieRow 
                                          title={t.mas_saga}
                                          items={sagaItems} 
                                          onSelect={openModal} 
                                          icon={<Layers size={18} />} 
                                          isModal={true}
                                          onTitleClick={() => openModal(sagas.find(s => s.id === `saga-${selectedItem.collection.id}`))}
                                          t={t}
                                      />
                                   )}
                                   {items.filter(i => !i.isSaga && i.id !== selectedItem.id && i.genres?.some(g => selectedItem.genres?.includes(g))).length > 0 && (
                                      <MovieRow 
                                          title={t.titulos_similares}
                                          items={shuffleArray(items.filter(i => !i.isSaga && i.id !== selectedItem.id && i.genres?.some(g => selectedItem.genres?.includes(g))))} 
                                          onSelect={openModal} 
                                          icon={<Star size={18} />} 
                                          isModal={true}
                                          t={t}
                                      />
                                   )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}