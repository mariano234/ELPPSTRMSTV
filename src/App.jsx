import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Catalog from './pages/Catalog';
import Live from './pages/Live';
import Upcoming from './pages/Upcoming';

// Componente para interceptar el viejo Redirect URI de Discord
function RootRedirect() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const code = searchParams.get('code');
  
  // Si la URL venía del Discord antiguo (/?tab=directos&code=...) lo redirigimos a la página nueva
  if (tab === 'directos' || code) {
      return <Navigate to={`/directos${code ? `?code=${code}` : ''}`} replace />;
  }
  return <Navigate to="/inicio" replace />;
}

export default function App() {
  const [appLang, setAppLang] = useState(localStorage.getItem('elpepestreams_lang') || 'es');

  useEffect(() => {
    localStorage.setItem('elpepestreams_lang', appLang);
  }, [appLang]);

  // Recuperamos el logo de las palomitas y el título de la pestaña
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
          <Route path="/directos" element={<Live appLang={appLang} />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </div>
    </Router>
  );
}