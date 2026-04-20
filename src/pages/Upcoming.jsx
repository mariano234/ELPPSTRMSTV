import React from 'react';
import { Tv } from 'lucide-react';
import { UI_TRANSLATIONS } from '../config';

export default function Upcoming({ appLang }) {
    const t = UI_TRANSLATIONS[appLang] || UI_TRANSLATIONS['es'];

    return (
        <div className="pt-32 px-4 md:px-12 flex flex-col items-center justify-center text-center h-[70vh] animate-in zoom-in-95 duration-500">
            <div className="bg-neutral-900/50 p-6 rounded-full border border-white/5 mb-6 shadow-2xl">
                <Tv size={80} className="text-[#e5a00d]" />
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter">{t.proximamente}</h2>
            <p className="text-gray-400 text-lg md:text-xl max-w-xl font-light">{t.prep_series}</p>
        </div>
    );
}