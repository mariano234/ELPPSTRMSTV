import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Server, CheckCircle, RefreshCw, AlertTriangle, MonitorPlay } from 'lucide-react';
import NativeStreamPlayer from '../components/NativeStreamPlayer';
import { clearLegacyAccess, discordLoginUrl, logoutLive, readLiveSession } from '../lib/live';
import { UI_TRANSLATIONS, STREAM_CHANNEL } from '../config';

const LOGIN_ERRORS = {
  denied: 'Necesitas el rol de Patreon o Colaborador para acceder a Directos.',
  invalid: 'El inicio de sesión ha caducado. Vuelve a identificarte con Discord.',
  cancelled: 'Has cancelado el inicio de sesión con Discord.',
  unavailable: 'No se pudo completar el inicio de sesión. Inténtalo de nuevo.',
};

export default function Live({ appLang }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const t = UI_TRANSLATIONS[appLang] || UI_TRANSLATIONS['es'];
  const [auth, setAuth] = useState(null);
  const [error, setError] = useState(() => LOGIN_ERRORS[searchParams.get('login')] || '');
  const [isVerifying, setIsVerifying] = useState(true);
  const [usePatreon, setUsePatreon] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(STREAM_CHANNEL);
  const isLogged = Boolean(auth?.authenticated) && !isVerifying;
  const canUsePremium = Boolean(auth?.premium);
  const onAccessLost = useCallback(message => { setAuth(null); setUsePatreon(false); setError(message); }, []);
  const onSessionRenewed = useCallback(expiresAt => {
    setAuth(current => current && expiresAt > current.expiresAt ? { ...current, expiresAt } : current);
  }, []);

  useEffect(() => {
    let active = true;
    clearLegacyAccess();
    readLiveSession().then(result => {
      if (!active) return;
      setAuth(result);
      setUsePatreon(Boolean(result?.premium));
    }).catch(err => {
      if (!active) return;
      setError(err.name === 'AbortError' ? 'No se pudo comprobar la sesión. Vuelve a intentarlo.' : err.message);
    }).finally(() => { if (active) setIsVerifying(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!searchParams.has('login') && !searchParams.has('code')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('login');
    next.delete('code');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!auth) return;
    const timeout = setTimeout(() => {
      onAccessLost('Tu sesión de Directos ha terminado. Vuelve a identificarte con Discord.');
    }, Math.max(0, auth.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [auth, onAccessLost]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await logoutLive(); onAccessLost(''); }
    catch (err) { setError(err.message); }
    finally { setIsLoggingOut(false); }
  };

  return (
    <div className="flex-1 mt-[7.5rem] md:mt-[5rem] px-4 md:px-12 flex flex-col lg:flex-row gap-3 md:gap-6 pb-2 md:pb-6 w-full min-h-[calc(100vh-8rem)] lg:h-[calc(100vh-8rem)] animate-in fade-in duration-500">
        
        <div className="w-full flex-1 bg-black rounded-xl overflow-hidden border border-white/10 relative shadow-2xl flex items-center justify-center shrink-0 lg:shrink aspect-video lg:aspect-auto min-h-[250px] lg:min-h-0">
            <div className="absolute inset-0 w-full h-full">
                {isLogged ? (
                    <NativeStreamPlayer 
                        channel={selectedChannel} 
                        mode={usePatreon ? 'premium' : 'normal'}
                        onAccessLost={onAccessLost}
                        onSessionRenewed={onSessionRenewed}
                        t={t} 
                    />
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

                        <div className="w-full bg-black/40 border border-white/10 rounded-xl p-3 sm:p-4 md:p-5 mb-3 sm:mb-4 shadow-inner shrink-0 mt-auto">
                            <span className="text-[9px] md:text-[11px] text-gray-400 uppercase tracking-widest font-bold flex items-center justify-center gap-2 mb-3 sm:mb-4">
                                <MonitorPlay size={14} className="text-[#e5a00d]" /> Seleccionar Emisión
                            </span>
                            <div className="flex bg-[#141414] rounded-lg relative border border-white/5 overflow-hidden">
                                <select 
                                    value={selectedChannel} 
                                    onChange={(e) => setSelectedChannel(e.target.value)}
                                    className="bg-transparent text-gray-300 font-semibold text-[11px] sm:text-xs rounded-lg pl-3 pr-8 py-2.5 sm:py-3 outline-none w-full appearance-none cursor-pointer focus:text-white"
                                >
                                    <option value={STREAM_CHANNEL} className="bg-[#1a1a1c] text-white">Canal Principal (Requiere Pass)</option>
                                    <option value={`${STREAM_CHANNEL}_1`} className="bg-[#1a1a1c] text-white">Canal Secundario (Sin Pass)</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        <div className="w-full bg-black/40 border border-white/10 rounded-xl p-3 sm:p-4 md:p-5 mb-3 sm:mb-6 shadow-inner shrink-0">
                            <span className="text-[9px] md:text-[11px] text-gray-400 uppercase tracking-widest font-bold flex items-center justify-center gap-2 mb-3 sm:mb-4">
                                <Server size={14} className="text-[#e5a00d]" /> {t.selecciona_servidor}
                            </span>
                            <div className="flex bg-[#141414] rounded-lg p-1.5 border border-white/5 relative">
                                <button onClick={() => setUsePatreon(true)} disabled={!canUsePremium} className={`flex-1 py-2 sm:py-2.5 text-[10px] sm:text-xs rounded-md transition-all duration-300 z-10 ${usePatreon ? 'bg-[#e5a00d] text-black font-black' : 'text-gray-400 hover:text-white font-semibold'} ${!canUsePremium ? 'opacity-30 cursor-not-allowed' : ''}`}>{t.serv_patreon}</button>
                                <button onClick={() => setUsePatreon(false)} className={`flex-1 py-2 sm:py-2.5 text-[10px] sm:text-xs rounded-md transition-all duration-300 z-10 ${!usePatreon ? 'bg-neutral-700 text-white font-black' : 'text-gray-400 hover:text-white font-semibold'}`}>{t.serv_normal}</button>
                            </div>
                            {!canUsePremium && (
                                <p className="text-[9px] text-red-400/80 mt-2 sm:mt-3 font-medium flex items-center justify-center gap-1"><AlertTriangle size={10} /> {t.servidor_no_disp}</p>
                            )}
                        </div>

                        <div className="mt-auto w-full pt-1 pb-1">
                            {error && <p role="alert" className="mb-2 text-sm text-red-400">{error}</p>}
                            <a href={discordLoginUrl} className="w-full font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg transition-all border border-white/10 bg-[#202225] hover:bg-[#2f3136] text-gray-300 text-[11px] sm:text-xs flex items-center justify-center gap-2 group">
                                <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> {t.refrescar_pass}
                            </a>
                            <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="mt-2 w-full rounded-lg border border-white/10 py-2 text-xs text-gray-300">Cerrar sesión</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full animate-in fade-in duration-300 my-auto">
                        <div className="bg-[#5865F2]/10 p-3 sm:p-4 rounded-full mb-2 sm:mb-4 border border-[#5865F2]/30 shrink-0">
                            <Lock size={32} className="sm:w-10 sm:h-10 text-[#5865F2]" />
                        </div>
                        <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white mb-1 sm:mb-2 shrink-0">{t.pass_directo}</h3>
                        <p className="text-gray-400 text-[10px] sm:text-[11px] md:text-xs mb-3 sm:mb-8 leading-snug shrink-0 max-w-[250px]">{t.desc_directo}</p>
                        
                        {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}
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
