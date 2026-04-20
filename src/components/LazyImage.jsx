import React, { useState, useRef, useEffect } from 'react';

export default function LazyImage({ src, alt, className, eager = false }) {
  const [isVisible, setIsVisible] = useState(eager);
  const imgRef = useRef(null);

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
    if (imgRef.current) observer.observe(imgRef.current);
    return () => { if (observer) observer.disconnect(); };
  }, [eager]);

  return (
    <div ref={imgRef} className={`w-full h-full bg-neutral-900 ${!isVisible ? 'animate-pulse' : ''}`}>
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${eager ? '' : 'transition-opacity duration-500 opacity-0'}`}
          onLoad={(e) => { if (!eager) e.target.classList.remove('opacity-0'); }}
          loading={eager ? "eager" : "lazy"}
        />
      )}
    </div>
  );
}