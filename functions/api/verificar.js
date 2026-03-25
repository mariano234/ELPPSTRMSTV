export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  // Si no hay código, devolvemos error
  if (!code) {
    return new Response(JSON.stringify({ success: false, error: 'Falta el código de autorización' }), { 
        status: 400, 
        headers: corsHeaders 
    });
  }

  // Variables de Entorno (Deben coincidir con las configuradas en Cloudflare)
  const CLIENT_ID = env.CLIENT_ID;
  const CLIENT_SECRET = env.CLIENT_SECRET;
  const BOT_TOKEN = env.BOT_TOKEN;
  const GUILD_ID = env.GUILD_ID;
  const ROLE_ID = env.ROLE_ID;
  const CHANNEL_ID = env.CHANNEL_ID;
  
  // ¡MUY IMPORTANTE! Esta URL debe ser idéntica a la que usas en App.jsx y en Discord Developer Portal
  const REDIRECT_URI = 'https://elppstrmstv.pages.dev/?tab=directos';

  try {
    // --- FASE A: Intercambiar el código por el Token del Usuario ---
    const tokenParams = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
    });

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new Response(JSON.stringify({ success: false, error: `Error de OAuth2: ${tokenData.error_description || tokenData.error}` }), { 
          status: 401, headers: corsHeaders 
      });
    }

    // --- FASE B: Obtener la ID del Usuario ---
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    const userId = userData.id;

    // --- FASE C: Comprobar si está en el Servidor ---
    const memberRes = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`, {
      headers: { authorization: `Bot ${BOT_TOKEN}` } 
    });
    
    if (memberRes.status === 404) {
        return new Response(JSON.stringify({ success: false, error: 'No estás en el servidor de Discord' }), { 
            status: 403, headers: corsHeaders 
        });
    }
    
    const memberData = await memberRes.json();

    // --- FASE D: Comprobar si tiene el Rol VIP ---
    if (!memberData.roles || !memberData.roles.includes(ROLE_ID)) {
       return new Response(JSON.stringify({ success: false, error: 'No tienes el rol VIP necesario en el servidor' }), { 
           status: 403, headers: corsHeaders 
       });
    }

    // --- FASE E: Extraer la contraseña del canal (Con el Bot) ---
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

    // --- FASE F: Devolver la contraseña (Éxito) ---
    return new Response(JSON.stringify({ success: true, password: password }), { 
        status: 200, 
        headers: corsHeaders 
    });

  } catch (error) {
    console.error("Error en la verificación:", error);
    return new Response(JSON.stringify({ success: false, error: `Fallo interno del servidor: ${error.message}` }), { 
        status: 500, headers: corsHeaders 
    });
  }
}