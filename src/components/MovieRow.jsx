import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Monitor, Star, Grid } from 'lucide-react';
import LazyImage from './LazyImage';

export default function MovieRow({ title, items, onSelect, onCategoryClick, onTitleClick, icon, isModal = false, eager = false, t }) {
  const rowRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(eager); 
  const [showArrows, setShowArrows] = useState(false);
  
  useEffect(() => {
    if (eager) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { if (observer) observer.disconnect(); };
  }, [eager]);

  useEffect(() => {
    const checkArrows = () => {
      if (rowRef.current) {
        setShowArrows(rowRef.current.scrollWidth > rowRef.current.clientWidth + 10);
      }
    };

    if (isVisible) {
      checkArrows();
      window.addEventListener('resize', checkArrows);
      const timer = setTimeout(checkArrows, 100); 
      return () => {
        window.removeEventListener('resize', checkArrows);
        clearTimeout(timer);
      };
    }
  }, [isVisible, items]);

  const scroll = (direction) => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth + 100 : scrollLeft + clientWidth - 100;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  const MAX_NORMAL = 11;
  const SMART_LIMIT = 15; 
  
  let displayItems, hasMore;

  if (isModal) {
    displayItems = items.slice(0, 15);
    hasMore = false;
  } else {
    if (items.length <= SMART_LIMIT) {
       displayItems = items;
       hasMore = false;
    } else {
       displayItems = items.slice(0, MAX_NORMAL);
       hasMore = true;
    }
  }

  const cardWidthClasses = isModal 
    ? "w-24 sm:w-28 md:w-32 lg:w-36 xl:w-40" 
    : "w-28 sm:w-36 md:w-40 lg:w-48 xl:w-52 2xl:w-56";

  return (
    <div ref={containerRef} className={`${isModal ? 'mb-4' : 'mb-6 md:mb-10'} relative group/row min-h-[180px]`}>
      <h3 
        onClick={() => {
          if (onTitleClick) onTitleClick();
          else if (!isModal) onCategoryClick({title, items, icon});
        }}
        className={`${isModal ? 'text-base md:text-xl px-2' : 'text-lg md:text-2xl px-4 md:px-12'} font-bold text-gray-100 mb-0 md:mb-1 flex items-center gap-2 ${(!isModal || onTitleClick) ? 'hover:text-[#e5a00d] cursor-pointer' : ''} transition-colors w-max`}
      >
        {icon && <span className="text-[#e5a00d] mr-1">{icon}</span>}
        {title} 
        {(!isModal || onTitleClick) && <ChevronRight size={24} className="text-[#e5a00d] opacity-0 group-hover/row:opacity-100 transition-opacity" />}
      </h3>
      
      {isVisible ? (
        <>
          {showArrows && (
            <button onClick={() => scroll('left')} className="absolute left-0 top-[50%] -translate-y-1/2 z-20 bg-black/80 hover:bg-[#e5a00d] text-white p-2 md:p-4 rounded-r-xl opacity-0 group-hover/row:opacity-100 transition-all hidden md:block backdrop-blur-md border-r border-y border-white/10">
              <ChevronLeft size={28} />
            </button>
          )}
          
          {showArrows && (
            <button onClick={() => scroll('right')} className="absolute right-0 top-[50%] -translate-y-1/2 z-20 bg-black/80 hover:bg-[#e5a00d] text-white p-2 md:p-4 rounded-l-xl opacity-0 group-hover/row:opacity-100 transition-all hidden md:block backdrop-blur-md border-l border-y border-white/10">
              <ChevronRight size={28} />
            </button>
          )}

          <div ref={rowRef} className={`flex overflow-x-auto gap-3 md:gap-6 pt-3 md:pt-6 ${isModal ? 'px-2 pb-2 scroll-pl-2' : 'px-4 md:px-12 pb-4 md:pb-6 scroll-pl-4 md:scroll-pl-12'} scrollbar-hide snap-x`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {displayItems.map((item) => (
              <div key={item.id} className={`snap-start shrink-0 ${cardWidthClasses} relative cursor-pointer group transition-all duration-300 flex flex-col`} onClick={() => onSelect(item)}>
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/5 bg-neutral-900 shadow-lg group-hover:scale-105 group-hover:border-[#e5a00d]/50 transition-all duration-300">
                  <LazyImage src={item.image} alt={item.displayTitle || item.title} className="w-full h-full object-cover group-hover:opacity-40" eager={eager} />
                  
                  <div className="absolute inset-0 p-2 md:p-4 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black via-transparent to-transparent">
                     <div className="flex flex-col gap-1 md:gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        <div className="flex items-center gap-1 flex-wrap">
                            {!item.isSaga && (
                              <span className={`backdrop-blur-md text-[9px] md:text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border ${item.videoQuality === '4K' ? 'bg-[#e5a00d]/90 text-black border-[#e5a00d]' : 'bg-white/20 text-white border-white/20'}`}>
                                  <Monitor size={10} /> {item.videoQuality}
                              </span>
                            )}
                            {!item.isSaga && item.rating && item.rating !== 'N/A' && item.rating !== '0.0' && (
                              <span className="backdrop-blur-md text-[9px] md:text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border bg-black/60 text-[#e5a00d] border-[#e5a00d]/50">
                                  <Star size={10} fill="currentColor" /> {item.rating}
                              </span>
                            )}
                        </div>
                     </div>
                  </div>
                </div>
                <h3 className={`mt-2 md:mt-3 ${isModal ? 'text-[11px] md:text-xs' : 'text-xs md:text-sm'} font-semibold text-gray-200 line-clamp-2 leading-normal pb-1 pr-1 group-hover:text-[#e5a00d] transition-colors`}>{item.displayTitle || item.title}</h3>
                {!item.isSaga && <div className="text-[10px] md:text-xs text-gray-500 font-medium">{item.year}</div>}
                {item.isSaga && <div className="text-[10px] md:text-xs text-[#e5a00d] font-medium tracking-wide">{t?.coleccion_oficial || 'COLECCIÓN'}</div>}
              </div>
            ))}

            {hasMore && (
              <div 
                className={`snap-start shrink-0 ${cardWidthClasses} relative cursor-pointer group transition-all duration-300 flex flex-col`} 
                onClick={() => onCategoryClick({title, items, icon})}
              >
                <div className="relative aspect-[2/3] w-full rounded-lg border border-white/10 bg-neutral-900/40 hover:bg-neutral-800 transition-all duration-300 flex flex-col items-center justify-center gap-2 md:gap-3 text-gray-400 hover:text-[#e5a00d] shadow-lg">
                   <div className="p-3 md:p-4 rounded-full bg-black/40 group-hover:scale-110 transition-transform">
                     <Grid size={28} className="md:w-8 md:h-8" />
                   </div>
                   <span className="font-bold text-xs md:text-sm text-center px-2">{t?.ver_todos || 'Ver todos'} ({items.length})</span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={`flex gap-3 md:gap-6 pt-3 md:pt-6 ${isModal ? 'px-2' : 'px-4 md:px-12'} overflow-hidden`}>
           {[...Array(6)].map((_, i) => (
             <div key={i} className={`shrink-0 ${cardWidthClasses} aspect-[2/3] bg-neutral-900/40 rounded-lg animate-pulse`}></div>
           ))}
        </div>
      )}
    </div>
  );
}