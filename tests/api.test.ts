import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApi, ApiError } from '../src/lib/api.ts'
import { campusDate } from '../src/lib/types.ts'

const oldTokens = { access_token: 'old-access', refresh_token: 'old-refresh' }
const newTokens = { access_token: 'new-access', refresh_token: 'new-refresh' }
const ok = (data: unknown) => Response.json({ success: true, data })
const unauthorized = () => Response.json({ error: 'Unauthorized', status: 401 }, { status: 401 })
const pause = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

test('login preserves password bytes and sends JSON without a bearer token', async () => {
  const client = createApi(async (url, init) => {
    assert.equal(url, '/api/auth/login')
    assert.deepEqual(JSON.parse(String(init?.body)), { email: 'campus@example.invalid', password: ' pass ' })
    assert.equal(new Headers(init?.headers).get('Authorization'), null)
    return ok(oldTokens)
  })
  await client.login('campus@example.invalid', ' pass ')
})

test('Google login sends credential and challenge in JSON and uses the campus tokens', async () => {
  const client = createApi(async (url, init) => {
    if (url === '/api/auth/google/login') {
      assert.equal(init?.method, 'POST')
      assert.deepEqual(JSON.parse(String(init?.body)), { credential: 'signed-google-id-token', challenge_token: 'one-time-challenge' })
      assert.equal(new Headers(init?.headers).get('Authorization'), null)
      return ok(newTokens)
    }
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer new-access')
    return ok({ id: 5 })
  })
  await client.googleLogin('signed-google-id-token', 'one-time-challenge')
  assert.deepEqual(await client.request('/auth/me'), { id: 5 })
})

test('late Google login cannot restore a signed-out or switched session', async () => {
  const gate = pause()
  const client = createApi(async () => { await gate.promise; return ok(newTokens) })
  const signingIn = client.googleLogin('credential', 'challenge')
  client.setTokens(null)
  gate.resolve()
  await assert.rejects(signingIn, /session changed/)
})

test('Google login failure does not install credentials', async () => {
  let calls = 0
  const client = createApi(async (_url, init) => {
    if (calls++ === 0) return unauthorized()
    assert.equal(new Headers(init?.headers).get('Authorization'), null)
    return ok({ public: true })
  })
  await assert.rejects(client.googleLogin('invalid', 'challenge'), ApiError)
  await client.request('/auth/google/config')
})

test('concurrent unauthorized requests share one refresh rotation', async () => {
  let refreshes = 0
  const client = createApi(async (url, init) => {
    if (url === '/api/auth/refresh') { refreshes++; await Promise.resolve(); return ok(newTokens) }
    return new Headers(init?.headers).get('Authorization') === 'Bearer old-access' ? unauthorized() : ok(url)
  })
  client.setTokens(oldTokens)
  assert.deepEqual(await Promise.all([client.request('/first'), client.request('/second')]), ['/api/first', '/api/second'])
  assert.equal(refreshes, 1)
})

test('late old-token response reuses the rotation instead of replaying a refresh token', async () => {
  const gate = pause()
  let refreshes = 0
  const client = createApi(async (url, init) => {
    if (url === '/api/auth/refresh') { refreshes++; return ok(newTokens) }
    if (new Headers(init?.headers).get('Authorization') === 'Bearer old-access') {
      if (url === '/api/slow') await gate.promise
      return unauthorized()
    }
    return ok(true)
  })
  client.setTokens(oldTokens)
  const slow = client.request('/slow')
  await client.request('/fast')
  gate.resolve()
  assert.equal(await slow, true)
  assert.equal(refreshes, 1)
})

test('revoked refresh clears credentials and reports session expiry once', async () => {
  let expiries = 0
  const client = createApi(async () => unauthorized(), () => expiries++)
  client.setTokens(oldTokens)
  await assert.rejects(client.request('/private'), { status: 401 })
  assert.equal(expiries, 1)
  await assert.rejects(client.request('/private'), { status: 401 })
  assert.equal(expiries, 1)
})

