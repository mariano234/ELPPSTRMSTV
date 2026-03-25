export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

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
    // PROXY GET: PUENTE TOTAL PARA .M3U8 Y FRAGMENTOS DE VIDEO
    // ==========================================
    if (request.method === "GET") {
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) return new Response(JSON.stringify({ error: "Falta la URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        // Extraemos las credenciales PRO que nos manda el App.jsx en la URL
        const sid = url.searchParams.get('sid');
        const identifier = url.searchParams.get('identifier');

        const proxyHeaders = {
            "accept": "*/*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Origin": "https://angelthump.com",
            "Referer": "https://angelthump.com/"
        };

        // ¡AQUÍ ESTÁ LA MAGIA PRO! Si es Patreon, Angelthump exige estas cabeceras para descargar el video
        if (sid) proxyHeaders["Cookie"] = `angelthump.sid=${sid}`;
        if (identifier) proxyHeaders["identifier"] = identifier;

        try {
            const res = await fetch(targetUrl, {
                method: 'GET',
                headers: proxyHeaders
            });

            const contentType = res.headers.get("content-type");
            let body = await res.arrayBuffer(); // Binario para no corromper el video
            
            // Si es la lista de reproducción (m3u8), reescribimos los enlaces internos
            if (contentType && (contentType.includes("application/vnd.apple.mpegurl") || contentType.includes("application/x-mpegURL"))) {
                let text = new TextDecoder("utf-8").decode(body);
                const baseUrl = new URL(targetUrl);
                const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

                const lines = text.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();
                    if (line && !line.startsWith('#')) {
                        let absoluteUrl = line.startsWith('http') ? line : basePath + line;
                        
                        // Redirigir el fragmento a este mismo proxy
                        let proxyUrl = `${url.origin}${url.pathname}?url=${encodeURIComponent(absoluteUrl)}`;
                        
                        // Propagar las credenciales PRO al siguiente fragmento
                        if (sid) proxyUrl += `&sid=${encodeURIComponent(sid)}`;
                        if (identifier) proxyUrl += `&identifier=${encodeURIComponent(identifier)}`;
                        
                        lines[i] = proxyUrl;
                    }
                }
                text = lines.join('\n');
                body = new TextEncoder().encode(text);
            }

            return new Response(body, {
                status: res.status,
                headers: {
                    ...corsHeaders,
                    "Content-Type": contentType || "application/octet-stream",
                    "Cache-Control": "no-cache"
                }
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: "Proxy Error: " + err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
    }

    // ==========================================
    // POST: OBTENER EL TOKEN DEL DIRECTO
    // ==========================================
    if (request.method === "POST") {
        try {
            const body = await request.json();
            const channel = body.channel;
            const usePatreon = body.patreon === true;
            const password = body.password;
            
            let sid = body.sid;
            // Aceptamos el identifier tanto en el JSON como en las cabeceras
            let identifier = body.identifier || request.headers.get('identifier');

            if (!channel) {
                return new Response(JSON.stringify({ error: "Falta el canal" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const baseHeaders = {
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "Origin": "https://angelthump.com",
                "Referer": "https://angelthump.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            };

            let sessionCookie = "";

            if (usePatreon) {
                // --- MODO PREMIUM (PATREON) ---
                if (!sid || !identifier) {
                    return new Response(JSON.stringify({ error: "Faltan credenciales Patreon (sid o identifier no encontrados)." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
                sessionCookie = `angelthump.sid=${sid}`;
            } else {
                // --- MODO GRATUITO (CONTRASEÑA) ---
                const passRes = await fetch(`https://vigor.angelthump.com/${channel}`, {
                    method: "POST",
                    headers: baseHeaders,
                    body: JSON.stringify({ password: password })
                });

                if (!passRes.ok) {
                    const passData = await passRes.json().catch(() => ({}));
                    return new Response(JSON.stringify({ error: passData.message || "Contraseña incorrecta." }), { status: passRes.status > 200 ? passRes.status : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }

                const setCookieRaw = passRes.headers.get('set-cookie');
                if (setCookieRaw) {
                    sessionCookie = setCookieRaw.split(';')[0];
                }
            }

            // --- FETCH FINAL DEL TOKEN ---
            const tokenHeaders = { ...baseHeaders };
            if (sessionCookie) tokenHeaders["Cookie"] = sessionCookie;
            if (identifier) tokenHeaders["identifier"] = identifier;

            const tokenRes = await fetch(`https://vigor.angelthump.com/${channel}/token`, {
                method: "POST",
                headers: tokenHeaders,
                // AQUÍ ESTABA EL OTRO ERROR: Estaba hardcodeado a { patreon: false }. Ahora es dinámico.
                body: JSON.stringify({ patreon: usePatreon }) 
            });

            const tokenData = await tokenRes.json().catch(() => ({}));
            
            if (!tokenRes.ok || !tokenData.token) {
                 return new Response(JSON.stringify({ error: tokenData.message || "Identifier is not recognized o sesión inválida." }), { status: tokenRes.status > 200 ? tokenRes.status : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify(tokenData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } catch (error) {
            return new Response(JSON.stringify({ error: "Error interno: " + error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
    }
}