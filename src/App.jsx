import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Catalog from './pages/Catalog';
import Upcoming from './pages/Upcoming';

const Live = lazy(() => import('./pages/Live'));

function RootRedirect() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  
  if (tab === 'directos' || searchParams.has('code')) {
      return <Navigate to="/directos" replace />;
  }
  return <Navigate to="/inicio" replace />;
}

export default function App() {
  const [appLang, setAppLang] = useState(() => {
    try { return localStorage.getItem('elpepestreams_lang') || 'es'; } catch { return 'es'; }
  });

  useEffect(() => {
    document.documentElement.lang = appLang;
    try { localStorage.setItem('elpepestreams_lang', appLang); } catch { /* Storage is optional. */ }
  }, [appLang]);

  useEffect(() => {
    document.title = "ElPepeStreams";
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍿</text></svg>";
  }, []);

  return (
    <Router>
      <div className="bg-[#0f0f0f] text-gray-200 font-sans min-h-screen overflow-x-hidden pb-20 selection:bg-[#e5a00d] selection:text-black">
        
        <Navbar appLang={appLang} setAppLang={setAppLang} />

        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/inicio" element={<Catalog appLang={appLang} category="inicio" />} />
          <Route path="/pelis" element={<Catalog appLang={appLang} category="pelis" />} />
          <Route path="/series" element={<Upcoming appLang={appLang} />} />
          <Route path="/directos" element={<Suspense fallback={<p role="status" className="pt-36 text-center">Cargando Directos…</p>}><Live appLang={appLang} /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </div>
    </Router>
  );
}
