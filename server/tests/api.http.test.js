import './setup-env.js'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import request from 'supertest'

import { createApp } from '../src/app.js'

// These tests exercise routing, validation and auth guards — none of them reach MongoDB.
const app = createApp()

describe('HTTP API (no database)', () => {
  it('reports health', async () => {
    const res = await request(app).get('/api/health').expect(200)
    assert.equal(res.body.status, 'ok')
    assert.equal(res.body.ai, false)
  })

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/nope').expect(404)
    assert.equal(res.body.success, false)
  })

  it('validates registration input', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'short' }).expect(422)
    const fields = res.body.errors.map((error) => error.field)
    assert.ok(fields.includes('body.email'))
    assert.ok(fields.includes('body.password'))
  })

  it('requires a letter and a number in passwords', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.co', password: 'onlyletters' }).expect(422)
    assert.match(res.body.errors[0].message, /number/)
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
