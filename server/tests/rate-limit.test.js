import './setup-tight-limits.js'
import './setup-env.js'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import request from 'supertest'

import { createApp } from '../src/app.js'

const app = createApp()

describe('rate limiting (in-memory store)', () => {
  it('locks out repeated failed auth attempts from one IP', async () => {
    const attempt = () => request(app).post('/api/auth/register').send({ email: 'bad', password: 'x' })
    for (let i = 0; i < 3; i++) await attempt().expect(422)
    const blocked = await attempt().expect(429)
    assert.match(blocked.body.message, /Too many attempts/)
    assert.ok(blocked.headers.ratelimit, 'standard RateLimit header present')
    assert.ok(blocked.headers['retry-after'])
  })

  it('caps total requests per IP across the API', async () => {
    let status = 0
    for (let i = 0; i < 20 && status !== 429; i++) status = (await request(app).get('/api/words')).status
    assert.equal(status, 429)
  })

  it('keeps health probes outside the limits', async () => {
    await request(app).get('/api/health').expect(200)
  })
})
