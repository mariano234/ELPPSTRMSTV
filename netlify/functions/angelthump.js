import https from 'https';

// ==========================================
// FUNCIÓN HTTPS PARA EVADIR CLOUDFLARE (Con Auto-Redirección y Soporte Binario)
// ==========================================
function fetchWithHttps(urlStr, options, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        // Límite de seguridad para evitar bucles infinitos
        if (redirectCount > 5) return reject(new Error('Demasiadas redirecciones'));
        
        const parsedUrl = new URL(urlStr);
        const bodyStr = options.body || '';

        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: { ...options.headers }
        };

        if (bodyStr) {
            reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr);
        }

        const req = https.request(reqOptions, (res) => {
            // MAGIA: Seguir redirecciones automáticamente
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, urlStr).toString();
                const newOptions = { ...options, method: 'GET', body: undefined };
                delete newOptions.headers['Content-Length'];
                return resolve(fetchWithHttps(redirectUrl, newOptions, redirectCount + 1));
            }

            let dataChunks = [];
            res.on('data', chunk => dataChunks.push(chunk));
            res.on('end', () => {
                // Mantenemos los datos crudos en Buffer para que no se corrompa el vídeo
                const buffer = Buffer.concat(dataChunks);
                let textStr = '';
                try { textStr = buffer.toString('utf8'); } catch(e){}
                let json = {};
                try { json = JSON.parse(textStr); } catch(e) {}

                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: res.headers,
                    url: urlStr, // VITAL: La URL final tras redirecciones
                    buffer: buffer,
                    text: async () => textStr,
                    json: async () => json
                });
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

