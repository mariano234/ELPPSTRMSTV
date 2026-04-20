export const TMDB_API_KEY = "342815a2b6a677bbc29fd13a6e3c1c3a"; 
export const SHEET_ID = "104RB6GK9_m_nzIakTU3MJLaDJPwt9fYmfHF3ikyixFE";
export const CACHE_VERSION = "v2_multilang"; 
export const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; 
export const STREAM_CHANNEL = "elpintaunas"; 
export const API_BASE = "/api"; 

export const LANGUAGE_MAP = {
  'es': 'Español', 'es-es': 'Español (España)', 'es-mx': 'Español (Latino)',
  'en': 'Inglés', 'en-us': 'Inglés (EEUU)', 'en-gb': 'Inglés (Reino Unido)',
  'cat': 'Catalán', 'ca': 'Catalán', 'va': 'Valenciano', 'val': 'Valenciano',
  'eus': 'Euskera', 'eu': 'Euskera', 'gal': 'Gallego', 'gl': 'Gallego',
  'fr': 'Francés', 'it': 'Italiano', 'de': 'Alemán', 'ja': 'Japonés', 'jp': 'Japonés', 'ko': 'Coreano', 'pt': 'Portugués'
};

export const GENRE_TRANSLATIONS = {
    'Acción': { ca: 'Acció', gl: 'Acción', eu: 'Ekintza', es: 'Acción' },
    'Action': { ca: 'Acció', gl: 'Acción', eu: 'Ekintza', es: 'Acción' },
    'Aventura': { ca: 'Aventura', gl: 'Aventura', eu: 'Abentura', es: 'Aventura' },
    'Adventure': { ca: 'Aventura', gl: 'Aventura', eu: 'Abentura', es: 'Aventura' },
    'Animación': { ca: 'Animació', gl: 'Animación', eu: 'Animazioa', es: 'Animación' },
    'Animation': { ca: 'Animació', gl: 'Animación', eu: 'Animazioa', es: 'Animación' },
    'Comedia': { ca: 'Comèdia', gl: 'Comedia', eu: 'Komedia', es: 'Comedia' },
    'Comedy': { ca: 'Comèdia', gl: 'Comedia', eu: 'Komedia', es: 'Comedia' },
    'Crimen': { ca: 'Crim', gl: 'Crime', eu: 'Krimena', es: 'Crimen' },
    'Crime': { ca: 'Crim', gl: 'Crime', eu: 'Krimena', es: 'Crimen' },
    'Documental': { ca: 'Documental', gl: 'Documental', eu: 'Dokumentala', es: 'Documental' },
    'Documentary': { ca: 'Documental', gl: 'Documental', eu: 'Dokumentala', es: 'Documental' },
    'Drama': { ca: 'Drama', gl: 'Drama', eu: 'Drama', es: 'Drama' },
    'Familia': { ca: 'Família', gl: 'Familia', eu: 'Familia', es: 'Familia' },
    'Family': { ca: 'Família', gl: 'Familia', eu: 'Familia', es: 'Familia' },
    'Fantasía': { ca: 'Fantasia', gl: 'Fantasía', eu: 'Fantasia', es: 'Fantasía' },
    'Fantasy': { ca: 'Fantasia', gl: 'Fantasía', eu: 'Fantasia', es: 'Fantasía' },
    'Historia': { ca: 'Història', gl: 'Historia', eu: 'Historia', es: 'Historia' },
    'History': { ca: 'Història', gl: 'Historia', eu: 'Historia', es: 'Historia' },
    'Terror': { ca: 'Terror', gl: 'Terror', eu: 'Beldurra', es: 'Terror' },
    'Horror': { ca: 'Terror', gl: 'Terror', eu: 'Beldurra', es: 'Terror' },
    'Música': { ca: 'Música', gl: 'Música', eu: 'Musika', es: 'Música' },
    'Music': { ca: 'Música', gl: 'Música', eu: 'Musika', es: 'Música' },
    'Misterio': { ca: 'Misteri', gl: 'Misterio', eu: 'Misterioa', es: 'Misterio' },
    'Mystery': { ca: 'Misteri', gl: 'Misterio', eu: 'Misterioa', es: 'Misterio' },
    'Romance': { ca: 'Romanç', gl: 'Romance', eu: 'Erromantzea', es: 'Romance' },
    'Ciencia ficción': { ca: 'Ciència ficció', gl: 'Ciencia ficción', eu: 'Zientzia fikzioa', es: 'Ciencia ficción' },
    'Science Fiction': { ca: 'Ciència ficció', gl: 'Ciencia ficción', eu: 'Zientzia fikzioa', es: 'Ciencia ficción' },
    'Película de TV': { ca: 'Pel·lícula de TV', gl: 'Película de TV', eu: 'Telebistako filma', es: 'Película de TV' },
    'TV Movie': { ca: 'Pel·lícula de TV', gl: 'Película de TV', eu: 'Telebistako filma', es: 'Película de TV' },
    'Suspense': { ca: 'Suspens', gl: 'Suspense', eu: 'Suspensea', es: 'Suspense' },
    'Thriller': { ca: 'Suspens', gl: 'Suspense', eu: 'Suspensea', es: 'Suspense' },
    'Bélica': { ca: 'Bèl·lica', gl: 'Bélica', eu: 'Gerra', es: 'Bélica' },
    'War': { ca: 'Bèl·lica', gl: 'Bélica', eu: 'Gerra', es: 'Bélica' },
    'Western': { ca: 'Western', gl: 'Western', eu: 'Western', es: 'Western' }
};

