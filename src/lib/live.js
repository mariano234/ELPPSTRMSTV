import { API_BASE } from '../config.js';

export const discordLoginUrl = `${API_BASE}/auth/discord`;

export function clearLegacyAccess() {
  try {
    for (const key of ['stream_password', 'stream_sid', 'stream_auth_time']) sessionStorage.removeItem(key);
  } catch { /* Storage can be unavailable on some devices. */ }
}

async function apiRequest(path, options) {
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...options });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo conectar con Directos.');
    error.status = response.status;
    throw error;
  }
  return data;
}

let sessionRequest;
export function readLiveSession() {
  if (!sessionRequest) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    sessionRequest = apiRequest('/session', { signal: controller.signal })
      .catch(error => {
        if (error.status === 401) return null;
        throw error;
      })
      .finally(() => { clearTimeout(timer); sessionRequest = null; });
  }
  return sessionRequest;
}

export function requestPlayback(channel, mode, receiver, signal) {
  return apiRequest('/playback', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, mode, receiver }), signal,
  });
}

export function revokePlayback(grant) {
  if (!grant) return;
  return apiRequest('/playback', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant }), keepalive: true,
  }).catch(() => { /* Logout and expiry also invalidate playback. */ });
}

export function logoutLive() {
  return apiRequest('/session', { method: 'DELETE' });
}