export const handler = async function(event, context) {
    // ==========================================
    // CORS BLINDADO
    // ==========================================
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, identifier",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    const respond = (statusCode, data) => ({
        statusCode: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "OK" };

    if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
        return respond(405, { error: "Método no permitido." });
    }

    // ==========================================
    // PROXY GET: PUENTE TOTAL PARA .M3U8 Y FRAGMENTOS .M4S
    // ==========================================
    if (event.httpMethod === "GET") {
        const targetUrl = event.queryStringParameters?.url;
        if (!targetUrl) return respond(400, { error: "Falta la URL" });

        try {
            const res = await fetchWithHttps(targetUrl, {
                method: 'GET',
                headers: {
                    "accept": "*/*",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
                    "Referer": "https://player.angelthump.com/",
                    "Origin": "https://player.angelthump.com"
                }
            });
            
            const contentType = res.headers['content-type'] || '';
            const isTextFile = contentType.includes('text') || contentType.includes('mpegurl') || targetUrl.includes('.m3u8');
            
            // Si es un archivo de texto (La lista de reproducción)
            if (isTextFile) {
                let text = await res.text();
                const finalUrl = res.url || targetUrl; 
                const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
                
                text = text.split('\n').map(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return line;

                    // Analizar las etiquetas que contienen enlaces ocultos (ej: #EXT-X-MAP:URI="init.mp4")
                    if (trimmed.startsWith('#')) {
                        if (trimmed.includes('URI="')) {
                            return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                                if (uri.startsWith('data:')) return match;
                                const absoluteUrl = uri.startsWith('http') ? uri : baseUrl + uri;
                                return `URI="/.netlify/functions/angelthump?url=${encodeURIComponent(absoluteUrl)}"`;
                            });
                        }
                        return line;
                    }
                    
                    // Reescribimos las rutas directas de fragmentos
                    const absoluteUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
                    return `/.netlify/functions/angelthump?url=${encodeURIComponent(absoluteUrl)}`;
                }).join('\n');

                return { 
                    statusCode: 200, 
                    headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" }, 
                    body: text 
                };
            } 
            // Si es binario (El vídeo puro .m4s, .ts, .mp4, init.mp4)
            else {
                return {
                    statusCode: res.status,
                    headers: { 
                        ...corsHeaders, 
                        "Content-Type": contentType || "video/iso.segment",
                        "Cache-Control": "public, max-age=3600"
                    },
                    // Pasamos el Buffer a Base64; Netlify lo decodificará a binario para el navegador
                    body: res.buffer.toString('base64'),
                    isBase64Encoded: true
                };
            }
        } catch (e) {
            return respond(500, { error: e.message });
        }
    }

    // ==========================================
    // FLUJO POST: OBTENER TOKENS DE VÍDEO
    // ==========================================
    try {
        let body;
        try {
            body = event.isBase64Encoded ? JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8')) : JSON.parse(event.body);
        } catch (e) { body = {}; }

        const channel = body.channel || 'elpintaunas';
        const patreon = body.patreon === true;
        const password = body.password || ''; 
        let sid = body.sid || '';

        if (sid) sid = sid.replace(/['"]+/g, '').replace(/^angelthump\.sid=/, '').trim();

        const IDENTIFIER = "SwnpX0RnA99YdRj0SPqs";

        const baseHeaders = { 
            "accept": "*/*",
            "accept-language": "es-ES,es;q=0.9",
            "content-type": "application/json",
            "sec-ch-ua": "\"Not:A-Brand\";v=\"99\", \"Google Chrome\";v=\"145\", \"Chromium\";v=\"145\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "Referer": "https://player.angelthump.com/",
            "Origin": "https://player.angelthump.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
        };

        if (patreon) {
            // ==========================================
            // FLUJO 1: PREMIUM (PATREON)
            // ==========================================
            if (!sid) return respond(400, { error: "Falta la cookie de Patreon (SID)." });

            const tokenHeaders = { 
                ...baseHeaders, 
                "identifier": IDENTIFIER, 
                "Cookie": `angelthump.sid=${sid}` 
            };

            const vigorRes = await fetchWithHttps(`https://vigor.angelthump.com/${channel}/token`, {
                method: "POST",
                headers: tokenHeaders,
                body: JSON.stringify({ patreon: true })
            });

            const data = await vigorRes.json();
            
            if (!vigorRes.ok || !data.token) {
                 return respond(vigorRes.status > 200 ? vigorRes.status : 401, { error: data.message || "Cookie Premium rechazada por Angelthump." });
            }

            return respond(200, data);

        } else {
            // ==========================================
            // FLUJO 2: NORMAL (FREE)
            // ==========================================
            let sessionCookie = "";

            if (password) {
                const userRes = await fetchWithHttps(`https://api.angelthump.com/v3/users?username=${channel}`, { headers: baseHeaders });
                const userData = await userRes.json();
                let userId = "330abf9e-0b6c-4545-b0b1-6e57ce2a79a5"; 
                if (Array.isArray(userData) && userData.length > 0) userId = userData[0].id;
                else if (userData.data && Array.isArray(userData.data) && userData.data.length > 0) userId = userData.data[0].id;

                const passHeaders = { ...baseHeaders }; 
                const passRes = await fetchWithHttps(`https://api.angelthump.com/v3/streams/password`, {
                    method: "POST",
                    headers: passHeaders,
                    body: JSON.stringify({ user_id: userId, password: password })
                });

                const passData = await passRes.json();
                if (!passRes.ok || passData.error === true) {
                    return respond(passRes.status > 200 ? passRes.status : 401, { error: passData.message || "Contraseña incorrecta." });
                }

                const setCookieRaw = passRes.headers['set-cookie'];
                if (setCookieRaw) {
                    if (Array.isArray(setCookieRaw)) {
                        sessionCookie = setCookieRaw.map(c => c.split(';')[0]).join('; ');
                    } else {
                        sessionCookie = setCookieRaw.split(';')[0];
                    }
                }
            }

            const tokenHeaders = { ...baseHeaders, "identifier": IDENTIFIER };
            if (sessionCookie) tokenHeaders["Cookie"] = sessionCookie;

            const tokenRes = await fetchWithHttps(`https://vigor.angelthump.com/${channel}/token`, {
                method: "POST",
                headers: tokenHeaders,
                body: JSON.stringify({ patreon: false })
            });

            const tokenData = await tokenRes.json();
            
            if (!tokenRes.ok || !tokenData.token) {
                 return respond(tokenRes.status > 200 ? tokenRes.status : 401, { error: tokenData.message || "Fallo al canjear la sesión gratuita." });
            }

            return respond(200, tokenData);
        }

    } catch (error) {
        return respond(500, { error: "Error interno: " + error.message });
    }
};