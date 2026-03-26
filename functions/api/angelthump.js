export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    // Cabeceras CORS estrictas pero abiertas para que el reproductor de React no se bloquee
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, identifier",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    if (request.method === "OPTIONS") {
        return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (request.method !== "POST" && request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Método no permitido." }), { 
            status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    // ==========================================
    // 1. PROXY GET: PUENTE PARA .M3U8 Y FRAGMENTOS
    // ==========================================
    if (request.method === "GET") {
        const targetUrl = url.searchParams.get('url');
        const sid = url.searchParams.get('sid');
        const identifier = url.searchParams.get('identifier');

        if (!targetUrl) {
            return new Response(JSON.stringify({ error: "Falta la URL de destino" }), { 
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        const fetchHeaders = {
            "accept": "*/*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://player.angelthump.com/",
            "Origin": "https://player.angelthump.com"
        };

        // Inyectamos credenciales de Patreon si el reproductor nos las manda por la URL
        if (sid) fetchHeaders["Cookie"] = `angelthump.sid=${sid}`;
        if (identifier) fetchHeaders["identifier"] = identifier;

        try {
            const res = await fetch(targetUrl, { method: 'GET', headers: fetchHeaders });
            const contentType = res.headers.get('content-type') || '';

            // Si es la lista de reproducción M3U8, la modificamos para que los fragmentos pasen por nuestro proxy
            if (contentType.includes('mpegurl') || contentType.includes('m3u8') || targetUrl.includes('.m3u8')) {
                let text = await res.text();
                const baseUrl = new URL(targetUrl);
                const baseUrlString = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

                const rewrittenText = text.split('\n').map(line => {
                    const trimmed = line.trim();
                    if (trimmed === '') return line;
                    
                    // Mantener llaves de cifrado si pasan por proxy
                    if (trimmed.startsWith('#EXT-X-KEY:')) {
                        return line.replace(/URI="([^"]+)"/, (match, uri) => {
                            let absoluteUri = uri;
                            if (!uri.startsWith('http')) absoluteUri = baseUrlString + uri;
                            let proxyUri = `${url.origin}${url.pathname}?url=${encodeURIComponent(absoluteUri)}`;
                            if (sid) proxyUri += `&sid=${encodeURIComponent(sid)}`;
                            if (identifier) proxyUri += `&identifier=${encodeURIComponent(identifier)}`;
                            return `URI="${proxyUri}"`;
                        });
                    }

                    if (trimmed.startsWith('#')) return line; // Metadatos intocables

                    // Es una URL de un segmento de vídeo
                    let absoluteSegmentUrl = trimmed;
                    if (!trimmed.startsWith('http')) {
                        absoluteSegmentUrl = baseUrlString + trimmed;
                    }
                    
                    // Redirigir el fragmento de nuevo a nuestro propio Worker
                    let proxySegmentUrl = `${url.origin}${url.pathname}?url=${encodeURIComponent(absoluteSegmentUrl)}`;
                    if (sid) proxySegmentUrl += `&sid=${encodeURIComponent(sid)}`;
                    if (identifier) proxySegmentUrl += `&identifier=${encodeURIComponent(identifier)}`;
                    
                    return proxySegmentUrl;
                }).join('\n');

                return new Response(rewrittenText, {
                    status: res.status,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/vnd.apple.mpegurl",
                        "Cache-Control": "no-cache, no-store, must-revalidate"
                    }
                });
            }

            // Si es un segmento de video (.ts, .m4s), lo devolvemos tal cual (Streaming)
            const responseHeaders = new Headers(res.headers);
            // Sobrescribimos CORS de Angelthump para que el navegador no bloquee el video
            responseHeaders.set("Access-Control-Allow-Origin", "*");
            responseHeaders.set("Access-Control-Allow-Headers", "*");
            responseHeaders.delete("Content-Security-Policy"); // Evitar bloqueos del frame

            return new Response(res.body, {
                status: res.status,
                headers: responseHeaders
            });

        } catch (e) {
            return new Response(JSON.stringify({ error: "Fallo al hacer proxy: " + e.message }), { 
                status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // ==========================================
    // 2. POST: OBTENCIÓN DEL TOKEN (Autenticación)
    // ==========================================
    if (request.method === "POST") {
        try {
            const body = await request.json();
            const { channel, patreon, sid, password, identifier } = body;

            let sessionCookie = null;
            const baseHeaders = {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://player.angelthump.com/"
            };

            // A. LÓGICA USUARIO NORMAL (Público con Contraseña)
            if (!patreon && password) {
                const passRes = await fetch(`https://angelthump.com/api/channel/${channel}/password`, {
                    method: "POST",
                    headers: baseHeaders,
                    body: JSON.stringify({ password })
                });

                if (!passRes.ok) {
                    const errorText = await passRes.text();
                    return new Response(JSON.stringify({ error: "Contraseña incorrecta." }), { 
                        status: passRes.status > 200 ? passRes.status : 401, 
                        headers: { ...corsHeaders, "Content-Type": "application/json" } 
                    });
                }

                const setCookieRaw = passRes.headers.get('set-cookie');
                if (setCookieRaw) {
                    sessionCookie = setCookieRaw.split(';')[0];
                }
            } 
            // B. LÓGICA USUARIO PATREON (SID detectado)
            else if (patreon && sid) {
                sessionCookie = `angelthump.sid=${sid}`;
            }

            // C. CANJEAR SESIÓN/PASS POR EL TOKEN HLS FINAL
            const tokenHeaders = { ...baseHeaders };
            if (sessionCookie) tokenHeaders["Cookie"] = sessionCookie;
            if (identifier) tokenHeaders["identifier"] = identifier;

            const tokenRes = await fetch(`https://vigor.angelthump.com/${channel}/token`, {
                method: "POST",
                headers: tokenHeaders,
                body: JSON.stringify({ patreon: !!patreon })
            });

            const tokenData = await tokenRes.json();
            
            if (!tokenRes.ok || !tokenData.token) {
                 return new Response(JSON.stringify({ error: tokenData.message || "Fallo al canjear la sesión por el token de vídeo." }), { 
                     status: tokenRes.status > 200 ? tokenRes.status : 401, 
                     headers: { ...corsHeaders, "Content-Type": "application/json" } 
                 });
            }

            // Devolver el token (y devolver el identifier si venía, por compatibilidad con App.jsx)
            return new Response(JSON.stringify({ token: tokenData.token, identifier: identifier || null }), { 
                status: 200, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });

        } catch (error) {
            return new Response(JSON.stringify({ error: "Error interno del proxy: " + error.message }), { 
                status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }
}