export const LANG_TRANSLATIONS = {
    'es': {
        'Español': 'Español', 'Español (España)': 'Español (España)', 'Español (Latino)': 'Español (Latino)',
        'Inglés': 'Inglés', 'Inglés (EEUU)': 'Inglés (EEUU)', 'Inglés (Reino Unido)': 'Inglés (Reino Unido)',
        'Catalán': 'Catalán', 'Valenciano': 'Valenciano', 'Euskera': 'Euskera', 'Gallego': 'Gallego',
        'Francés': 'Francés', 'Italiano': 'Italiano', 'Alemán': 'Alemán', 'Japonés': 'Japonés', 'Portugués': 'Portugués'
    },
    'ca': {
        'Español': 'Espanyol', 'Español (España)': 'Espanyol (Espanya)', 'Español (Latino)': 'Espanyol (Llatí)',
        'Inglés': 'Anglès', 'Inglés (EEUU)': 'Anglès (EUA)', 'Inglés (Reino Unido)': 'Anglès (Regne Unit)',
        'Catalán': 'Català', 'Valenciano': 'Valencià', 'Euskera': 'Basc', 'Gallego': 'Gallec',
        'Francés': 'Francès', 'Italiano': 'Italià', 'Alemán': 'Alemany', 'Japonés': 'Japonès', 'Portugués': 'Portuguès'
    },
    'gl': {
        'Español': 'Español', 'Español (España)': 'Español (España)', 'Español (Latino)': 'Español (Latino)',
        'Inglés': 'Inglés', 'Inglés (EEUU)': 'Inglés (EEUU)', 'Inglés (Reino Unido)': 'Inglés (Reino Unido)',
        'Catalán': 'Catalán', 'Valenciano': 'Valenciano', 'Euskera': 'Euskera', 'Gallego': 'Galego',
        'Francés': 'Francés', 'Italiano': 'Italiano', 'Alemán': 'Alemán', 'Japonés': 'Xaponés', 'Portugués': 'Portugués'
    },
    'eu': {
        'Español': 'Gaztelania', 'Español (España)': 'Gaztelania (Espainia)', 'Español (Latino)': 'Gaztelania (Latino)',
        'Inglés': 'Ingelesa', 'Inglés (EEUU)': 'Ingelesa (AEB)', 'Inglés (Reino Unido)': 'Ingelesa (Erresuma Batua)',
        'Catalán': 'Katalana', 'Valenciano': 'Valentziera', 'Euskera': 'Euskara', 'Gallego': 'Galiziera',
        'Francés': 'Frantsesa', 'Italiano': 'Italiera', 'Alemán': 'Alemana', 'Japonés': 'Japoniera', 'Portugués': 'Portugesa'
    }
};

