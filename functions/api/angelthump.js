import { json } from '../../server/live-http.js';

export function onRequest() {
  return json({ error: 'El acceso al vídeo ha cambiado. Recarga la página de Directos.' }, 410);
}
