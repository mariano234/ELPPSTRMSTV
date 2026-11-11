import { test, expect } from '@playwright/test';

async function fixtures(page, options = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ sdk = 'ready', resumed = false, cancel = false, cacheFull = false }) => {
    sessionStorage.setItem('stream_password', 'old-browser-password');
    sessionStorage.setItem('stream_sid', 'old-browser-sid');
    sessionStorage.setItem('stream_auth_time', Date.now().toString());
    if (cacheFull) {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('plex_library_full_cache_')) throw new DOMException('Storage full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    }
    const playing = new WeakMap();
    const sources = new WeakMap();
    HTMLMediaElement.prototype.canPlayType = () => 'probably';
    HTMLMediaElement.prototype.play = function () { playing.set(this, true); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { playing.set(this, false); };
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', { get() { return !playing.get(this); } });
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      get() { return sources.get(this) || ''; },
      set(value) { sources.set(this, value); queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))); },
    });
    const listeners = new Map();
    let connected = resumed;
    let mediaSession = null;
    const metrics = { options: 0, requests: 0, ends: 0, loads: [] };
    window.__castMetrics = metrics;
    window.__castListeners = () => Object.fromEntries([...listeners].map(([type, handlers]) => [type, handlers.size]));
    const emit = (type, value) => listeners.get(type)?.forEach(fn => fn(value));
    const session = {
      getMediaSession: () => mediaSession,
      loadMedia: async request => { metrics.loads.push(request.media); mediaSession = { media: request.media }; },
    };
    const context = {
      setOptions: () => metrics.options++,
      getCastState: () => connected ? 'CONNECTED' : 'NOT_CONNECTED',
      getCurrentSession: () => connected ? session : null,
      addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
      removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
      requestSession: async () => {
        metrics.requests++;
        if (cancel) throw 'cancel';
        connected = true;
        emit('cast', {});
        emit('session', { sessionState: 'SESSION_STARTED' });
      },
      endCurrentSession: () => {
        connected = false;
        mediaSession = null;
        metrics.ends++;
        emit('cast', {});
        emit('session', { sessionState: 'SESSION_ENDED' });
      },
    };
    window.__endCast = () => context.endCurrentSession(true);
    window.__installCast = () => {
      window.chrome ??= {};
      window.chrome.cast = {
        AutoJoinPolicy: { ORIGIN_SCOPED: 'origin' },
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: 'receiver', StreamType: { LIVE: 'LIVE' },
          HlsSegmentFormat: { FMP4: 'fmp4' }, HlsVideoSegmentFormat: { FMP4: 'fmp4' },
          MediaInfo: class { constructor(url, type) { this.contentId = url; this.contentType = type; } },
          GenericMediaMetadata: class {}, LoadRequest: class { constructor(media) { this.media = media; } },
        },
      };
      window.cast = { framework: {
        CastContext: { getInstance: () => context },
        CastContextEventType: { CAST_STATE_CHANGED: 'cast', SESSION_STATE_CHANGED: 'session' },
        SessionState: { SESSION_STARTED: 'SESSION_STARTED', SESSION_RESUMED: 'SESSION_RESUMED', SESSION_ENDED: 'SESSION_ENDED' },
      } };
      window.__onGCastApiAvailable?.(true);
    };
    if (sdk === 'ready') window.__installCast();
  }, options);

  let authenticated = options.authenticated !== false;
  let issued = 0;
  let sessionExpiry = Date.now() + (options.sessionLifetime ?? 3600000);
  await page.route('**/*', route => route.abort('blockedbyclient'));
  await page.route('https://www.gstatic.com/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('https://docs.google.com/**', route => route.fulfill({
    status: options.libraryStatus || 200, contentType: 'text/csv',
    body: '"Título","Año","Idioma","Calidad","lnkf"\n"Película de prueba","2026","","HD","https://example.com/demo"',
  }));
  await page.route('https://ppstreams.test/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/session') {
      if (route.request().method() === 'DELETE') {
        authenticated = false;
        return route.fulfill({ status: 204 });
      }
      return authenticated
        ? route.fulfill({ json: { authenticated: true, premium: Boolean(options.premium), expiresAt: sessionExpiry } })
        : route.fulfill({ status: 401, json: { error: 'Identifícate con Discord.' } });
    }
    if (url.pathname === '/api/tmdb') return route.fulfill({ json: { tmdbTitle: null, year: '2026', overview: 'Una descripción de prueba.', genres: ['Drama'], rating: '8.0' } });
    if (url.pathname === '/api/playback') {
      if (route.request().method() === 'DELETE') return route.fulfill({ status: 204 });
      const grant = `${++issued}`.padStart(43, 'a');
      const receiver = route.request().postDataJSON().receiver;
      const expiresAt = receiver === 'cast' ? Date.now() + 8 * 60 * 60 * 1000 : sessionExpiry;
      const extension = expiresAt > sessionExpiry ? { sessionExpiresAt: expiresAt } : {};
      sessionExpiry = Math.max(sessionExpiry, expiresAt);
      return route.fulfill({ json: { source: `/api/stream/${grant}/index.m3u8`, grant, expiresAt, ...extension } });
    }
    if (url.pathname.startsWith('/api/stream/')) {
      const fmp4 = options.format !== 'ts';
      return route.fulfill({ contentType: 'application/x-mpegurl', body: `#EXTM3U\n#EXT-X-TARGETDURATION:4\n${fmp4 ? '#EXT-X-MAP:URI="/api/stream/fixture/segment"\n' : ''}#EXTINF:4,\nsegment.${fmp4 ? 'm4s' : 'ts'}` });
    }
    const response = await route.fetch({ url: `http://127.0.0.1:8788${url.pathname}${url.search}` });
    return route.fulfill({ response, headers: { ...response.headers(), 'Referrer-Policy': 'no-referrer' } });
  });
  return errors;
}

