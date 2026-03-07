export async function onRequest(context) {
  // En Cloudflare Pages Functions, context.request tiene la URL y context.env las variables de entorno
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (!code) {
    return new Response(JSON.stringify({ success: false, error: 'Falta el código' }), { 
        status: 400, 
        headers: corsHeaders 
    });
  }

  // Obtenemos las variables de entorno desde el panel de Cloudflare (context.env)
  const CLIENT_ID = env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = env.DISCORD_CLIENT_SECRET;
  const BOT_TOKEN = env.DISCORD_BOT_TOKEN;
  const GUILD_ID = env.DISCORD_GUILD_ID;
  const ROLE_ID = env.DISCORD_ROLE_ID;
  const CHANNEL_ID = env.DISCORD_CHANNEL_ID;
  const REDIRECT_URI = 'https://elpepestreamstv.marianopepe234.workers.dev/?tab=directos';

  try {
    // --- FASE A: Intercambiar código por Token del Usuario ---
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });
    
    const tokenData = await tokenRes.json();
    
    if (!tokenData.access_token) {
        return new Response(JSON.stringify({ success: false, error: 'Código inválido o ya usado', detalles: tokenData }), { 
            status: 401, headers: corsHeaders 
        });
    }

    // --- FASE B: Saber quién es el usuario ---
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    // --- FASE C: Buscar al usuario en tu servidor ---
    const memberRes = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${userData.id}`, {
      headers: { authorization: `Bot ${BOT_TOKEN}` } 
    });
    if (memberRes.status === 404) {
        return new Response(JSON.stringify({ success: false, error: 'No estás en el servidor' }), { 
            status: 403, headers: corsHeaders 
        });
    }
    const memberData = await memberRes.json();

    // --- FASE D: Comprobar el Rol ---
    if (!memberData.roles.includes(ROLE_ID)) {
       return new Response(JSON.stringify({ success: false, error: 'No tienes el rol VIP necesario' }), { 
           status: 403, headers: corsHeaders 
       });
    }

    // --- FASE E: Extraer el mensaje ---
    const msgRes = await fetch(`https://discord.com/api/channels/${CHANNEL_ID}/messages?limit=1`, {
      headers: { authorization: `Bot ${BOT_TOKEN}` }
    });
    const msgData = await msgRes.json();

    if (msgData.message) {
       return new Response(JSON.stringify({ success: false, error: `Discord bloqueó al bot: ${msgData.message}` }), { 
           status: 403, headers: corsHeaders 
       });
    }

    if (!Array.isArray(msgData) || msgData.length === 0) {
       return new Response(JSON.stringify({ success: false, error: 'El canal de la contraseña está totalmente vacío.' }), { 
           status: 404, headers: corsHeaders 
       });
    }

    const password = msgData[0].content; 

    return new Response(JSON.stringify({ success: true, password: password }), { 
        status: 200, headers: corsHeaders 
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 500, headers: corsHeaders 
    });
  }
}