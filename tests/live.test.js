import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet as login } from '../functions/api/auth/discord.js';
import { onRequestGet as callback } from '../functions/api/auth/callback.js';
import { onRequestGet as session, onRequestDelete as logout } from '../functions/api/session.js';
import { onRequestPost as playback, onRequestDelete as revoke } from '../functions/api/playback.js';
import { onRequest as stream } from '../functions/api/stream/[grant]/[file].js';
import { onRequest as legacyProxy } from '../functions/api/angelthump.js';
import { onRequest as legacyLogin } from '../functions/api/verificar.js';
import { digest, randomId } from '../server/live-crypto.js';

const origin = 'https://ppstreams.test';
const castOrigin = 'https://www.gstatic.com';
const schema = readFileSync(new URL('../migrations/0001_live_access.sql', import.meta.url), 'utf8');

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(schema);
  t.after(() => sqlite.close());
  let now = Date.UTC(2026, 10, 11);
  t.mock.method(Date, 'now', () => now);
  const state = { roles: ['201'], calls: [], queries: 0, minted: [], html: false, redirect: false, rejected: null };
  const LIVE_DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind: (...args) => ({
        first: async () => { state.queries++; return statement.get(...args) ?? null; },
        run: async () => { state.queries++; return { meta: { changes: statement.run(...args).changes } }; },
      }) };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = await Promise.all(statements.map(statement => statement.run()));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const env = { LIVE_DB, LIVE_ORIGIN: origin, LIVE_MEDIA_KEY: randomId(), CLIENT_ID: '101', CLIENT_SECRET: 'private-client-secret',
    BOT_TOKEN: 'private-discord-bot-token', GUILD_ID: '102', PATREON_ROLE_ID: '201', PATREON_COLLABORATOR_ROLE_ID: '202',
    ANGELTHUMP_SID: 'private-sid-fixture', ANGELTHUMP_PASSWORD: 'private-password-fixture' };
  let codeChallenge;
  const prefix = randomId().slice(0, 12);
  const premiumTokens = new Set();
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    const url = new URL(input);
    const headers = new Headers(options.headers);
    state.calls.push({ url, headers, body: options.body });
    if (url.hostname === 'discord.com') {
      if (url.pathname.endsWith('/oauth2/token')) {
        const body = new URLSearchParams(options.body);
        assert.equal(body.get('client_secret'), env.CLIENT_SECRET);
        assert.equal(await digest(body.get('code_verifier')), codeChallenge);
        return Response.json({ access_token: 'private-discord-access-token', refresh_token: 'private-refresh-token' });
      }
      if (url.pathname.endsWith('/users/@me')) return Response.json({ id: '501' });
      if (url.pathname.endsWith('/members/501')) {
        assert.equal(headers.get('Authorization'), `Bot ${env.BOT_TOKEN}`);
        return state.roles === null ? Response.json({}, { status: 404 }) : Response.json({ roles: state.roles });
      }
      if (url.pathname.endsWith('/channels/103/messages')) {
        return Response.json([{ content: state.credentialMessage, author: { id: '888' } }]);
      }
    }
    if (url.hostname === 'api.angelthump.com') {
      if (url.pathname === '/v3/users') return Response.json([{ id: 'fixture-video-user' }]);
      if (url.pathname === '/v3/streams/password') {
        assert.equal(JSON.parse(options.body).password, env.ANGELTHUMP_PASSWORD);
        return Response.json({}, { headers: { 'Set-Cookie': 'server-only-stream-session=fixture; Secure' } });
      }
    }
    if (url.hostname === 'vigor.angelthump.com') {
      if (url.pathname.endsWith('/token')) {
        const token = `private-origin-token-${prefix}-${state.minted.length + 1}`;
        if (JSON.parse(options.body).patreon) {
          assert.equal(headers.get('Cookie'), `angelthump.sid=${env.ANGELTHUMP_SID || 'legacy-private-sid'}`);
          premiumTokens.add(token);
        } else if (url.pathname === '/elpintaunas/token' && env.ANGELTHUMP_PASSWORD) {
          assert.equal(headers.get('Cookie'), 'server-only-stream-session=fixture');
        }
        state.minted.push(token);
        return Response.json({ token, expires_in: 3600 });
      }
      if (url.pathname.endsWith('.m3u8')) {
        const token = url.searchParams.get('token');
        assert.ok(state.minted.includes(token));
        if (token === state.rejected) return new Response('expired', { status: 403 });
        if (state.redirect) return new Response(null, { status: 302, headers: { Location: 'https://unrelated.invalid/video' } });
        const mediaHost = premiumTokens.has(token) ? 'nyc-patreon.angelthump.com' : 'sfo1.angelthump.com';
        const variants = [
          `#EXT-X-STREAM-INF:BANDWIDTH=1800000,RESOLUTION=1280x720\nhttps://${mediaHost}/${token}/high/index.m3u8`,
          `#EXT-X-STREAM-INF:BANDWIDTH=640000,RESOLUTION=640x360\nhttps://${mediaHost}/${token}/low/index.m3u8`,
        ];
        if (state.minted.length > 1) variants.reverse();
        return new Response(`#EXTM3U\n#EXT-X-DEFINE:NAME="private",VALUE="${token}"\n${variants.join('\n')}\n`);
      }
    }
    if (['sfo1.angelthump.com', 'nyc1.angelthump.com', 'fra1.angelthump.com', 'nyc-patreon.angelthump.com'].includes(url.hostname)) {
      if (url.pathname.endsWith('/index.m3u8')) {
        if (url.hostname === 'sfo1.angelthump.com' && state.normalRefreshHost) {
          return new Response(null, { status: 302, headers: { Location: `https://${state.normalRefreshHost}${url.pathname}` } });
        }
        return new Response('#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXT-X-MAP:URI="../init.mp4"\n#EXTINF:4,\nclip.m4s\n');
      }
      if (state.html) return new Response('<html>Unexpected</html>', { headers: { 'Content-Type': 'text/html' } });
      const range = headers.get('Range');
      return new Response(options.method === 'HEAD' ? null : new Uint8Array([1, 2, 3, 4]), {
        status: range ? 206 : 200,
        headers: { 'Content-Type': 'video/mp4', 'Set-Cookie': 'private-origin-cookie=fixture',
          ...(range ? { 'Content-Range': 'bytes 0-3/10', 'Accept-Ranges': 'bytes' } : {}) },
      });
    }
    assert.fail(`unexpected provider: ${url.hostname}`);
  });

  const call = (handler, path, { method = 'GET', cookie, requestOrigin, body, headers = {}, params } = {}) => handler({
    env, params, request: new Request(new URL(path, origin), { method, headers: {
      ...headers, ...(cookie ? { Cookie: cookie } : {}), ...(requestOrigin ? { Origin: requestOrigin } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, body: body ? JSON.stringify(body) : undefined }),
  });
  const begin = async () => {
    const response = await call(login, '/api/auth/discord');
    assert.equal(response.status, 303);
    const url = new URL(response.headers.get('Location'));
    assert.equal(url.searchParams.get('redirect_uri'), `${origin}/api/auth/callback`);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    codeChallenge = url.searchParams.get('code_challenge');
    return { state: url.searchParams.get('state'), cookie: response.headers.getSetCookie()[0].split(';')[0] };
  };
  const finish = attempt => call(callback, `/api/auth/callback?${new URLSearchParams({ state: attempt.state, code: 'fixture-code' })}`, { cookie: attempt.cookie });
  const authenticate = async () => {
    const response = await finish(await begin());
    assert.equal(response.headers.get('Location'), `${origin}/directos`);
    const auth = response.headers.getSetCookie().find(value => value.startsWith('__Host-pp_session='));
    assert.match(auth, /HttpOnly; Secure; SameSite=Lax/);
    return auth.split(';')[0];
  };
  const permit = async (cookie, receiver = 'browser', mode = 'premium', channel = 'elpintaunas') => {
    const response = await call(playback, '/api/playback', { method: 'POST', cookie, requestOrigin: origin, body: { channel, mode, receiver } });
    assert.equal(response.status, 200);
    return response.json();
  };
  const media = (path, options) => {
    const url = new URL(path, origin);
    const [, , , grant, file] = url.pathname.split('/');
    return call(stream, url.href, { ...options, params: { grant, file } });
  };
  return { state, env, sqlite, call, begin, finish, authenticate, permit, media, advance: ms => { now += ms; } };
}

function lines(text) {
  return text.split('\n').filter(line => line.startsWith(`${origin}/`));
}

test('Patreon, Colaborador and the configured common role can create opaque sessions', async t => {
  const f = fixture(t);
  f.env.ROLE_ID = '203';
  for (const role of ['201', '202', '203']) {
    f.state.roles = [role];
    const cookie = await f.authenticate();
    const info = await f.call(session, '/api/session', { cookie });
    assert.deepEqual(Object.keys(await info.json()).sort(), ['authenticated', 'expiresAt', 'premium']);
    assert.equal(info.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(f.sqlite.prepare('SELECT id FROM live_sessions WHERE id = ?').get(cookie.split('=')[1]), undefined);
  }
});

test('other members and users outside the server cannot establish a session', async t => {
  const f = fixture(t);
  for (const roles of [['999'], null]) {
    f.state.roles = roles;
    const denied = await f.finish(await f.begin());
    assert.equal(denied.headers.get('Location'), `${origin}/directos?login=denied`);
    assert.match(denied.headers.getSetCookie().at(-1), /Max-Age=0/);
    assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM live_sessions').get().n, 0);
  }
  assert.equal(f.state.minted.length, 0);
});

test('the existing private Discord message is an optional server-only credential source', async t => {
  const f = fixture(t);
  delete f.env.ANGELTHUMP_SID;
  f.env.CHANNEL_ID = '103';
  f.env.CREDENTIAL_AUTHOR_ID = '888';
  f.state.credentialMessage = 'Contraseña:\nCookie: angelthump.sid=legacy-private-sid; Path=/';
  const cookie = await f.authenticate();
  assert.equal((await (await f.call(session, '/api/session', { cookie })).json()).premium, true);
  const permit = await f.permit(cookie, 'cast');
  const playlist = await f.media(permit.source);
  assert.equal(playlist.status, 200);
  const master = await playlist.text();
  assert.doesNotMatch(master, /legacy-private-sid|private-origin-token|angelthump\.com/);
  const rendition = await f.media(lines(master)[0]);
  assert.equal(rendition.status, 200);
  const segment = await f.media(lines(await rendition.text())[0]);
  assert.equal(segment.status, 200);
  assert.ok(f.state.calls.some(call => call.url.hostname === 'nyc-patreon.angelthump.com' && call.url.pathname.endsWith('/clip.m4s')));
  assert.equal(f.state.calls.filter(call => call.url.pathname.endsWith('/messages')).length, 1);
  f.advance(16000);
  f.state.credentialMessage = 'Contraseña: solo-normal';
  assert.equal((await (await f.call(session, '/api/session', { cookie })).json()).premium, false);
});

test('login on a deployment URL returns to the configured site before issuing OAuth state', async () => {
  const deployment = 'https://0f0bf402.elppstrmstv.pages.dev';
  const alias = 'https://directos-seguros.elppstrmstv.pages.dev';
  const env = { LIVE_ORIGIN: alias };
  const request = new Request(`${deployment}/api/auth/discord`, { headers: { 'Sec-Fetch-Site': 'same-origin' } });
  const response = await login({ request, env });

  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), `${alias}/directos`);
  assert.equal(response.headers.has('Set-Cookie'), false);

  const crossSite = new Request(`${alias}/api/auth/discord`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal((await login({ request: crossSite, env })).status, 403);
});

test('OAuth state is bound to its browser cookie, expires and is consumed once', async t => {
  const f = fixture(t);
  const a = await f.begin();
  assert.match(a.cookie, /^__Host-pp_login=/);
  assert.equal((await f.finish({ ...a, state: randomId() })).headers.get('Location'), `${origin}/directos?login=invalid`);
  assert.equal((await f.finish({ ...a, cookie: null })).headers.get('Location'), `${origin}/directos?login=invalid`);
  assert.equal(f.state.calls.length, 0);
  assert.equal((await f.finish(a)).headers.get('Location'), `${origin}/directos`);
  assert.equal((await f.finish(a)).headers.get('Location'), `${origin}/directos?login=invalid`);
  const b = await f.begin();
  f.advance(601000);
  assert.equal((await f.finish(b)).headers.get('Location'), `${origin}/directos?login=invalid`);
  assert.equal(f.state.calls.filter(call => call.url.pathname.endsWith('/oauth2/token')).length, 1);
});

test('starting login and creating permits are rate-limited locally', async t => {
  const f = fixture(t);
  const cookie = await f.authenticate();
  for (let i = 0; i < 11; i++) assert.equal((await f.call(login, '/api/auth/discord')).status, 303);
  const limited = await f.call(login, '/api/auth/discord');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.has('Retry-After'), true);
  for (let i = 0; i < 30; i++) await f.permit(cookie);
  const throttle = await f.call(playback, '/api/playback', { method: 'POST', cookie, requestOrigin: origin,
    body: { channel: 'elpintaunas', mode: 'premium', receiver: 'browser' } });
  assert.equal(throttle.status, 429);
  assert.equal(f.state.minted.length, 0);
});