test('logout during refresh cannot restore a cleared session', async () => {
  const gate = pause()
  const entered = pause()
  const client = createApi(async url => {
    if (url === '/api/auth/refresh') { entered.resolve(); await gate.promise; return ok(newTokens) }
    return unauthorized()
  })
  client.setTokens(oldTokens)
  const result = client.request('/private')
  await entered.promise
  client.setTokens(null)
  gate.resolve()
  await assert.rejects(result, { status: 401 })
})

test('account switch never retries an earlier request using the new account', async () => {
  const gate = pause()
  let calls = 0
  const client = createApi(async () => { calls++; await gate.promise; return unauthorized() })
  client.setTokens(oldTokens)
  const result = client.request('/private')
  client.setTokens(newTokens)
  gate.resolve()
  await assert.rejects(result, { status: 401 })
  assert.equal(calls, 1)
})

test('temporary refresh outage retains the session for a later retry', async () => {
  let offline = true
  let expiries = 0
  const client = createApi(async (url, init) => {
    if (url === '/api/auth/refresh') { if (offline) throw new Error('offline'); return ok(newTokens) }
    return new Headers(init?.headers).get('Authorization') === 'Bearer old-access' ? unauthorized() : ok(true)
  }, () => expiries++)
  client.setTokens(oldTokens)
  await assert.rejects(client.request('/private'), { status: 0 })
  offline = false
  assert.equal(await client.request('/private'), true)
  assert.equal(expiries, 0)
})

test('logout revokes the rotated refresh token', async () => {
  let revoked = ''
  const client = createApi(async (url, init) => {
    if (url === '/api/auth/refresh') return ok(newTokens)
    if (url === '/api/auth/logout') { revoked = JSON.parse(String(init?.body)).refresh_token; return Response.json({ success: true, message: 'Logged out' }) }
    return new Headers(init?.headers).get('Authorization') === 'Bearer old-access' ? unauthorized() : ok(true)
  })
  client.setTokens(oldTokens)
  await client.logout()
  assert.equal(revoked, 'new-refresh')
})

test('forbidden requests never attempt refresh or expose server HTML', async () => {
  let calls = 0
  const client = createApi(async () => { calls++; return Response.json({ error: 'Forbidden' }, { status: 403 }) })
  client.setTokens(oldTokens)
  await assert.rejects(client.request('/private'), { message: 'Forbidden', status: 403 })
  assert.equal(calls, 1)
  const broken = createApi(async () => new Response('<html>private diagnostic</html>', { status: 500 }))
  await assert.rejects(broken.request('/private'), (error: unknown) => error instanceof ApiError && !error.message.includes('diagnostic'))
})

test('already-expired refresh token still allows local sign-out', async () => {
  const client = createApi(async url => url === '/api/auth/logout' ? unauthorized() : ok(true))
  client.setTokens(oldTokens)
  await client.logout()
  // A second logout must be a no-op after credentials were cleared.
  await client.logout()
})

test('network failure during logout retains credentials for revocation retry', async () => {
  let offline = true
  let attempts = 0
  const client = createApi(async url => {
    if (url === '/api/auth/logout') { attempts++; if (offline) throw new Error('offline') }
    return ok(true)
  })
  client.setTokens(oldTokens)
  await assert.rejects(client.logout(), { status: 0 })
  offline = false
  await client.logout()
  assert.equal(attempts, 2)
})

test('abort remains an abort instead of a misleading connection error', async () => {
  const client = createApi(async () => { throw new DOMException('Aborted', 'AbortError') })
  await assert.rejects(client.request('/private'), { name: 'AbortError' })
})

test('malformed successful responses are rejected', async () => {
  const client = createApi(async () => new Response('<html>wrong server</html>'))
  await assert.rejects(client.request('/private'), { status: 502 })
})

test('database UTC timestamps display as campus dates across midnight', () => {
  assert.match(campusDate('2026-11-07 18:00:00'), /Nov 8, 2026/)
  assert.equal(campusDate('2026-11-07T18:00:00Z'), campusDate('2026-11-08T02:00:00+08:00'))
})
