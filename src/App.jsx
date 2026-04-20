import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Catalog from './pages/Catalog';
import Live from './pages/Live';
import Upcoming from './pages/Upcoming';

export default function App() {
  const [appLang, setAppLang] = useState(localStorage.getItem('elpepestreams_lang') || 'es');

  useEffect(() => {
    localStorage.setItem('elpepestreams_lang', appLang);
  }, [appLang]);

  return (
    <Router>
      <div className="bg-[#0f0f0f] text-gray-200 font-sans min-h-screen overflow-x-hidden pb-20 selection:bg-[#e5a00d] selection:text-black">
        {/* El Navbar siempre está visible, independientemente de la ruta */}
        <Navbar appLang={appLang} setAppLang={setAppLang} />

        {/* Las Rutas deciden qué componente renderizar */}
        <Routes>
          <Route path="/" element={<Navigate to="/inicio" replace />} />
          <Route path="/inicio" element={<Catalog appLang={appLang} category="inicio" />} />
          <Route path="/pelis" element={<Catalog appLang={appLang} category="pelis" />} />
          <Route path="/series" element={<Upcoming appLang={appLang} />} />
          <Route path="/directos" element={<Live appLang={appLang} />} />
        </Routes>
      </div>
    </Router>
  );
}