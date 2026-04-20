import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Home, Film, Tv, Radio, Globe, ChevronRight, X } from 'lucide-react';
import { UI_TRANSLATIONS } from '../config';

export default function Navbar({ appLang, setAppLang }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  
  const langMenuRef = useRef(null);
  const t = UI_TRANSLATIONS[appLang] || UI_TRANSLATIONS['es'];

  const currentQuery = searchParams.get('q') || "";
  const [localQuery, setLocalQuery] = useState(currentQuery);

  useEffect(() => {
    setLocalQuery(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    const handleClickOutside = (event) => {
        if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
            setIsLangMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
        window.removeEventListener('scroll', handleScroll);
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogoClick = () => {
      setLocalQuery("");
      setIsMobileSearchOpen(false);
      navigate("/inicio");
  };

  const handleSearchSubmit = (value) => {
      setLocalQuery(value);
      if (value) {
          navigate(`/inicio?q=${encodeURIComponent(value)}`);
      } else {
          navigate(`/inicio`);
      }
  };

  const clearSearch = () => {
      setLocalQuery("");
      navigate(`/inicio`);
  };

  const toggleMobileSearch = () => {
      if (isMobileSearchOpen) {
          setIsMobileSearchOpen(false);
          clearSearch();
      } else {
          setIsMobileSearchOpen(true);
      }
  };

  const isActive = (path) => location.pathname.includes(path);
  const showSearch = isActive('/inicio') || isActive('/pelis');

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 w-full ${isScrolled || isMobileSearchOpen ? 'bg-[#141414]/95 backdrop-blur-md shadow-2xl border-b border-white/5' : 'bg-gradient-to-b from-black/90 via-black/50 to-transparent'}`}>
      <div className="px-4 md:px-12 py-3 flex flex-col gap-3">
        
        <div className="flex items-center justify-between w-full">
           <div className="flex items-center gap-6">
              <div onClick={handleLogoClick} className="flex items-center gap-1 text-[#e5a00d] font-black text-2xl md:text-3xl tracking-tighter shrink-0 cursor-pointer group">
                <ChevronRight size={28} className="-mr-2 md:-mr-3 group-hover:translate-x-1 transition-transform" />
                <span>ElPepe<span className="text-white font-light">Streams</span></span>
              </div>
              
              <div className="hidden lg:flex items-center gap-4 text-sm font-bold tracking-wide">
                 <Link to="/inicio" className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${isActive('/inicio') ? 'text-[#e5a00d] bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Home size={16} /> {t.inicio}</Link>
                 <Link to="/pelis" className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${isActive('/pelis') ? 'text-[#e5a00d] bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Film size={16} /> {t.pelis}</Link>
                 <Link to="/series" className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${isActive('/series') ? 'text-[#e5a00d] bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Tv size={16} /> {t.series}</Link>
                 <Link to="/directos" className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${isActive('/directos') ? 'text-[#e5a00d] bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Radio size={16} /> {t.directos}</Link>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              {showSearch && (
                  <div className="hidden lg:block relative group w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#e5a00d] transition-colors" size={16} />
                    <input type="text" placeholder={t.buscar} value={localQuery} onChange={(e) => handleSearchSubmit(e.target.value)} className="bg-neutral-900/60 border border-white/10 rounded-full py-2 pl-9 pr-4 w-full focus:outline-none focus:border-[#e5a00d] focus:bg-black transition-all text-sm backdrop-blur-sm" />
                  </div>
              )}

              {showSearch && (
                  <div className="lg:hidden">
                      <div className={`p-2 rounded-full border border-white/10 cursor-pointer transition-all flex items-center justify-center ${isMobileSearchOpen ? 'bg-[#e5a00d] text-black border-[#e5a00d]' : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'}`} onClick={toggleMobileSearch}>
                          <Search size={18} />
                      </div>
                  </div>
              )}
              
              <div className="relative group shrink-0" ref={langMenuRef}>
                 <div className={`bg-white/5 hover:bg-white/10 p-2 rounded-full border border-white/10 cursor-pointer transition-all flex items-center justify-center ${isLangMenuOpen ? 'bg-white/10 ring-1 ring-white/20' : ''}`} onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}>
                    <Globe size={18} className="text-gray-300 group-hover:text-white transition-colors" />
                 </div>
                 
                 {isLangMenuOpen && (
                    <div className="absolute right-0 mt-3 w-40 bg-[#141414] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                       {[ { code: 'es', label: 'Castellano' }, { code: 'ca', label: 'Català / Valencià' }, { code: 'gl', label: 'Galego' }, { code: 'eu', label: 'Euskara' } ].map(lang => (
                          <button key={lang.code} onClick={() => { setAppLang(lang.code); setIsLangMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2 ${appLang === lang.code ? 'text-[#e5a00d] bg-[#e5a00d]/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                             {appLang === lang.code && <span className="w-1.5 h-1.5 rounded-full bg-[#e5a00d] shrink-0"></span>}
                             <span className={appLang === lang.code ? '' : 'ml-3'}>{lang.label}</span>
                          </button>
                       ))}
                    </div>
                 )}
              </div>
           </div>
        </div>

        <div className="flex lg:hidden items-center justify-center w-full min-h-[38px] overflow-hidden">
           {isMobileSearchOpen && showSearch ? (
               <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300 mb-2">
                  <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input autoFocus type="text" placeholder={t.buscar} value={localQuery} onChange={(e) => handleSearchSubmit(e.target.value)} className="bg-[#1a1a1c] border border-white/20 rounded-full py-2 pl-9 pr-10 w-full focus:outline-none focus:border-[#e5a00d] text-sm text-white shadow-2xl" />
                      {localQuery && (
                          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"><X size={16} /></button>
                      )}
                  </div>
               </div>
           ) : (
               <div className="flex items-center justify-center gap-3 sm:gap-6 overflow-x-auto scrollbar-hide text-[10px] font-bold w-full animate-in fade-in slide-in-from-left-4 duration-300 pb-1">
                   <Link to="/inicio" className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors border ${isActive('/inicio') ? 'text-black bg-[#e5a00d] border-[#e5a00d]' : 'text-gray-400 bg-white/5 border-white/5'}`}>{t.inicio}</Link>
                   <Link to="/pelis" className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors border ${isActive('/pelis') ? 'text-black bg-[#e5a00d] border-[#e5a00d]' : 'text-gray-400 bg-white/5 border-white/5'}`}>{t.pelis}</Link>
                   <Link to="/series" className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors border ${isActive('/series') ? 'text-black bg-[#e5a00d] border-[#e5a00d]' : 'text-gray-400 bg-white/5 border-white/5'}`}>{t.series}</Link>
                   <Link to="/directos" className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors border ${isActive('/directos') ? 'text-black bg-[#e5a00d] border-[#e5a00d]' : 'text-gray-400 bg-white/5 border-white/5'}`}>{t.directos}</Link>
               </div>
           )}
        </div>
      </div>
    </nav>
  );
}