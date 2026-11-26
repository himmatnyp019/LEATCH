import './setup-tight-limits.js'
import './setup-env.js'

import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { after, before, describe, it } from 'node:test'

import request from 'supertest'

const hasRedis = spawnSync('redis-server', ['--version']).status === 0
const PORT = 20000 + Math.floor(Math.random() * 20000)

describe('rate limiting shared through Redis', { skip: !hasRedis && 'redis-server not installed' }, () => {
  let redisProcess
  let app
  let redisClient

  before(async () => {
    redisProcess = spawn('redis-server', ['--port', String(PORT), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' })
    await new Promise((resolve) => setTimeout(resolve, 400))
    process.env.REDIS_URL = `redis://127.0.0.1:${PORT}`
    // Import after REDIS_URL is set: limiters bind to the shared store at import time.
    const { connectRedis, getRedisClient } = await import('../src/config/redis.js')
    const { createApp } = await import('../src/app.js')
    await connectRedis()
    redisClient = getRedisClient()
    app = createApp()
  })

  after(async () => {
    await redisClient?.quit().catch(() => {})
    redisProcess?.kill()
  })

  it('stores counters in Redis so every instance sees the same limit', async () => {
    for (let i = 0; i < 3; i++) await request(app).post('/api/auth/register').send({ email: 'bad', password: 'x' }).expect(422)
    await request(app).post('/api/auth/register').send({ email: 'bad', password: 'x' }).expect(429)

    const keys = await redisClient.keys('leatch:rl:*')
    assert.ok(keys.some((key) => key.startsWith('leatch:rl:auth:')), `keys: ${keys}`)
    assert.ok(keys.some((key) => key.startsWith('leatch:rl:global:')))
  })

  it('a second app instance sharing Redis is already limited', async () => {
    const { createApp } = await import('../src/app.js')
    await request(createApp()).post('/api/auth/register').send({ email: 'bad', password: 'x' }).expect(429)
  })
})
