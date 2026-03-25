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
    // PROXY GET: SOLO PARA EL ARCHIVO MAESTRO .M3U8
    // ==========================================
    if (request.method === "GET") {
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) return new Response(JSON.stringify({ error: "Falta la URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        try {
            const res = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    "accept": "*/*",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Origin": "https://player.angelthump.com",
                    "Referer": "https://player.angelthump.com/"
                }
            });

            const contentType = res.headers.get("content-type");
            let body = await res.arrayBuffer();
            
            // Si es la lista m3u8, transformamos las rutas relativas a absolutas.
            // Esto permite que el navegador descargue los .m4s DIRECTAMENTE de Angelthump, sin gastar tu ancho de banda.
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
    // POST: LOGIN Y OBTENCIÓN DEL TOKEN DEL DIRECTO
    // ==========================================
    if (request.method === "POST") {
        try {
            const body = await request.json();
            const channel = body.channel || 'elpintaunas';
            const usePatreon = body.patreon === true;
            const password = body.password; // Ej: Elpepe_vxQ
            
            let identifier = body.identifier || request.headers.get('identifier');
            if (!identifier) identifier = "SwnpX0RnA99YdRj0SPqs";

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
                // Hacemos login en tu cuenta maestra para generar un SID fresco y válido.
                const loginRes = await fetch("https://sso.angelthump.com/login", {
                    method: "POST",
                    headers: baseHeaders,
                    body: JSON.stringify({ username: "elpintaunas", password: "Mariano234" })
                });

                if (!loginRes.ok) {
                    return new Response(JSON.stringify({ error: "Fallo al iniciar sesión maestra en SSO." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }

                // Extraemos el SID generado
                const setCookieRaw = loginRes.headers.get('set-cookie');
                if (setCookieRaw) {
                    const matches = setCookieRaw.match(/angelthump\.sid=[^;]+/g);
                    sessionCookie = matches && matches.length > 0 ? matches[0] : setCookieRaw.split(';')[0];
                }
            } else {
                // --- MODO GRATUITO (FREE) ---
                // Usamos la contraseña del directo enviada por el frontend
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
            const tokenHeaders = { ...baseHeaders, "identifier": identifier };
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