test('old routes, foreign origins, unsupported channels and anonymous permits cannot request provider tokens', async t => {
  const f = fixture(t);
  assert.equal(legacyProxy().status, 410);
  assert.equal(legacyLogin().status, 410);
  const body = { channel: 'elpintaunas', mode: 'premium', receiver: 'browser' };
  assert.equal((await f.call(playback, '/api/playback', { method: 'POST', body, requestOrigin: origin })).status, 401);
  const cookie = await f.authenticate();
  assert.equal((await f.call(playback, '/api/playback', { method: 'POST', cookie, body, requestOrigin: 'https://elsewhere.invalid' })).status, 403);
  assert.equal((await f.call(playback, '/api/playback', { method: 'POST', cookie, body: { ...body, channel: 'unknown' }, requestOrigin: origin })).status, 400);
  assert.equal(f.state.minted.length, 0);
});

test('browser playback requires the issuing session and never exposes provider credentials', async t => {
  const f = fixture(t);
  const cookie = await f.authenticate();
  const browser = await f.permit(cookie, 'browser', 'normal');
  assert.deepEqual(Object.keys(browser).sort(), ['expiresAt', 'grant', 'source']);
  assert.equal((await f.media(browser.source)).status, 401);
  assert.equal(f.state.minted.length, 0);
  const master = await f.media(browser.source, { cookie });
  assert.equal(master.status, 200);
  const masterText = await master.text();
  assert.doesNotMatch(masterText, /angelthump\.com|private-origin-token|private-sid-fixture|private-password-fixture/);
  assert.equal(f.state.minted.length, 1);
  const stored = f.sqlite.prepare('SELECT sealed_token FROM live_streams').get().sealed_token;
  assert.ok(!stored.includes(f.state.minted[0]));
  assert.equal((await f.media(browser.source, { cookie: await f.authenticate() })).status, 401);
  const child = await f.media(lines(masterText)[0], { cookie });
  const playlist = await child.text();
  assert.match(playlist, /#EXT-X-MAP:URI="https:\/\/ppstreams.test/);
  const segment = lines(playlist)[0];
  const before = f.state.queries;
  const partial = await f.media(segment, { cookie, headers: { Range: 'bytes=0-3' } });
  assert.equal(partial.status, 206);
  assert.ok(f.state.calls.some(call => call.url.hostname === 'sfo1.angelthump.com' && call.url.pathname.endsWith('/clip.m4s')));
  assert.equal(partial.headers.get('Content-Range'), 'bytes 0-3/10');
  assert.equal(partial.headers.has('Set-Cookie'), false);
  assert.deepEqual(new Uint8Array(await partial.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
  assert.equal(f.state.queries - before, 1);
});

test('Cast plays beyond one hour through the same rendition URL after token renewal', async t => {
  const f = fixture(t);
  const cookie = await f.authenticate();
  const cast = await f.permit(cookie, 'cast');
  const options = { requestOrigin: castOrigin };
  const initial = await f.media(cast.source, options);
  assert.equal(initial.headers.get('Access-Control-Allow-Origin'), castOrigin);
  const high = lines(await initial.text())[0];
  assert.equal((await f.media(high, options)).status, 200);
  assert.equal(f.state.minted.length, 1);
  f.advance(61 * 60 * 1000);
  const continued = await f.media(high, options);
  assert.equal(continued.status, 200);
  assert.equal(f.state.minted.length, 2);
  assert.ok(f.state.calls.some(call => call.url.pathname === `/${f.state.minted[1]}/high/index.m3u8`));
  assert.doesNotMatch(await continued.text(), /private-origin-token|angelthump\.com/);
  assert.equal((await f.media(cast.source, { requestOrigin: 'https://elsewhere.invalid' })).status, 403);
  f.advance(7 * 60 * 60 * 1000);
  assert.equal((await f.media(cast.source, options)).status, 401);
});

test('the normal stream can refresh on a different AngelThump server', async t => {
  const f = fixture(t);
  const cookie = await f.authenticate();
  const grant = await f.permit(cookie, 'browser', 'normal', 'elpintaunas_1');
  const master = await f.media(grant.source, { cookie });
  assert.equal(master.status, 200);
  const rendition = lines(await master.text())[0];
  for (const host of ['sfo1.angelthump.com', 'nyc1.angelthump.com', 'fra1.angelthump.com']) {
    f.state.normalRefreshHost = host === 'sfo1.angelthump.com' ? null : host;
    f.advance(5000);
    const playlist = await f.media(rendition, { cookie });
    assert.equal(playlist.status, 200);
    const fragment = await f.media(lines(await playlist.text())[0], { cookie });
    assert.equal(fragment.status, 200);
    assert.equal(f.state.calls.at(-1).url.hostname, host);
  }
});

test('a fixed-quality Cast master keeps only the chosen resolution across token renewal', async t => {
  const f = fixture(t);
  const cast = await f.permit(await f.authenticate(), 'cast');
  const url = new URL(cast.source, origin);
  url.searchParams.set('quality', '360');
  const first = await f.media(url);
  assert.equal(first.status, 200);
  const text = await first.text();
  assert.match(text, /RESOLUTION=640x360/);
  assert.doesNotMatch(text, /RESOLUTION=1280x720/);
  assert.equal(lines(text).length, 1);
  f.advance(61 * 60 * 1000);
  assert.equal((await f.media(lines(text)[0])).status, 200);
  assert.ok(f.state.calls.some(call => call.url.pathname === `/${f.state.minted[1]}/low/index.m3u8`));
  url.searchParams.set('quality', '480');
  assert.equal((await f.media(url)).status, 404);
});

test('Cast gets a full eight hours when the browser session is about to expire', async t => {
  const f = fixture(t);
  const cookie = await f.authenticate();
  const browser = await f.permit(cookie);
  const eightHours = 8 * 60 * 60 * 1000;
  f.advance(11.5 * 60 * 60 * 1000);

  const response = await f.call(playback, '/api/playback', { method: 'POST', cookie, requestOrigin: origin,
    body: { channel: 'elpintaunas', mode: 'premium', receiver: 'cast' } });
  assert.equal(response.status, 200);
  const cast = await response.json();
  assert.equal(cast.expiresAt, Date.now() + eightHours);
  assert.equal(cast.sessionExpiresAt, cast.expiresAt);
  assert.ok(response.headers.getSetCookie()[0].startsWith(`${cookie}; Path=/; Max-Age=28800;`));

  f.advance(eightHours - 1000);
  assert.equal((await f.media(cast.source, { requestOrigin: castOrigin })).status, 200);
  assert.equal((await f.media(browser.source, { cookie })).status, 200);
  f.advance(1000);
  assert.equal((await f.media(cast.source, { requestOrigin: castOrigin })).status, 401);
});

test('an early rejection from the upstream playlist refreshes its token once', async t => {
  const f = fixture(t);
  const grant = await f.permit(await f.authenticate(), 'cast');
  assert.equal((await f.media(grant.source)).status, 200);
  f.state.rejected = f.state.minted[0];
  f.advance(20000);
  assert.equal((await f.media(grant.source)).status, 200);
  assert.equal(f.state.minted.length, 2);
});

test('parallel starts share one upstream token and retry from the saved token', async t => {
  const f = fixture(t);
  const cookie = await f.authenticate();
  const a = await f.permit(cookie, 'cast');
  const b = await f.permit(cookie, 'cast');
  const responses = await Promise.all([f.media(a.source), f.media(b.source)]);
  assert.ok(responses.every(response => [200, 503].includes(response.status)));
  assert.ok(responses.some(response => response.ok));
  assert.equal(f.state.minted.length, 1);
  assert.equal((await f.media(b.source)).status, 200);
  assert.equal(f.state.minted.length, 1);
});

test('role removal, logout and explicit Cast revocation stop subsequent media requests', async t => {
  const f = fixture(t);
  let cookie = await f.authenticate();
  const first = await f.permit(cookie, 'cast');
  const second = await f.permit(cookie, 'cast');
  assert.equal((await f.call(revoke, '/api/playback', { method: 'DELETE', cookie, requestOrigin: origin, body: { grant: first.grant } })).status, 204);
  assert.equal((await f.media(first.source)).status, 401);
  assert.equal((await f.media(second.source)).status, 200);
  const signedOut = await f.call(logout, '/api/session', { method: 'DELETE', cookie, requestOrigin: origin });
  assert.equal(signedOut.status, 204);
  assert.equal((await f.media(second.source)).status, 401);
  cookie = await f.authenticate();
  const third = await f.permit(cookie, 'cast');
  const master = await f.media(third.source);
  const child = await f.media(lines(await master.text())[0]);
  const segment = lines(await child.text())[0];
  f.state.roles = ['999'];
  f.advance(5 * 60 * 1000 + 1);
  assert.equal((await f.media(segment)).status, 403);
  assert.equal((await f.media(third.source)).status, 401);
});

test('protected media rejects unrelated redirects, active HTML, tampered and expired segment references', async t => {
  const f = fixture(t);
  const grant = await f.permit(await f.authenticate(), 'cast');
  f.state.redirect = true;
  assert.equal((await f.media(grant.source)).status, 502);
  f.state.redirect = false;
  const master = await f.media(grant.source);
  const child = await f.media(lines(await master.text())[0]);
  const segment = lines(await child.text())[0];
  const bad = new URL(segment);
  const ref = bad.searchParams.get('s');
  bad.searchParams.set('s', `${ref[0] === 'a' ? 'b' : 'a'}${ref.slice(1)}`);
  assert.equal((await f.media(bad)).status, 404);
  f.state.html = true;
  assert.equal((await f.media(segment)).status, 502);
  f.state.html = false;
  const headers = await f.media(segment, { method: 'HEAD' });
  assert.equal(headers.status, 200);
  assert.equal(await headers.text(), '');
  f.advance(11 * 60 * 1000);
  assert.equal((await f.media(segment)).status, 404);
});
