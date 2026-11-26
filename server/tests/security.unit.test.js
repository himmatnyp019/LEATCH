import './setup-env.js'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'

import { buildMongoConfig, redactUri } from '../src/config/db.js'
import { loadShedding } from '../src/middleware/loadShedding.js'
import { findDangerousKey } from '../src/middleware/requestGuards.js'
import { signAccessToken, verifyAccessToken } from '../src/modules/auth/token.js'
import { createLimiter, createSingleFlight } from '../src/utils/concurrency.js'
import { hashPassword, needsRehash, verifyPassword } from '../src/utils/password.js'

describe('MongoDB configuration', () => {
  const base = { MONGODB_DB_NAME: 'leatch', MONGODB_MAX_POOL_SIZE: 50, MONGODB_MIN_POOL_SIZE: 2, MONGODB_AUTO_INDEX: true, MONGODB_USERNAME: '', MONGODB_PASSWORD: '' }

  it('uses the database name and pool settings even when the URI has no path', () => {
    const { uri, options } = buildMongoConfig({ ...base, MONGODB_URI: 'mongodb+srv://user:pass@cluster0.example.mongodb.net/?retryWrites=true' })
    assert.equal(uri, 'mongodb+srv://user:pass@cluster0.example.mongodb.net/?retryWrites=true')
    assert.equal(options.dbName, 'leatch')
    assert.equal(options.maxPoolSize, 50)
    assert.equal(options.auth, undefined, 'credentials in the URI are not duplicated')
  })

  it('fills the Atlas <db_password> placeholder (URL-encoded)', () => {
    const { uri } = buildMongoConfig({ ...base, MONGODB_URI: 'mongodb+srv://kim:<db_password>@c.example.net/', MONGODB_PASSWORD: 'p@ss/w:rd' })
    assert.equal(uri, 'mongodb+srv://kim:p%40ss%2Fw%3Ard@c.example.net/')
  })

  it('passes separate username/password when the URI has no credentials', () => {
    const { options } = buildMongoConfig({ ...base, MONGODB_URI: 'mongodb+srv://c.example.net/', MONGODB_USERNAME: 'kim', MONGODB_PASSWORD: 'secret' })
    assert.deepEqual(options.auth, { username: 'kim', password: 'secret' })
  })

  it('never logs credentials', () => {
    assert.equal(redactUri('mongodb+srv://kim:secret@c.example.net/db'), 'mongodb+srv://***:***@c.example.net/db')
  })
})

describe('password hashing', () => {
  it('hashes with scrypt and verifies in constant time', async () => {
    const hash = await hashPassword('correct horse 1')
    assert.match(hash, /^scrypt\$16384\$8\$5\$/)
    assert.equal(await verifyPassword('correct horse 1', hash), true)
    assert.equal(await verifyPassword('wrong horse 1', hash), false)
    assert.equal(needsRehash(hash), false)
  })

  it('still accepts legacy bcrypt hashes and flags them for upgrade', async () => {
    const legacy = await bcrypt.hash('oldpass123', 4)
    assert.equal(await verifyPassword('oldpass123', legacy), true)
    assert.equal(needsRehash(legacy), true)
  })

  it('rejects malformed stored hashes', async () => {
    assert.equal(await verifyPassword('x', 'scrypt$garbage'), false)
    assert.equal(await verifyPassword('x', undefined), false)
  })
})

describe('access tokens', () => {
  it('round-trips and carries the token version', () => {
    const token = signAccessToken({ _id: 'abc', tokenVersion: 3 })
    const payload = verifyAccessToken(token)
    assert.equal(payload.sub, 'abc')
    assert.equal(payload.ver, 3)
  })

  it('rejects tokens with another audience, issuer or algorithm', () => {
    const secret = process.env.JWT_SECRET
    assert.throws(() => verifyAccessToken(jwt.sign({ sub: 'x' }, secret, { issuer: 'leatch-api', audience: 'other' })))
    assert.throws(() => verifyAccessToken(jwt.sign({ sub: 'x' }, secret, { issuer: 'evil', audience: 'leatch-extension' })))
    assert.throws(() => verifyAccessToken(jwt.sign({ sub: 'x' }, secret, { algorithm: 'HS512', issuer: 'leatch-api', audience: 'leatch-extension' })))
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 'x', iss: 'leatch-api', aud: 'leatch-extension' })}.`
    assert.throws(() => verifyAccessToken(unsigned))
  })
})

describe('payload guard', () => {
  it('finds operator, dotted and prototype-pollution keys at any depth', () => {
    assert.equal(findDangerousKey({ email: { $gt: '' } }), 'email.$gt')
    assert.equal(findDangerousKey({ a: [{ b: { 'c.d': 1 } }] }), 'a.0.b.c.d')
    assert.equal(findDangerousKey(JSON.parse('{"__proto__": {"admin": true}}')), '__proto__')
    assert.equal(findDangerousKey({ text: '$not a key', note: 'a.b' }), null, 'values are fine')
  })

  it('rejects absurdly deep nesting', () => {
    let value = {}
    for (let i = 0; i < 30; i++) value = { nested: value }
    assert.match(findDangerousKey(value), /nested too deeply/)
  })
})

describe('load shedding', () => {
  const appWithLag = (lag) => {
    const app = express()
    app.use(loadShedding({ maxLagMs: 100, getLag: () => lag }))
    app.get('/', (_req, res) => res.json({ ok: true }))
    return app
  }

  it('passes requests while the event loop is healthy', async () => {
    await request(appWithLag(20)).get('/').expect(200)
  })

  it('answers 503 with Retry-After when the event loop is saturated', async () => {
    const res = await request(appWithLag(500)).get('/').expect(503)
    assert.equal(res.headers['retry-after'], '2')
  })
})

describe('concurrency helpers', () => {
  it('caps parallelism and rejects when the queue is full', async () => {
    const limiter = createLimiter({ concurrency: 2, maxQueue: 1, name: 'test' })
    let running = 0
    let peak = 0
    const task = () => limiter.run(async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 20))
      running -= 1
    })
    const results = await Promise.allSettled([task(), task(), task(), task()])
    assert.equal(peak, 2)
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
    assert.equal(results.find((result) => result.status === 'rejected').reason.statusCode, 503)
  })

  it('collapses concurrent identical work into one call', async () => {
    const flight = createSingleFlight()
    let calls = 0
    const work = () => flight('same-key', async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return 42
    })
    assert.deepEqual(await Promise.all([work(), work(), work()]), [42, 42, 42])
    assert.equal(calls, 1)
    await work()
    assert.equal(calls, 2, 'a later call runs again')
  })
})
