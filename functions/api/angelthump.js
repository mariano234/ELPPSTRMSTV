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
    // PROXY GET: PUENTE TOTAL PARA .M3U8 Y FRAGMENTOS
    // ==========================================
    if (request.method === "GET") {
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) return new Response(JSON.stringify({ error: "Falta la URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        try {
            const res = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
                    "Referer": "https://angelthump.com/"
                }
            });

            const newHeaders = new Headers(res.headers);
            // CRÍTICO: Forzar CORS abierto para que el reproductor web y el Chromecast/TV no den error
            newHeaders.set("Access-Control-Allow-Origin", "*");
            newHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");

            // Si es un fragmento de video final (.ts, .m4s), lo devolvemos tal cual
            if (!targetUrl.includes('.m3u8')) {
                return new Response(res.body, { status: res.status, headers: newHeaders });
            }

            // Si es un .m3u8 (lista de reproducción), necesitamos reescribirla dinámicamente
            let text = await res.text();
            
            // Base URL original de Angelthump para construir las rutas absolutas
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            
            // Base URL de tu propio proxy (Cloudflare Pages/Worker)
            const proxyBase = `${url.origin}${url.pathname}?url=`;

            // Mantenemos los parámetros extra (como el token o sid) por si hacen falta para los fragmentos
            const currentParams = new URLSearchParams(url.search);
            currentParams.delete('url');
            const extraParams = currentParams.toString() ? `&${currentParams.toString()}` : '';

            const lines = text.split('\n');
            const rewrittenLines = lines.map(line => {
                line = line.trim();
                // Si la línea no es un comentario (#) ni está vacía, es un enlace a un archivo de video
                if (line && !line.startsWith('#')) {
                    // Aseguramos que la ruta apunte a Angelthump
                    const absoluteTarget = line.startsWith('http') ? line : baseUrl + line;
                    // Y obligamos a que pase por nuestro proxy
                    return proxyBase + encodeURIComponent(absoluteTarget) + extraParams;
                }
                return line;
            });

            // MEGA CRÍTICO PARA SMART TV (SAMSUNG S95F / TIZEN): 
            // Sobrescribimos a la fuerza el Content-Type para que el sistema operativo de la TV lo valide nativamente
            newHeaders.set("Content-Type", "application/x-mpegurl");

            return new Response(rewrittenLines.join('\n'), { status: res.status, headers: newHeaders });

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
    }

    // ==========================================
    // FLUJO POST: OBTENER TOKENS DE VÍDEO
    // ==========================================
    try {
        const body = await request.json();

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