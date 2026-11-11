import test from 'node:test';
import assert from 'node:assert/strict';
import { createCastLoader, createCastRequest, detectHlsFormat, getCastMediaUrl, isCastCancellation } from '../src/lib/cast.js';

function sdkHost(ready = true) {
  const options = [];
  const context = { setOptions: value => options.push(value) };
  const scripts = new Map();
  const timers = new Map();
  const host = {
    document: {
      getElementById: id => scripts.get(id),
      createElement: () => ({ listeners: new Map(), addEventListener(type, fn) { this.listeners.set(type, fn); }, removeEventListener(type) { this.listeners.delete(type); } }),
      head: { appendChild: script => scripts.set(script.id, script) },
    },
    setTimeout: fn => { const id = timers.size; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  };
  const install = () => {
    host.cast = { framework: { CastContext: { getInstance: () => context } } };
    host.chrome = { cast: { media: { DEFAULT_MEDIA_RECEIVER_APP_ID: 'receiver' }, AutoJoinPolicy: { ORIGIN_SCOPED: 'origin' } } };
  };
  if (ready) install();
  return { host, context, options, scripts, timers, install };
}

test('an already-loaded Cast SDK is configured, exactly once across remounts', async () => {
  const sdk = sdkHost();
  const load = createCastLoader(sdk.host);
  assert.strictEqual(load(), load());
  assert.strictEqual(await load(), sdk.context);
  assert.deepEqual(sdk.options, [{ receiverApplicationId: 'receiver', autoJoinPolicy: 'origin' }]);
  assert.equal(sdk.scripts.size, 0);
});

test('concurrent mounts share a delayed SDK and callback cleanup', async () => {
  const sdk = sdkHost(false);
  const previous = () => {};
  sdk.host.__onGCastApiAvailable = previous;
  const load = createCastLoader(sdk.host);
  const first = load();
  assert.strictEqual(first, load());
  assert.equal(sdk.scripts.size, 1);
  sdk.install();
  sdk.host.__onGCastApiAvailable(true);
  assert.strictEqual(await first, sdk.context);
  assert.equal(sdk.options.length, 1);
  assert.strictEqual(sdk.host.__onGCastApiAvailable, previous);
  assert.equal(sdk.timers.size, 0);
});

test('an unavailable SDK, network failure and timeout reject instead of hanging', async t => {
  for (const reason of ['unavailable', 'network', 'timeout']) await t.test(reason, async () => {
    const sdk = sdkHost(false);
    const pending = createCastLoader(sdk.host)();
    const rejection = assert.rejects(pending, /Google Cast/);
    if (reason === 'unavailable') sdk.host.__onGCastApiAvailable(false);
    if (reason === 'network') sdk.scripts.get('cast-sdk').listeners.get('error')();
    if (reason === 'timeout') [...sdk.timers.values()][0]();
    await rejection;
    assert.equal(sdk.timers.size, 0);
  });
});

test('Cast only accepts the site’s opaque playback link and drops extra URL parameters', () => {
  const path = `/api/stream/${'a'.repeat(43)}/index.m3u8`;
  const source = `${path}?token=unexpected#fragment`;
  const url = new URL(getCastMediaUrl(source, 'https://community.example'));
  assert.equal(url.href, `https://community.example${path}`);
  assert.throws(() => getCastMediaUrl(`https://other.example${path}`, 'https://community.example'), /permiso de reproducción/);
  assert.throws(() => getCastMediaUrl('/api/angelthump?url=test', 'https://community.example'), /permiso de reproducción/);
});

test('Cast never silently switches local development to a different production backend', () => {
  for (const origin of ['http://localhost:5173', 'https://localhost', 'https://127.0.0.1', 'https://[::1]']) {
    assert.throws(() => getCastMediaUrl(`/api/stream/${'a'.repeat(43)}/index.m3u8`, origin), /HTTPS accesible/);
  }
});

test('follow a master playlist and identify real FMP4 initialization segments', async () => {
  const urls = [];
  const format = await detectHlsFormat('https://community.example/master.m3u8', { fetcher: async url => {
    urls.push(url);
    return new Response(url.endsWith('master.m3u8') ? '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nlevels/720.m3u8' : '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4,\nseg.m4s');
  } });
  assert.equal(format, 'fmp4');
  assert.deepEqual(urls, ['https://community.example/master.m3u8', 'https://community.example/levels/720.m3u8']);
});

test('MPEG-TS remains TS and malformed/failed manifests are rejected', async () => {
  assert.equal(await detectHlsFormat('https://community.example/live', { fetcher: async () => new Response('#EXTM3U\n#EXTINF:4,\nseg.ts') }), 'ts');
  await assert.rejects(detectHlsFormat('https://community.example/live', { fetcher: async () => new Response('<html>login</html>') }), /HLS válida/);
  await assert.rejects(detectHlsFormat('https://community.example/live', { fetcher: async () => new Response('offline', { status: 503 }) }), /lista de reproducción/);
});

test('only FMP4 streams send FMP4 hints to the receiver', () => {
  const host = { chrome: { cast: { media: {
    MediaInfo: class { constructor(url, type) { this.contentId = url; this.contentType = type; } },
    LoadRequest: class { constructor(media) { this.media = media; } }, GenericMediaMetadata: class {},
    StreamType: { LIVE: 'LIVE' }, HlsSegmentFormat: { FMP4: 'fmp4' }, HlsVideoSegmentFormat: { FMP4: 'fmp4' },
  } } } };
  assert.equal(createCastRequest(host, 'https://community.example/live', 'fmp4').media.hlsVideoSegmentFormat, 'fmp4');
  const ts = createCastRequest(host, 'https://community.example/live', 'ts');
  assert.equal(ts.media.hlsVideoSegmentFormat, undefined);
  assert.equal(ts.autoplay, true);
  assert.equal(ts.media.streamType, 'LIVE');
  assert.equal(isCastCancellation('cancel'), true);
  assert.equal(isCastCancellation({ code: 'cancel' }), true);
  assert.equal(isCastCancellation({ code: 'receiver_unavailable' }), false);
});