test('an already-loaded SDK connects, sends FMP4, pauses local playback and disconnects', async ({ page }, testInfo) => {
  const errors = await fixtures(page);
  const permits = [];
  const revoked = [];
  page.on('request', request => {
    if (!request.url().endsWith('/api/playback')) return;
    if (request.method() === 'POST') permits.push({ body: request.postDataJSON(), origin: request.headers().origin });
    if (request.method() === 'DELETE') revoked.push(request.postDataJSON().grant);
  });
  await page.goto('https://ppstreams.test/directos');
  await page.getByRole('button', { name: /Enviar a TV/ }).click();
  await expect.poll(() => page.evaluate(() => window.__castMetrics.loads.length)).toBe(1);
  await expect(page.getByRole('button', { name: 'Desconectar TV' })).toBeEnabled();
  const media = await page.evaluate(() => window.__castMetrics.loads[0]);
  expect(media.hlsVideoSegmentFormat).toBe('fmp4');
  expect(media.contentId).toMatch(/^https:\/\/ppstreams\.test\/api\/stream\/[\w-]{43}\/index\.m3u8$/);
  expect(permits).toEqual(['browser', 'cast'].map(receiver => ({ origin: 'https://ppstreams.test', body: { channel: 'elpintaunas', mode: 'normal', receiver } })));
  expect(await page.evaluate(() => sessionStorage.getItem('stream_sid'))).toBeNull();
  expect(await page.locator('video').evaluate(video => video.paused)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cast-connected.png') });
  await page.getByRole('button', { name: 'Desconectar TV' }).click();
  await expect(page.getByRole('button', { name: /Enviar a TV/ })).toBeEnabled();
  await expect.poll(() => revoked).toContain(new URL(media.contentId).pathname.split('/')[3]);
  expect(await page.evaluate(() => window.__castMetrics.ends)).toBe(1);
  expect(await page.evaluate(() => window.__castMetrics.options)).toBe(1);
  expect(errors).toEqual([]);
});

test('disconnecting while a playlist is loading cancels it without a spurious error', async ({ page }) => {
  const errors = await fixtures(page);
  let resolveManifest;
  const manifestPending = new Promise(resolve => { resolveManifest = resolve; });
  await page.route('https://ppstreams.test/api/stream/**', async route => {
    await manifestPending;
    await route.fulfill({ contentType: 'application/x-mpegurl', body: '#EXTM3U\n#EXTINF:4,\nseg.ts' }).catch(() => {});
  });
  await page.goto('https://ppstreams.test/directos');
  await page.getByRole('button', { name: /Enviar a TV/ }).click();
  await expect(page.getByRole('button', { name: 'Desconectar TV' })).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => window.__endCast());
  resolveManifest();
  await expect(page.getByRole('button', { name: /Enviar a TV/ })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => window.__castMetrics.loads.length)).toBe(0);
  expect(errors).toEqual([]);
});

test('late SDK availability activates the existing button without reloading the page', async ({ page }) => {
  const errors = await fixtures(page, { sdk: 'delayed' });
  await page.goto('https://ppstreams.test/directos');
  await expect(page.getByRole('button', { name: 'Buscando TV…' })).toBeDisabled();
  await page.evaluate(() => window.__installCast());
  await page.getByRole('button', { name: /Enviar a TV/ }).click();
  await expect.poll(() => page.evaluate(() => window.__castMetrics.loads.length)).toBe(1);
  expect(errors).toEqual([]);
});

