exports.handler = async function(event, context) {
    const sid = event.queryStringParameters.sid || '';
    const channel = event.queryStringParameters.channel || 'elpintaunas';
    const password = event.queryStringParameters.password || '';
    const patreon = event.queryStringParameters.patreon === 'true';

    // Cabeceras de camuflaje para evitar el bloqueo del Firewall de Angelthump
    const headers = { 
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://angelthump.com",
        "Referer": "https://angelthump.com/"
    };

    if (sid) {
        headers["Cookie"] = `angelthump.sid=${sid}`;
    }

    try {
        const bodyPayload = {};
        if (patreon) bodyPayload.patreon = true;
        if (password) bodyPayload.password = password;

        const response = await fetch(`https://vigor.angelthump.com/${channel}/token`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(bodyPayload)
        });

        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Fallo al conectar con Angelthump API: " + error.message })
        };
    }
}