export const UI_TRANSLATIONS = {
  'es': {
    inicio: 'INICIO', pelis: 'PELIS', series: 'SERIES', directos: 'DIRECTOS',
    buscar: 'Buscar películas...', recomendados: 'Recomendados de hoy',
    mejor_valoradas: 'Mejor Valoradas', ultimos: 'Últimos Lanzamientos',
    sagas: 'Sagas y Colecciones', ver_todos: 'Ver todos',
    filtro_genero: '+ Género', filtro_calidad: '+ Calidad', filtro_idioma: '+ Idioma',
    filtro_ano: '+ Año', orden_defecto: 'Orden por defecto', orden_az: 'Alfabético (A - Z)',
    orden_za: 'Alfabético (Z - A)', orden_rating: 'Mejor Valoradas', orden_year: 'Más Recientes',
    limpiar: 'Limpiar todos', resultados: 'Resultados de búsqueda',
    cargar_mas: 'Cargar más resultados', restantes: 'restantes',
    volver: 'VOLVER', recomendado_para_ti: 'RECOMENDADO PARA TI', ver_detalles: 'VER DETALLES',
    coleccion_oficial: 'Colección Oficial', pelis_biblioteca: 'Películas en tu biblioteca',
    descargar: 'DESCARGAR A MI BIBLIOTECA', enlace_no_disp: 'ENLACE NO DISPONIBLE',
    mas_saga: 'Más de esta saga', titulos_similares: 'Títulos similares recomendados',
    sin_descripcion: 'Sin descripción disponible.', sinc_biblio: 'Sincronizando con tu biblioteca...',
    calidad: 'Calidad', idiomas: 'Idiomas', año: 'Año', error_fallo: 'Vaya, algo ha fallado',
    proximamente: 'Próximamente...', prep_series: 'Estamos preparando todo el catálogo de series para integrarlo en la plataforma. ¡Vuelve muy pronto!',
    acceso_premium: 'Acceso Premium', pass_directo: 'Autenticación Requerida',
    desc_directo: 'El directo está protegido. Verifica que tienes el rol requerido en nuestro servidor de Discord para acceder.',
    verificando: 'Verificando...', refrescar_pass: 'Refrescar Sesión', verificar_rol: 'Verificar Rol de Discord',
    vacio: 'Vacío', sin_pass: 'Sin Contraseña', serv_patreon: 'Premium (Patreon)', serv_normal: 'Normal (Público)',
    acceso_concedido: 'Acceso VIP Concedido',
    credenciales_inyectadas: 'Tus credenciales se han inyectado automáticamente en el reproductor. ¡Disfruta del directo!',
    selecciona_servidor: 'Selecciona tu Servidor',
    servidor_no_disp: 'Servidor Premium no disponible con tu rol actual.',
    panel_servidor: 'Panel de Control',
    enviar_tv: 'Enviar a TV (Chromecast)', error_cast: 'Chromecast no disponible. Verifica que estás en Google Chrome y en la misma red Wi-Fi.'
  },
  'ca': {
    inicio: 'INICI', pelis: 'PEL·LIS', series: 'SÈRIES', directos: 'DIRECTES',
    buscar: 'Cercar pel·lícules...', recomendados: 'Recomanats d\'avui',
    mejor_valoradas: 'Més ben valorades', ultimos: 'Últims Llançaments',
    sagas: 'Sagues i Col·leccions', ver_todos: 'Veure tots',
    filtro_genero: '+ Gènere', filtro_calidad: '+ Qualitat', filtro_idioma: '+ Idioma',
    filtro_ano: '+ Any', orden_defecto: 'Ordre per defecte', orden_az: 'Alfabètic (A - Z)',
    orden_za: 'Alfabètic (Z - A)', orden_rating: 'Més ben valorades', orden_year: 'Més Recents',
    limpiar: 'Netejar tots', resultados: 'Resultats de cerca',
    cargar_mas: 'Carregar més resultats', restantes: 'restants',
    volver: 'TORNAR', recomendado_para_ti: 'RECOMANAT PER A TU', ver_detalles: 'VEURE DETALLS',
    coleccion_oficial: 'Col·lecció Oficial', pelis_biblioteca: 'Pel·lícules a la teva biblioteca',
    descargar: 'DESCARREGAR A LA MEVA BIBLIOTECA', enlace_no_disp: 'ENLLAÇ NO DISPONIBLE',
    mas_saga: 'Més d\'aquesta saga', titulos_similares: 'Títols similars recomanats',
    sin_descripcion: 'Sense descripció disponible.', sinc_biblio: 'Sincronitzant amb la teva biblioteca...',
    calidad: 'Qualitat', idiomas: 'Idiomes', año: 'Any', error_fallo: 'Vaja, alguna cosa ha fallat',
    proximamente: 'Aviat...', prep_series: 'Estem preparant tot el catàleg de sèries per integrar-lo a la plataforma. Torna molt aviat!',
    acceso_premium: 'Accés Premium', pass_directo: 'Autenticació Requerida',
    desc_directo: 'El directe està protegit. Verifica que tens el rol requerit al nostre servidor de Discord per accedir-hi.',
    verificando: 'Verificant...', refrescar_pass: 'Refrescar Sessió', verificar_rol: 'Verificar el meu Rol',
    vacio: 'Buit', sin_pass: 'Sense Contrasenya', serv_patreon: 'Premium (Patreon)', serv_normal: 'Normal (Públic)',
    acceso_concedido: 'Accés VIP Concedit',
    credenciales_inyectadas: 'Les teves credencials s\'han injectat automàticament al reproductor. Gaudeix del directe!',
    selecciona_servidor: 'Selecciona el teu Servidor',
    servidor_no_disp: 'Servidor Premium no disponible amb el teu rol actual.',
    panel_servidor: 'Tauler de Control',
    enviar_tv: 'Enviar a TV (Chromecast)', error_cast: 'Chromecast no disponible. Verifica que estàs a Google Chrome i a la mateixa xarxa Wi-Fi.'
  },
  'gl': {
    inicio: 'INICIO', pelis: 'PELIS', series: 'SERIES', directos: 'DIRECTOS',
    buscar: 'Buscar...', recomendados: 'Recomendados de hoxe',
    mejor_valoradas: 'Mellor Valoradas', ultimos: 'Últimos Lanzamentos',
    sagas: 'Sagas e Coleccións', ver_todos: 'Ver todos',
    filtro_genero: '+ Xénero', filtro_calidad: '+ Calidade', filtro_idioma: '+ Idioma',
    filtro_ano: '+ Ano', orden_defecto: 'Orde por defecto', orden_az: 'Alfabético (A - Z)',
    orden_za: 'Alfabético (Z - A)', orden_rating: 'Mellor Valoradas', orden_year: 'Máis Recentes',
    limpiar: 'Limpar todos', resultados: 'Resultados da busca',
    cargar_mas: 'Cargar máis resultados', restantes: 'restantes',
    volver: 'VOLVER', recomendado_para_ti: 'RECOMENDADO PARA TI', ver_detalles: 'VER DETALLES',
    coleccion_oficial: 'Colección Oficial', pelis_biblioteca: 'Películas na túa biblioteca',
    descargar: 'DESCARGAR Á MIÑA BIBLIOTECA', enlace_no_disp: 'ENLACE NON DISPOÑIBLE',
    mas_saga: 'Máis desta saga', titulos_similares: 'Títulos similares recomendados',
    sin_descripcion: 'Sen descrición dispoñible.', sinc_biblio: 'Sincronizando coa túa biblioteca...',
    calidad: 'Calidade', idiomas: 'Idiomas', año: 'Ano', error_fallo: 'Oes, algo fallou',
    proximamente: 'Proximamente...', prep_series: 'Estamos a preparar todo o catálogo de series para integralo na plataforma. Volve moi pronto!',
    acceso_premium: 'Acceso Premium', pass_directo: 'Autenticación Requirida',
    desc_directo: 'O directo está protexido. Verifica que tes o rol requirido no noso servidor de Discord para acceder.',
    verificando: 'Verificando...', refrescar_pass: 'Refrescar Sesión', verificar_rol: 'Verificar o meu Rol',
    vacio: 'Baleiro', sin_pass: 'Sen Contrasinal', serv_patreon: 'Premium (Patreon)', serv_normal: 'Normal (Público)',
    acceso_concedido: 'Acceso VIP Concedido',
    credenciales_inyectadas: 'As túas credenciais inxectáronse automaticamente no reprodutor. Goza do directo!',
    selecciona_servidor: 'Selecciona o teu Servidor',
    servidor_no_disp: 'Servidor Premium non dispoñible co teu rol actual.',
    panel_servidor: 'Panel de Control',
    enviar_tv: 'Enviar a TV (Chromecast)', error_cast: 'Chromecast non dispoñible. Verifica que estás en Google Chrome e na mesma rede Wi-Fi.'
  },
  'eu': {
    inicio: 'HASIERA', pelis: 'FILMAK', series: 'TELESAILAK', directos: 'ZUZENEKOAK',
    buscar: 'Bilatu...', recomendados: 'Gaurko gomendioak',
    mejor_valoradas: 'Balorazio onenak', ultimos: 'Azken Argitalpenak',
    sagas: 'Sagak eta Bildumak', ver_todos: 'Ikusi guztiak',
    filtro_genero: '+ Generoa', filtro_calidad: '+ Kalitatea', filtro_idioma: '+ Hizkuntza',
    filtro_ano: '+ Urtea', orden_defecto: 'Ordena lehenetsia', orden_az: 'Alfabetikoa (A - Z)',
    orden_za: 'Alfabetikoa (Z - A)', orden_rating: 'Balorazio onenak', orden_year: 'Berrienak',
    limpiar: 'Garbitu denak', resultados: 'Bilaketaren emaitzak',
    cargar_mas: 'Emaitza gehiago kargatu', restantes: 'falta dira',
    volver: 'ITZULI', recomendado_para_ti: 'ZURETZAT GOMENDATUA', ver_detalles: 'IKUSI XEHETASUNAK',
    coleccion_oficial: 'Bilduma Ofiziala', pelis_biblioteca: 'Filmak zure liburutegian',
    descargar: 'NIRE LIBURUTEGIRA DESKARGATU', enlace_no_disp: 'ESTEKA EZ DAGO ESKURAGARRI',
    mas_saga: 'Saga honetako gehiago', titulos_similares: 'Gomendatutako antzeko tituluak',
    sin_descripcion: 'Ez dago deskribapenik eskuragarri.', sinc_biblio: 'Zure liburutegiarekin sinkronizatzen...',
    calidad: 'Kalitatea', idiomas: 'Hizkuntzak', Urtea: 'Urtea', error_fallo: 'Ene, zerbaitek huts egin du',
    proximamente: 'Laster...', prep_series: 'Telesailen katalogo osoa prestatzen ari gara plataforman integratzeko. Itzuli laster!',
    acceso_premium: 'Premium Sarbidea', pass_directo: 'Autentifikazioa Beharrezkoa',
    desc_directo: 'Zuzenekoa babestuta dago. Egiaztatu Discord zerbitzarian beharrezko rola duzula sartzeko.',
    verificando: 'Egiaztatzen...', refrescar_pass: 'Saioa Freskatu', verificar_rol: 'Egiaztatu Rola',
    vacio: 'Hutsik', sin_pass: 'Pasahitzik Ez', serv_patreon: 'Premium (Patreon)', serv_normal: 'Normala (Publikoa)',
    acceso_concedido: 'VIP Sarbidea Baimenduta',
    credenciales_inyectadas: 'Zure kredentzialak automatikoki txertatu dira erreproduzitzailean. Gozatu zuzenekoaz!',
    selecciona_servidor: 'Hautatu zure Zerbitzaria',
    servidor_no_disp: 'Premium Zerbitzaria ez dago erabilgarri zure uneko rolarekin.',
    panel_servidor: 'Kontrol Panela',
    enviar_tv: 'Bidali telebistara', error_cast: 'Chromecast ez dago eskuragarri. Egiaztatu Chrome-n zaudela eta Wi-Fi sare berean.'
  }
};