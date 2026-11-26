import './setup-env.js'

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import request from 'supertest'

import { createApp } from '../src/app.js'
import { connectDB, disconnectDB } from '../src/config/db.js'
import { createAnalysisService, mongoStores } from '../src/modules/ai/ai.service.js'
import { consumeAiQuota } from '../src/modules/ai/usage.service.js'
import User from '../src/modules/auth/user.model.js'

// Full integration tests against a disposable database, e.g.:
//   docker run -d -p 27017:27017 mongo:7
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test
// The suite DROPS its database ("leatch-test"), so remote/Atlas URIs are refused by default.
const TEST_URI = process.env.MONGODB_TEST_URI
const isRemote = /mongodb\.net|mongodb\+srv/.test(TEST_URI ?? '')
const skip = !TEST_URI ? 'set MONGODB_TEST_URI to run' : isRemote && !process.env.ALLOW_REMOTE_TEST_DB ? 'refusing to drop a remote database' : false

describe('HTTP API with MongoDB', { skip }, () => {
  const app = createApp()
  const agent = request(app)
  const videoId = 'dQw4w9WgXcQ'
  let token = ''
  const authHeader = () => ({ Authorization: `Bearer ${token}` })

  before(async () => {
    await connectDB()
    await mongoose.connection.dropDatabase()
    await mongoose.connection.syncIndexes()
  })

  after(async () => {
    await mongoose.connection.dropDatabase()
    await disconnectDB()
  })

  it('reports ready once connected', async () => {
    await agent.get('/api/health/ready').expect(200)
  })

  it('registers, rejects duplicates and logs in', async () => {
    const reg = await agent.post('/api/auth/register').send({ email: 'Learner@Example.com', password: 'secret123', name: 'Kim' }).expect(201)
    assert.equal(reg.body.data.user.email, 'learner@example.com')
    for (const hidden of ['password', 'tokenVersion', 'security', 'aiUsage']) assert.equal(reg.body.data.user[hidden], undefined, hidden)

    const stored = await User.findOne({ email: 'learner@example.com' }).select('+password').lean()
    assert.match(stored.password, /^scrypt\$/, 'passwords are stored as scrypt hashes')

    await agent.post('/api/auth/register').send({ email: 'learner@example.com', password: 'secret123' }).expect(409)
    await agent.post('/api/auth/login').send({ email: 'learner@example.com', password: 'wrong-pass1' }).expect(401)

    const login = await agent.post('/api/auth/login').send({ email: 'learner@example.com', password: 'secret123' }).expect(200)
    token = login.body.data.token
    const me = await agent.get('/api/auth/me').set(authHeader()).expect(200)
    assert.equal(me.body.data.name, 'Kim')
  })

  it('gives the same answer for unknown emails and wrong passwords', async () => {
    const unknown = await agent.post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' }).expect(401)
    assert.equal(unknown.body.message, 'Incorrect email or password')
  })

  it('locks an account after repeated failures, even for the right password', async () => {
    await agent.post('/api/auth/register').send({ email: 'target@example.com', password: 'target123' }).expect(201)
    for (let i = 0; i < 5; i++) await agent.post('/api/auth/login').send({ email: 'target@example.com', password: `guess${i}xx` }).expect(401)
    const locked = await agent.post('/api/auth/login').send({ email: 'target@example.com', password: 'target123' }).expect(429)
    assert.match(locked.body.message, /Try again in \d+ minute/)

    await User.updateOne({ email: 'target@example.com' }, { $set: { 'security.lockUntil': new Date(Date.now() - 1000) } })
    await agent.post('/api/auth/login').send({ email: 'target@example.com', password: 'target123' }).expect(200)
  })

  it('upgrades legacy bcrypt hashes on login', async () => {
    await User.collection.insertOne({ email: 'legacy@example.com', password: await bcrypt.hash('oldpass123', 4), name: '', tokenVersion: 0 })
    await agent.post('/api/auth/login').send({ email: 'legacy@example.com', password: 'oldpass123' }).expect(200)
    const upgraded = await User.findOne({ email: 'legacy@example.com' }).select('+password').lean()
    assert.match(upgraded.password, /^scrypt\$/)
  })

  it('revokes every session on "log out everywhere"', async () => {
    const session = await agent.post('/api/auth/login').send({ email: 'target@example.com', password: 'target123' }).expect(200)
    const header = { Authorization: `Bearer ${session.body.data.token}` }
    await agent.get('/api/auth/me').set(header).expect(200)
    await agent.post('/api/auth/logout-all').set(header).expect(200)
    await agent.get('/api/auth/me').set(header).expect(401)
  })

  it('changes the password and invalidates older tokens', async () => {
    const oldToken = token
    const changed = await agent.post('/api/auth/password').set(authHeader()).send({ currentPassword: 'secret123', newPassword: 'newsecret456' }).expect(200)
    token = changed.body.data.token
    await agent.get('/api/auth/me').set({ Authorization: `Bearer ${oldToken}` }).expect(401)
    await agent.get('/api/auth/me').set(authHeader()).expect(200)
    await agent.post('/api/auth/login').send({ email: 'learner@example.com', password: 'secret123' }).expect(401)
    await agent.post('/api/auth/login').send({ email: 'learner@example.com', password: 'newsecret456' }).expect(200)
  })

  it('saves a lesson, merges vocab and tracks progress + notes', async () => {
    const lesson = {
      title: 'Korean vlog',
      sourceLang: 'ko',
      translationLang: 'en',
      durationSec: 100,
      cues: [
        { start: 0, end: 2, text: '안녕하세요', translation: 'Hello' },
        { start: 2, end: 4, text: '밥 먹었어요?', translation: 'Did you eat?' },
      ],
      vocab: [{ cueIndex: 1, surface: '먹었어요', lemma: '먹다', meaning: 'to eat' }],
    }
    await agent.put(`/api/videos/${videoId}`).set(authHeader()).send(lesson).expect(201)
    await agent
      .put(`/api/videos/${videoId}`)
      .set(authHeader())
      .send({ vocab: [{ cueIndex: 0, lemma: '안녕하다', meaning: 'to be well' }] })
      .expect(200)

    const progress = await agent.patch(`/api/videos/${videoId}/progress`).set(authHeader()).send({ position: 97 }).expect(200)
    assert.equal(progress.body.data.completed, true)

    const note = await agent.post(`/api/videos/${videoId}/notes`).set(authHeader()).send({ time: 3, text: '먹다 → 먹었어요 (past)' }).expect(201)
    const full = await agent.get(`/api/videos/${videoId}`).set(authHeader()).expect(200)
    assert.equal(full.body.data.vocab.length, 2)
    assert.equal(full.body.data.notes.length, 1)

    const list = await agent.get('/api/videos?q=vlog').set(authHeader()).expect(200)
    assert.equal(list.body.data.items.length, 1)
    const [item] = list.body.data.items
    assert.deepEqual([item.cueCount, item.vocabCount, item.noteCount], [2, 2, 1])
    assert.equal(item.cues, undefined, 'heavy arrays are not loaded for the list')

    await agent.delete(`/api/videos/${videoId}/notes/${note.body.data._id}`).set(authHeader()).expect(200)
    const afterDelete = await agent.get('/api/videos').set(authHeader()).expect(200)
    assert.equal(afterDelete.body.data.items[0].noteCount, 0)
  })

  it('treats regex characters in searches literally', async () => {
    const res = await agent.get(`/api/videos?q=${encodeURIComponent('.*')}`).set(authHeader()).expect(200)
    assert.equal(res.body.data.items.length, 0)
  })

  it('keeps users isolated from each other', async () => {
    const other = await agent.post('/api/auth/register').send({ email: 'other@example.com', password: 'other1234' }).expect(201)
    const otherHeader = { Authorization: `Bearer ${other.body.data.token}` }
    await agent.get(`/api/videos/${videoId}`).set(otherHeader).expect(404)
    const list = await agent.get('/api/videos').set(otherHeader).expect(200)
    assert.equal(list.body.data.items.length, 0)
  })

  it('saves words idempotently, searches and lists lemmas', async () => {
    const word = { lang: 'ko', lemma: '먹다', meaning: 'to eat', examples: [{ text: '밥을 먹어요.', translation: 'I eat rice.' }] }
    const first = await agent.post('/api/words').set(authHeader()).send(word).expect(201)
    await agent.patch(`/api/words/${first.body.data._id}`).set(authHeader()).send({ status: 'known' }).expect(200)
    const again = await agent.post('/api/words').set(authHeader()).send({ ...word, meaning: 'eat' }).expect(200)
    assert.equal(again.body.data.status, 'known', 're-saving keeps the review status')

    const search = await agent.get('/api/words?q=eat').set(authHeader()).expect(200)
    assert.equal(search.body.data.items.length, 1)
    const lemmas = await agent.get('/api/words/lemmas?lang=ko').set(authHeader()).expect(200)
    assert.deepEqual(lemmas.body.data, ['먹다'])
  })

  it('counts AI quota atomically (trusted operators under sanitizeFilter)', async () => {
    const user = await User.findOne({ email: 'learner@example.com' })
    await consumeAiQuota(user._id)
    await consumeAiQuota(user._id)
    const updated = await User.findById(user._id).lean()
    assert.equal(updated.aiUsage.chunks, 2)
  })

  it('caches AI analyses and shares the example lexicon in MongoDB', async () => {
    let analysisCalls = 0
    let exampleCalls = 0
    const service = createAnalysisService({
      ...mongoStores,
      complete: async ({ user, schema }) => {
        const input = JSON.parse(user)
        if (schema.required.includes('lines')) {
          analysisCalls += 1
          return { data: { lines: input.lines.map((line) => ({ i: line.i, translation: '', items: [{ surface: '먹었어요', lemma: '먹다', type: 'vocab', meaning: 'eat', reading: 'meokda', pos: 'verb' }] })) } }
        }
        exampleCalls += 1
        return { data: { entries: input.items.map((item) => ({ lemma: item.lemma, examples: [{ text: '밥 먹어요', translation: 'I eat' }, { text: '먹었어요', translation: 'I ate' }] })) } }
      },
      consumeQuota: async () => {},
      isEnabled: () => true,
    })
    const chunk = { userId: 'u', sourceLang: 'ko', nativeLang: 'en', needTranslation: false, lines: [{ i: 0, text: '밥 먹었어요?', translation: '' }] }

    const [a, b] = await Promise.all([service.analyzeChunk(chunk), service.analyzeChunk(chunk)])
    assert.equal(analysisCalls, 1, 'concurrent identical requests share one model call')
    assert.equal(a.lines[0].items[0].examples.length, 2)
    assert.deepEqual(a.lines, b.lines)

    const cached = await service.analyzeChunk({ ...chunk, lines: [{ i: 7, text: '밥 먹었어요?', translation: '' }] })
    assert.equal(cached.cached, true)
    assert.equal(cached.lines[0].i, 7)
    assert.equal(analysisCalls, 1)
    assert.equal(exampleCalls, 1, 'examples come from the shared lexicon afterwards')
  })
})