test('Cast can still be controlled after the original browser session deadline', async ({ page }) => {
  const errors = await fixtures(page, { sessionLifetime: 60000 });
  await page.clock.install();
  await page.goto('https://ppstreams.test/directos');
  await page.getByRole('button', { name: /Enviar a TV/ }).click();
  await expect.poll(() => page.evaluate(() => window.__castMetrics.loads.length)).toBe(1);
  await page.clock.fastForward(120000);
  await expect(page.getByRole('button', { name: 'Desconectar TV' })).toBeEnabled();
  await page.getByRole('button', { name: 'Desconectar TV' }).click();
  await expect(page.getByRole('button', { name: /Enviar a TV/ })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('retained sessions and returning to Directos do not accumulate listeners or reload the same media', async ({ page }) => {
  const errors = await fixtures(page, { resumed: true });
  await page.goto('https://ppstreams.test/directos');
  await expect.poll(() => page.evaluate(() => window.__castMetrics.loads.length)).toBe(1);
  await page.getByRole('link', { name: 'SERIES', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => window.__castListeners())).toEqual({ cast: 0, session: 0 });
  await page.getByRole('link', { name: 'DIRECTOS', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Desconectar TV' })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.__castListeners())).toEqual({ cast: 1, session: 1 });
  expect(await page.evaluate(() => window.__castMetrics.loads.length)).toBe(1);
  expect(await page.evaluate(() => window.__castMetrics.options)).toBe(1);
  expect(errors).toEqual([]);
});

test('changing the channel sends the new source to the connected TV once', async ({ page }) => {
  const errors = await fixtures(page, { resumed: true, format: 'ts' });
  await page.goto('https://ppstreams.test/directos');
  await expect.poll(() => page.evaluate(() => window.__castMetrics.loads.length)).toBe(1);
  await page.getByRole('combobox').selectOption('elpintaunas_1');
  await expect.poll(() => page.evaluate(() => window.__castMetrics.loads.length)).toBe(2);
  const media = await page.evaluate(() => window.__castMetrics.loads[1]);
  expect(media.customData.broadcast).toBe('elpintaunas_1:normal');
  expect(media.hlsVideoSegmentFormat).toBeUndefined();
  await expect.poll(() => page.evaluate(() => window.__castListeners())).toEqual({ cast: 1, session: 1 });
  expect(errors).toEqual([]);
});

test('cancelling the device picker does not display an error or stop local video', async ({ page }) => {
  const errors = await fixtures(page, { cancel: true });
  await page.goto('https://ppstreams.test/directos');
  await page.getByRole('button', { name: /Enviar a TV/ }).click();
  expect(await page.evaluate(() => window.__castMetrics.loads.length)).toBe(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.locator('video').evaluate(video => video.paused)).toBe(false);
  expect(errors).toEqual([]);
});

test('a denied Discord role leaves Directos locked even with old credentials in storage', async ({ page }) => {
  const errors = await fixtures(page, { authenticated: false });
  await page.goto('https://ppstreams.test/directos?login=denied');
  await expect(page.getByRole('alert')).toContainText('Necesitas el rol de Patreon o Colaborador');
  await expect(page.getByRole('link', { name: 'Verificar Rol de Discord' })).toHaveAttribute('href', '/api/auth/discord');
  await expect(page.getByRole('button', { name: /Enviar a TV/ })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('stream_password'))).toBeNull();
  await expect(page).toHaveURL('https://ppstreams.test/directos');
  expect(errors).toEqual([]);
});

test('a premium member can choose Normal and sign out from Directos', async ({ page }) => {
  const errors = await fixtures(page, { premium: true });
  const modes = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/playback') && request.method() === 'POST') modes.push(request.postDataJSON().mode);
  });
  await page.goto('https://ppstreams.test/directos');
  await expect(page.getByRole('button', { name: /Enviar a TV/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Normal (Público)' }).click();
  await expect.poll(() => modes).toEqual(['premium', 'normal']);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('link', { name: 'Verificar Rol de Discord' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Enviar a TV/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('catalogue failures are visible and Retry loads the catalogue', async ({ page }) => {
  const errors = await fixtures(page, { libraryStatus: 503, authenticated: false });
  await page.goto('https://ppstreams.test/inicio');
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar la biblioteca');
  await page.route('https://docs.google.com/**', route => route.fulfill({ contentType: 'text/csv', body: 'Título,Año,Idioma\nPelícula de prueba,2026,""' }));
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Película de prueba' }).first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a full local cache does not hide the catalogue, and search does not refetch the entire library', async ({ page }) => {
  const errors = await fixtures(page, { cacheFull: true });
  let sheetRequests = 0;
  page.on('request', request => { if (request.url().includes('docs.google.com')) sheetRequests++; });
  await page.goto('https://ppstreams.test/inicio');
  await expect(page.getByRole('heading', { name: 'Película de prueba' }).first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByPlaceholder('Buscar películas...').first().fill('Película');
  await expect(page.getByText('Resultados de búsqueda', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Película de prueba' }).first()).toBeVisible();
  expect(sheetRequests).toBe(1);
  expect(errors).toEqual([]);
});
