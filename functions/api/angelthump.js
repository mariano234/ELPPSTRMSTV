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
    // PROXY GET: PARA SALTARS EL CORS DEL .M3U8
    // ==========================================
    if (request.method === "GET") {
        const targetUrl = url.searchParams.get('url');
        const sid = url.searchParams.get('sid');
        
        if (!targetUrl) return new Response(JSON.stringify({ error: "Falta la URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const getHeaders = {
            "accept": "*/*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Origin": "https://player.angelthump.com",
            "Referer": "https://player.angelthump.com/"
        };
        
        // Adjuntar la sesión si es de Patreon (necesaria para el m3u8 maestro)
        if (sid) getHeaders["Cookie"] = `angelthump.sid=${sid}`;

        try {
            const res = await fetch(targetUrl, {
                method: 'GET',
                headers: getHeaders
            });

            const contentType = res.headers.get("content-type");
            let body = await res.arrayBuffer();
            
            // Transformamos las rutas relativas a absolutas para que el navegador 
            // descargue los fragmentos (.m4s) directamente de Angelthump sin gastar tu proxy
            if (contentType && (contentType.includes("mpegurl") || contentType.includes("text/plain"))) {
                let text = new TextDecoder("utf-8").decode(body);
                const baseUrl = new URL(targetUrl);
                const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

                const lines = text.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();
                    if (line && !line.startsWith('#')) {
                        lines[i] = line.startsWith('http') ? line : basePath + line;
                    }
                }
                body = new TextEncoder().encode(lines.join('\n'));
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
    // POST: OBTENCIÓN DEL TOKEN DEL DIRECTO
    // ==========================================
    if (request.method === "POST") {
        try {
            const body = await request.json();
            const channel = body.channel || 'elpintaunas';
            const usePatreon = body.patreon === true;
            const password = body.password;
            
            let sid = body.sid;
            
            // Decodificar y limpiar el SID
            if (sid) {
                sid = decodeURIComponent(sid).replace(/['"]+/g, '').replace(/^angelthump\.sid=/, '').trim();
            }

            // ==========================================
            // MAGIA: EXTRAER EL IDENTIFIER REAL
            // ==========================================
            let realIdentifier = "SwnpX0RnA99YdRj0SPqs"; // Fallback seguro
            
            if (usePatreon && sid) {
                // ¡EL SECRETO DEL PREMIUM! Angelthump usa Express Session.
                // El identifier ES literalmente la primera parte de la cookie de sesión.
                let cleanSid = sid;
                if (cleanSid.startsWith('s%3A')) cleanSid = decodeURIComponent(cleanSid);
                if (cleanSid.startsWith('s:')) {
                    realIdentifier = cleanSid.substring(2).split('.')[0];
                } else {
                    realIdentifier = cleanSid.split('.')[0];
                }
            } else {
                // Modo Free: Robamos uno fresco de la web
                try {
                    const playerRes = await fetch(`https://player.angelthump.com/?channel=${channel}`, {
                        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
                    });
                    const html = await playerRes.text();
                    // Buscamos el identifier en el script de la página oficial de Angelthump
                    const match = html.match(/identifier\s*:\s*['"]([^'"]+)['"]/);
                    if (match && match[1]) {
                        realIdentifier = match[1];
                    }
                } catch (e) {
                    console.log("Fallo al robar el identifier, usando fallback.");
                }
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
                if (!sid) {
                    return new Response(JSON.stringify({ error: "Faltan credenciales Patreon (sid no encontrado)." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
                sessionCookie = `angelthump.sid=${sid}`;
            } else {
                // --- MODO GRATUITO (FREE) ---
                const passRes = await fetch("https://api.angelthump.com/v3/streams/password", {
                    method: "POST",
                    headers: baseHeaders,
                    body: JSON.stringify({ 
                        user_id: "330abf9e-0b6c-4545-b0b1-6e57ce2a79a5", 
                        password: password 
                    })
                });

                if (!passRes.ok) {
                    const passData = await passRes.json().catch(() => ({}));
                    return new Response(JSON.stringify({ error: passData.message || "Contraseña del directo incorrecta." }), { status: passRes.status > 200 ? passRes.status : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }

                const setCookieRaw = passRes.headers.get('set-cookie');
                if (setCookieRaw) {
                    const matches = setCookieRaw.match(/angelthump\.sid=[^;]+/g);
                    sessionCookie = matches && matches.length > 0 ? matches[0] : setCookieRaw.split(';')[0];
                }
            }

            // --- FETCH FINAL DEL TOKEN A VIGOR ---
            // Aquí enviamos el identificador real que extrajimos de la web (o el fallback)
            const tokenHeaders = { ...baseHeaders, "identifier": realIdentifier };
            if (sessionCookie) tokenHeaders["Cookie"] = sessionCookie;

            const tokenRes = await fetch(`https://vigor.angelthump.com/${channel}/token`, {
                method: "POST",
                headers: tokenHeaders,
                body: JSON.stringify({ patreon: usePatreon })
            });

            const tokenData = await tokenRes.json().catch(() => ({}));
            
            if (!tokenRes.ok || !tokenData.token) {
                 return new Response(JSON.stringify({ error: tokenData.message || "Fallo al obtener el token del CDN." }), { status: tokenRes.status > 200 ? tokenRes.status : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify(tokenData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } catch (error) {
            return new Response(JSON.stringify({ error: "Error interno: " + error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
    }
}