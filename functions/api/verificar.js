import { json } from '../../server/live-http.js';

export function onRequest() {
  return json({ error: 'El acceso con Discord ha cambiado. Inicia sesión de nuevo desde Directos.' }, 410);
}
