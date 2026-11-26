import './setup-env.js'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import request from 'supertest'

import { createApp } from '../src/app.js'
import { signAccessToken } from '../src/modules/auth/token.js'

// Routing, validation, guards and auth checks — none of these reach MongoDB.
const app = createApp()

describe('HTTP API (no database)', () => {
  it('reports liveness', async () => {
    const res = await request(app).get('/api/health').expect(200)
    assert.equal(res.body.status, 'ok')
    assert.equal(res.body.ai, false)
  })

  it('reports not-ready while the database is unavailable', async () => {
    const res = await request(app).get('/api/health/ready').expect(503)
    assert.equal(res.body.status, 'not-ready')
    assert.equal(res.body.checks.database, false)
  })

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/nope').expect(404)
    assert.equal(res.body.success, false)
  })

  it('tags every response with a request id and safe headers', async () => {
    const res = await request(app).get('/api/nope')
    assert.match(res.headers['x-request-id'], /^[\w-]{36}$/)
    assert.equal(res.headers['cache-control'], 'no-store')
    assert.equal(res.headers['x-content-type-options'], 'nosniff')
    assert.equal(res.headers['x-powered-by'], undefined)
    const echoed = await request(app).get('/api/nope').set('X-Request-Id', 'lb-trace-12345')
    assert.equal(echoed.headers['x-request-id'], 'lb-trace-12345')
    const rejected = await request(app).get('/api/nope').set('X-Request-Id', 'bad id<script>')
    assert.notEqual(rejected.headers['x-request-id'], 'bad id<script>')
  })

  it('validates registration input', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'short' }).expect(422)
    const fields = res.body.errors.map((error) => error.field)
    assert.ok(fields.includes('body.email'))
    assert.ok(fields.includes('body.password'))
  })

  it('blocks NoSQL operator injection', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $ne: null } }).expect(400)
    assert.match(res.body.message, /Invalid field name/)
  })

  it('blocks prototype pollution payloads', async () => {
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"__proto__":{"admin":true},"email":"a@b.co","password":"x"}').expect(400)
  })

  it('rejects oversized bodies before doing any work', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(200_000) }).expect(413)
    assert.match(res.body.message, /too large/)
  })

  it('rejects malformed JSON', async () => {
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400)
  })

  it('rejects protected routes without a token', async () => {
    for (const path of ['/api/auth/me', '/api/videos', '/api/words', '/api/ai/status']) {
      const res = await request(app).get(path).expect(401)
      assert.equal(res.body.success, false)
    }
  })

  it('rejects malformed tokens', async () => {
    const res = await request(app).get('/api/videos').set('Authorization', 'Bearer abc.def.ghi').expect(401)
    assert.match(res.body.message, /log in/i)
  })

  it('does not parse large lesson bodies for unauthenticated callers', async () => {
    const res = await request(app).put('/api/videos/dQw4w9WgXcQ').send({ cues: [{ text: 'x'.repeat(1_000_000) }] }).expect(401)
    assert.match(res.body.message, /log in/i)
  })

  it('fails fast with 503 (not a hang) when the database is unavailable', async () => {
    const token = signAccessToken({ _id: '507f1f77bcf86cd799439011', tokenVersion: 0 })
    const startedAt = Date.now()
    const res = await request(app).get('/api/videos').set('Authorization', `Bearer ${token}`).expect(503)
    assert.ok(Date.now() - startedAt < 1000)
    assert.equal(res.headers['retry-after'], '5')
  })

  it('allows extension origins through CORS', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'chrome-extension://abcdefghijklmnop')
      .set('Access-Control-Request-Method', 'POST')
    assert.equal(res.headers['access-control-allow-origin'], 'chrome-extension://abcdefghijklmnop')
  })

  it('does not allow arbitrary web origins', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST')
    assert.equal(res.headers['access-control-allow-origin'], undefined)
  })
})
