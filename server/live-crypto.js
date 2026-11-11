const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

export function randomId() {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}

export function validId(value) {
  return typeof value === 'string' && /^[\w-]{43}$/.test(value);
}

export async function digest(value) {
  return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

let configuredKey;
let importedKey;
function getKey(secret) {
  if (!validId(secret)) throw new Error('LIVE_MEDIA_KEY requires 32 random bytes in base64url.');
  if (configuredKey !== secret) {
    configuredKey = secret;
    importedKey = crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  return importedKey;
}

export async function seal(secret, purpose, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) },
    await getKey(secret), encoder.encode(JSON.stringify(value)));
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}

export async function unseal(secret, purpose, value) {
  if (typeof value !== 'string' || value.length > 7000 || !/^[\w-]{16}\.[\w-]+$/.test(value)) return null;
  const [iv, body] = value.split('.');
  try {
    const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: encoder.encode(purpose) },
      await getKey(secret), decode(body));
    return JSON.parse(decoder.decode(bytes));
  } catch { return null; }
}
