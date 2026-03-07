export async function onRequest(context) {
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

  // AHORA SÍ: Usamos exactamente los nombres que tienes en tu captura de pantalla
  const CLIENT_ID = env.CLIENT_ID;
  const CLIENT_SECRET = env.CLIENT_SECRET;
  const BOT_TOKEN = env.BOT_TOKEN;
  const GUILD_ID = env.GUILD_ID;
  const ROLE_ID = env.ROLE_ID;
  const CHANNEL_ID = env.CHANNEL_ID;
  
  const REDIRECT_URI = 'https://pruebaelppstrmstv.pages.dev/?tab=directos';

  try {
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

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    const memberRes = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${userData.id}`, {
      headers: { authorization: `Bot ${BOT_TOKEN}` } 
    });
    if (memberRes.status === 404) {
        return new Response(JSON.stringify({ success: false, error: 'No estás en el servidor' }), { 
            status: 403, headers: corsHeaders 
        });
    }
    const memberData = await memberRes.json();

    if (!memberData.roles.includes(ROLE_ID)) {
       return new Response(JSON.stringify({ success: false, error: 'No tienes el rol VIP necesario' }), { 
           status: 403, headers: corsHeaders 
       });
    }

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