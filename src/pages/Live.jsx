import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Server, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import NativeStreamPlayer from '../components/NativeStreamPlayer';
import { UI_TRANSLATIONS, API_BASE, STREAM_CHANNEL } from '../config';

let isFetchingDiscord = false;

export default function Live({ appLang }) {
  const [searchParams] = useSearchParams();
  const t = UI_TRANSLATIONS[appLang] || UI_TRANSLATIONS['es'];
  const code = searchParams.get('code');

  const [streamPassword, setStreamPassword] = useState("••••••••••••");
  const [streamSid, setStreamSid] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [usePatreon, setUsePatreon] = useState(false); 

  useEffect(() => {
    const savedPassword = sessionStorage.getItem('stream_password');
    const savedSid = sessionStorage.getItem('stream_sid');
    const authTime = sessionStorage.getItem('stream_auth_time');

    const CACHE_LIFETIME = 12 * 60 * 60 * 1000;
    const isCacheValid = authTime && (Date.now() - parseInt(authTime) < CACHE_LIFETIME);

    if (savedPassword && isCacheValid) {
        setStreamPassword(savedPassword);
        if (savedSid) {
            setStreamSid(savedSid);
            setUsePatreon(true); 
        }
    } else {
        sessionStorage.removeItem('stream_password');
        sessionStorage.removeItem('stream_sid');
        sessionStorage.removeItem('stream_auth_time');
    }

    if (code) {
        if (isFetchingDiscord) return;
        isFetchingDiscord = true;
        setIsVerifying(true);
        setStreamPassword(t.verificando);
        
        fetch(`${API_BASE}/verificar?code=${code}`)
            .then(async res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if(data.success && data.password) {
                    let cleanText = data.password.replace(/[*`]/g, '').trim().replace(/^['"]|['"]$/g, '');
                    let finalPass = "";
                    let finalSid = null;

                    const lines = cleanText.split('\n');
                    for (const line of lines) {
                        const lowerLine = line.toLowerCase();
                        if (lowerLine.includes('contraseña:') || lowerLine.includes('contrasena:')) {
                            finalPass = line.substring(lowerLine.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '');
                        } else if (lowerLine.includes('cookie:')) {
                            let rawSid = line.substring(lowerLine.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '');
                            if (rawSid.includes('angelthump.sid=')) rawSid = rawSid.split('angelthump.sid=')[1].trim();
                            if (rawSid) finalSid = rawSid.split(';')[0].trim(); 
                        }
                    }

                    if (!finalPass && !finalSid) {
                        if (cleanText.includes('|')) {
                            const parts = cleanText.split('|');
                            finalPass = parts[0].trim().replace(/^['"]|['"]$/g, '');
                            let rawSid = parts[1] ? parts[1].trim().replace(/^['"]|['"]$/g, '') : null;
                            if (rawSid && rawSid.includes('angelthump.sid=')) rawSid = rawSid.split('angelthump.sid=')[1].trim();
                            if (rawSid) finalSid = rawSid.split(';')[0].trim(); 
                        } else {
                            finalPass = cleanText.replace(/Contrase.*?:/i, '').trim().replace(/^['"]|['"]$/g, '');
                        }
                    }

                    setStreamPassword(finalPass || t.sin_pass);
                    sessionStorage.setItem('stream_password', finalPass || t.sin_pass);
                    sessionStorage.setItem('stream_auth_time', Date.now().toString());
                    
                    if (finalSid) {
                        setStreamSid(finalSid);
                        sessionStorage.setItem('stream_sid', finalSid);
                        setUsePatreon(true);
                    }
                } else {
                    setStreamPassword("❌ " + (data.error || "Rol Denegado"));
                }
            })
            .catch(err => setStreamPassword("❌ Error Backend"))
            .finally(() => { setIsVerifying(false); isFetchingDiscord = false; });
    }
  }, [code]);

  const isLogged = streamPassword && !streamPassword.includes('❌') && !streamPassword.includes('••••') && !streamPassword.includes('Verificando') && !streamPassword.includes('Verificant') && !streamPassword.includes('Egiaztatzen');

  // Enlace devuelto a su versión antigua para que no falle en Discord
  const discordLoginUrl = "https://discord.com/oauth2/authorize?client_id=1475601631977406605&response_type=code&redirect_uri=https%3A%2F%2Felppstrmstv.pages.dev%2F%3Ftab%3Ddirectos&scope=identify";

  return (
    <div className="flex-1 mt-[7.5rem] md:mt-[5rem] px-4 md:px-12 flex flex-col lg:flex-row gap-3 md:gap-6 pb-2 md:pb-6 w-full h-[calc(100vh-8rem)] min-h-0 animate-in fade-in duration-500">
        
        <div className="w-full flex-1 bg-black rounded-xl overflow-hidden border border-white/10 relative shadow-2xl flex items-center justify-center shrink-0 lg:shrink aspect-video lg:aspect-auto min-h-0">
            <div className="absolute inset-0 w-full h-full">
                {isLogged ? (
                    <NativeStreamPlayer streamSid={streamSid} streamPassword={streamPassword} channel={STREAM_CHANNEL} usePatreon={usePatreon} t={t} />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-md relative z-10">
                        <div className="bg-[#5865F2]/20 p-4 md:p-6 rounded-full mb-4 md:mb-6 border border-[#5865F2]/30 shadow-[0_0_30px_rgba(88,101,242,0.3)]">
                            <Lock size={48} className="md:w-16 md:h-16 text-[#5865F2]" />
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{t.acceso_premium}</h2>
                        <p className="text-gray-400 text-xs md:text-sm text-center max-w-sm px-4">{t.desc_directo}</p>
                    </div>
                )}
            </div>
            
            {isLogged && (
                <div className="absolute top-4 left-4 z-30 pointer-events-none opacity-0 group-hover/vid:opacity-100 transition-opacity duration-300">
                    <span className="bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-2 uppercase tracking-widest shadow-lg">
                        <Server size={12} className={usePatreon ? 'text-[#e5a00d]' : 'text-blue-400'} /> 
                        {usePatreon ? t.serv_patreon : t.serv_normal}
                    </span>
                </div>
            )}
        </div>
        
        <div className="w-full lg:w-[300px] xl:w-[340px] 2xl:w-[380px] bg-[#1a1a1c] rounded-xl overflow-hidden border border-white/5 flex flex-col shadow-2xl shrink-0 min-h-0">
            <div className="bg-[#141414] p-3 border-b border-white/5 flex justify-center items-center shrink-0">
               <span className="font-bold text-white text-sm flex items-center gap-2">
                   {isLogged ? <Server size={16} className="text-[#e5a00d]" /> : <Lock size={16} className="text-[#5865F2]" />}
                   {isLogged ? t.panel_servidor : t.acceso_premium}
               </span>
            </div>
            
            <div className="flex flex-col flex-1 p-3 sm:p-4 md:p-6 justify-start items-center text-center overflow-y-auto">
                {isLogged ? (
                    <div className="flex flex-col items-center w-full min-h-full animate-in fade-in zoom-in duration-300">
                        <div className="bg-green-500/10 p-3 sm:p-4 rounded-full mb-2 sm:mb-4 border border-green-500/30 shrink-0 mt-auto">
                            <CheckCircle size={32} className="sm:w-10 sm:h-10 text-green-500" />
                        </div>
                        <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white mb-1 sm:mb-2 shrink-0">{t.acceso_concedido}</h3>
                        <p className="text-gray-400 text-[10px] sm:text-[11px] md:text-xs mb-3 sm:mb-6 leading-snug shrink-0">{t.credenciales_inyectadas}</p>

                        <div className="w-full bg-black/40 border border-white/10 rounded-xl p-3 sm:p-4 md:p-5 mb-3 sm:mb-6 shadow-inner shrink-0 mt-auto">
                            <span className="text-[9px] md:text-[11px] text-gray-400 uppercase tracking-widest font-bold flex items-center justify-center gap-2 mb-3 sm:mb-4">
                                <Server size={14} className="text-[#e5a00d]" /> {t.selecciona_servidor}
                            </span>
                            <div className="flex bg-[#141414] rounded-lg p-1.5 border border-white/5 relative">
                                <button onClick={() => setUsePatreon(true)} disabled={!streamSid} className={`flex-1 py-2 sm:py-2.5 text-xs rounded-md transition-all duration-300 z-10 ${usePatreon ? 'bg-[#e5a00d] text-black font-black' : 'text-gray-400 hover:text-white font-semibold'} ${!streamSid ? 'opacity-30 cursor-not-allowed' : ''}`}>{t.serv_patreon}</button>
                                <button onClick={() => setUsePatreon(false)} className={`flex-1 py-2 sm:py-2.5 text-xs rounded-md transition-all duration-300 z-10 ${!usePatreon ? 'bg-neutral-700 text-white font-black' : 'text-gray-400 hover:text-white font-semibold'}`}>{t.serv_normal}</button>
                            </div>
                            {!streamSid && (
                                <p className="text-[9px] text-red-400/80 mt-2 sm:mt-3 font-medium flex items-center justify-center gap-1"><AlertTriangle size={10} /> {t.servidor_no_disp}</p>
                            )}
                        </div>

                        <div className="mt-auto w-full pt-1 pb-1">
                            <a href={discordLoginUrl} className="w-full font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg transition-all border border-white/10 bg-[#202225] hover:bg-[#2f3136] text-gray-300 text-[11px] sm:text-xs flex items-center justify-center gap-2 group">
                                <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> {t.refrescar_pass}
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full animate-in fade-in duration-300 my-auto">
                        <div className="bg-[#5865F2]/10 p-3 sm:p-4 rounded-full mb-2 sm:mb-4 border border-[#5865F2]/30 shrink-0">
                            <Lock size={32} className="sm:w-10 sm:h-10 text-[#5865F2]" />
                        </div>
                        <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white mb-1 sm:mb-2 shrink-0">{t.pass_directo}</h3>
                        <p className="text-gray-400 text-[10px] sm:text-[11px] md:text-xs mb-3 sm:mb-8 leading-snug shrink-0 max-w-[250px]">{t.desc_directo}</p>
                        
                        <a href={discordLoginUrl} className={`font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg transition-all w-full shadow-lg flex items-center justify-center gap-2 text-[11px] sm:text-sm shrink-0 mt-auto ${isVerifying ? 'opacity-50 pointer-events-none bg-[#5865F2] text-white' : 'bg-[#5865F2] hover:bg-[#4752C4] text-white'}`}>
                            {isVerifying ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t.verificando}</> : t.verificar_rol}
                        </a>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}