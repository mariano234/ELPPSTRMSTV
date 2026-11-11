# Acceso y reproducción de Directos

La API valida el rol de Discord y emite una sesión propia en una cookie `HttpOnly`, `Secure` y `SameSite=Lax`. El navegador usa esa sesión para iniciar el vídeo. Chromecast recibe un permiso revocable de ocho horas desde el envío, limitado a un canal y modo. Si a la sesión le quedan menos de ocho horas, la web renueva la cookie y amplía la sesión hasta cubrir la reproducción. Las rutas antiguas de verificación y proxy devuelven `410`.

El servidor usa la contraseña o el SID de AngelThump para pedir un token de vídeo y conserva el token cifrado. Lo comparte entre el navegador y Chromecast de la misma sesión y emisión. El permiso propio y las listas de calidad conservan su validez cuando cambia el token. El servidor usa `expires_in` si el proveedor lo incluye. En ausencia de ese dato intenta renovar a los 50 minutos y también puede renovar tras un `401` o `403` en la lista HLS. Una sesión activa vuelve a verificar el rol cada cinco minutos. Cerrar sesión revoca también sus permisos de vídeo.

## Configuración para la futura revisión real

1. Crear o elegir una base D1, aplicar [la migración](../migrations/0001_live_access.sql) y vincularla al proyecto de Pages como `LIVE_DB`. Usar una base distinta para una vista previa que vaya a recibir sesiones reales.
2. Configurar `LIVE_ORIGIN` con el origen HTTPS donde esté la versión que se va a probar. En producción el valor por defecto es `https://elppstrmstv.pages.dev`. Añadir en la aplicación de Discord el callback exacto `https://<origen>/api/auth/callback` del entorno elegido. Se mantienen `CLIENT_ID`, `CLIENT_SECRET`, `BOT_TOKEN` y `GUILD_ID`.
3. Definir el acceso en el entorno. Si los dos grupos comparten un rol que se asigna solo a Patreon y Colaborador, conservar su `ROLE_ID`. Si tienen IDs distintos, configurar `PATREON_ROLE_ID` y `PATREON_COLLABORATOR_ROLE_ID`. Si además se conserva `ROLE_ID`, ese ID también concede acceso.
4. Añadir `LIVE_MEDIA_KEY` como secreto de Pages. Debe contener 32 bytes aleatorios en base64url. Se puede generar localmente con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
5. Configurar `ANGELTHUMP_PASSWORD` para el canal principal y `ANGELTHUMP_SID` para Premium como secretos. El canal secundario en modo Normal mantiene el flujo sin contraseña de AngelThump dentro de Directos. Si ya se usa el mensaje del canal privado, se puede conservar `CHANNEL_ID` como origen de los valores que no se configuren como secreto. `CREDENTIAL_AUTHOR_ID` permite limitar los mensajes a la cuenta que los publica. En ambos casos el servidor lee y usa los valores.
6. El origen de receptor Cast por defecto es `https://www.gstatic.com`. `LIVE_CAST_ORIGINS` admite una lista de orígenes exactos separados por comas si la prueba real muestra otro receptor autorizado. `ANGELTHUMP_MEDIA_HOSTS` permite añadir nombres exactos de CDN si el proveedor cambia de destino. `ANGELTHUMP_RENEW_SECONDS` permite ajustar el intervalo de renovación si se confirma otra vigencia.

Las URL de Cast incluyen un permiso propio reutilizable mientras esté vigente. Los registros y exportaciones de diagnóstico deben omitir el segmento del permiso, los parámetros de vídeo y los parámetros del callback. La configuración del repositorio desactiva los registros de invocación en el runtime que admita ese ajuste. Revisar la configuración efectiva de Pages antes de usar la prueba real. La política CSP de `/directos` empieza en modo informe para observar las dependencias de Cast.

## Pruebas internas

Con Node 22.13 o posterior y las dependencias instaladas:

```powershell
npm run lint
npm test
npm run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

La suite del servidor aplica la migración a SQLite en memoria y simula Discord y AngelThump. Playwright sirve la compilación desde `127.0.0.1`, simula Chromecast y bloquea las peticiones del navegador que estén fuera de las respuestas de prueba. Para la revisión real bastará con verificar un usuario de cada rol permitido, un usuario sin rol y el envío a una TV compatible. La renovación más allá de una hora ya se comprueba con reloj simulado.
