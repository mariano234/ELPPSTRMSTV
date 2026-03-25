export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, identifier",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    // 1. Responder rápido a las peticiones OPTIONS del navegador (Pre-flight CORS)
    if (request.method === "OPTIONS") {
        return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (request.method !== "POST" && request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Método no permitido." }), { 
            status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    // ==========================================
    // PROXY GET: PUENTE TOTAL PARA .M3U8 Y FRAGMENTOS BINARIOS
    // ==========================================
    if (request.method === "GET") {
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) return new Response(JSON.stringify({ error: "Falta la URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        try {
            const res = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    "accept": "*/*",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
                    "Referer": "https://player.angelthump.com/",
                    "Origin": "https://player.angelthump.com"
                }
            });
            
            const contentType = res.headers.get('content-type') || '';
            const isTextFile = contentType.includes('text') || contentType.includes('mpegurl') || targetUrl.includes('.m3u8');
            
            // Usamos la ruta dinámica con la que nos llamaron para los reemplazos (sea /angelthump o /.netlify/functions/angelthump)
            const currentProxyPath = url.pathname;
            
            // Si es la lista de reproducción (texto)
            if (isTextFile) {
                let text = await res.text();
                const finalUrl = res.url || targetUrl; 
                const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
                
                text = text.split('\n').map(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return line;

                    // Reemplazamos URIs de inicialización (ej: #EXT-X-MAP:URI="init.mp4")
                    if (trimmed.startsWith('#')) {
                        if (trimmed.includes('URI="')) {
                            return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                                if (uri.startsWith('data:')) return match;
                                const absoluteUrl = uri.startsWith('http') ? uri : baseUrl + uri;
                                return `URI="${currentProxyPath}?url=${encodeURIComponent(absoluteUrl)}"`;
                            });
                        }
                        return line;
                    }
                    
                    // Reemplazamos enlaces directos a fragmentos .m4s / .ts
                    const absoluteUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
                    return `${currentProxyPath}?url=${encodeURIComponent(absoluteUrl)}`;
                }).join('\n');

                return new Response(text, { 
                    status: 200, 
                    headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" } 
                });
            } 
            // Si es vídeo binario, Cloudflare lo transfiere mágicamente mediante res.body (Stream)
            else {
                return new Response(res.body, {
                    status: res.status,
                    headers: { 
                        ...corsHeaders, 
                        "Content-Type": contentType || "video/iso.segment",
                        "Cache-Control": "public, max-age=3600"
                    }
                });
            }
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
    }

    // ==========================================
    // FLUJO POST: OBTENER TOKENS DE VÍDEO
    // ==========================================
    try {
        let body = {};
        try {
            body = await request.json();
        } catch (e) { /* cuerpo vacío */ }

        const channel = body.channel || 'elpintaunas';
        const patreon = body.patreon === true;
        const password = body.password || ''; 
        let sid = body.sid || '';
        let identifierParam = body.identifier || null;

        if (sid) sid = sid.replace(/['"]+/g, '').replace(/^angelthump\.sid=/, '').trim();

        const baseHeaders = { 
            "accept": "*/*",
            "accept-language": "es-ES,es;q=0.9",
            "content-type": "application/json",
            "Referer": "https://player.angelthump.com/",
            "Origin": "https://player.angelthump.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
        };

        // Identificador dinámico
        let IDENTIFIER = identifierParam || "SwnpX0RnA99YdRj0SPqs"; 
        if (!identifierParam) {
            try {
                const playerRes = await fetch(`https://player.angelthump.com/?channel=${channel}`, { headers: baseHeaders });
                const playerHtml = await playerRes.text();
                const match = playerHtml.match(/identifier\s*:\s*['"]([^'"]+)['"]/);
                if (match && match[1]) {
                    IDENTIFIER = match[1];
                }
            } catch (e) {
                console.log("Error obteniendo identifier dinámico, usando fallback.");
            }
        }

        if (patreon) {
            // === FLUJO 1: PREMIUM (PATREON) ===
            if (!sid) return new Response(JSON.stringify({ error: "Falta la cookie de Patreon (SID)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

            const tokenHeaders = { 
                ...baseHeaders, 
                "identifier": IDENTIFIER, 
                "Cookie": `angelthump.sid=${sid}` 
            };

            const vigorRes = await fetch(`https://vigor.angelthump.com/${channel}/token`, {
                method: "POST",
                headers: tokenHeaders,
                body: JSON.stringify({ patreon: true })
            });

            const data = await vigorRes.json();
            
            if (!vigorRes.ok || !data.token) {
                 return new Response(JSON.stringify({ error: data.message || "Cookie Premium rechazada por Angelthump." }), { status: vigorRes.status > 200 ? vigorRes.status : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } else {
            // === FLUJO 2: NORMAL (FREE) ===
            let sessionCookie = "";

            if (password) {
                const userRes = await fetch(`https://api.angelthump.com/v3/users?username=${channel}`, { headers: baseHeaders });
                const userData = await userRes.json();
                let userId = "330abf9e-0b6c-4545-b0b1-6e57ce2a79a5"; 
                if (Array.isArray(userData) && userData.length > 0) userId = userData[0].id;
                else if (userData.data && Array.isArray(userData.data) && userData.data.length > 0) userId = userData.data[0].id;

                const passHeaders = { ...baseHeaders }; 
                const passRes = await fetch(`https://api.angelthump.com/v3/streams/password`, {
                    method: "POST",
                    headers: passHeaders,
                    body: JSON.stringify({ user_id: userId, password: password })
                });

                const passData = await passRes.json();
                if (!passRes.ok || passData.error === true) {
                    return new Response(JSON.stringify({ error: passData.message || "Contraseña incorrecta." }), { status: passRes.status > 200 ? passRes.status : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }

                const setCookieRaw = passRes.headers.get('set-cookie');
                if (setCookieRaw) {
                    sessionCookie = setCookieRaw.split(';')[0];
                }
            }

            const tokenHeaders = { ...baseHeaders, "identifier": IDENTIFIER };
            if (sessionCookie) tokenHeaders["Cookie"] = sessionCookie;

            const tokenRes = await fetch(`https://vigor.angelthump.com/${channel}/token`, {
                method: "POST",
                headers: tokenHeaders,
                body: JSON.stringify({ patreon: false })
            });

            const tokenData = await tokenRes.json();
            
            if (!tokenRes.ok || !tokenData.token) {
                 return new Response(JSON.stringify({ error: tokenData.message || "Fallo al canjear la sesión gratuita." }), { status: tokenRes.status > 200 ? tokenRes.status : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify(tokenData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

    } catch (error) {
        return new Response(JSON.stringify({ error: "Error interno: " + error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
}