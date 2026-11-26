import './setup-env.js'

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import mongoose from 'mongoose'
import request from 'supertest'

import { createApp } from '../src/app.js'

// Full integration tests. Run with a disposable database, e.g.:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/leatch-test npm test
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI

describe('HTTP API with MongoDB', { skip: !MONGODB_TEST_URI && 'set MONGODB_TEST_URI to run' }, () => {
  const app = createApp()
  const agent = request(app)
  let token = ''
  const videoId = 'dQw4w9WgXcQ'

  before(async () => {
    await mongoose.connect(MONGODB_TEST_URI)
    await mongoose.connection.dropDatabase()
    await mongoose.connection.syncIndexes()
  })

  after(async () => {
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  })

  it('registers, rejects duplicates and logs in', async () => {
    const reg = await agent.post('/api/auth/register').send({ email: 'Learner@Example.com', password: 'secret123', name: 'Kim' }).expect(201)
    assert.equal(reg.body.data.user.email, 'learner@example.com')
    assert.equal(reg.body.data.user.password, undefined)

    await agent.post('/api/auth/register').send({ email: 'learner@example.com', password: 'secret123' }).expect(409)
    await agent.post('/api/auth/login').send({ email: 'learner@example.com', password: 'wrong-pass1' }).expect(401)

    const login = await agent.post('/api/auth/login').send({ email: 'learner@example.com', password: 'secret123' }).expect(200)
    token = login.body.data.token
    const me = await agent.get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200)
    assert.equal(me.body.data.name, 'Kim')
  })

  it('saves a lesson, merges vocab and tracks progress + notes', async () => {
    const auth = { Authorization: `Bearer ${token}` }
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
    await agent.put(`/api/videos/${videoId}`).set(auth).send(lesson).expect(201)
    await agent
      .put(`/api/videos/${videoId}`)
      .set(auth)
      .send({ vocab: [{ cueIndex: 0, lemma: '안녕하다', meaning: 'to be well' }] })
      .expect(200)

    const progress = await agent.patch(`/api/videos/${videoId}/progress`).set(auth).send({ position: 97 }).expect(200)
    assert.equal(progress.body.data.completed, true)

    const note = await agent.post(`/api/videos/${videoId}/notes`).set(auth).send({ time: 3, text: '먹다 → 먹었어요 (past)' }).expect(201)
    const full = await agent.get(`/api/videos/${videoId}`).set(auth).expect(200)
    assert.equal(full.body.data.vocab.length, 2)
    assert.equal(full.body.data.notes.length, 1)

    const list = await agent.get('/api/videos').set(auth).expect(200)
    assert.equal(list.body.data.items[0].noteCount, 1)
    assert.equal(list.body.data.items[0].cues, undefined)

    await agent.delete(`/api/videos/${videoId}/notes/${note.body.data._id}`).set(auth).expect(200)
  })

  it('saves words idempotently and lists lemmas', async () => {
    const auth = { Authorization: `Bearer ${token}` }
    const word = { lang: 'ko', lemma: '먹다', meaning: 'to eat', examples: [{ text: '밥을 먹어요.', translation: 'I eat rice.' }] }
    const first = await agent.post('/api/words').set(auth).send(word).expect(201)
    await agent.patch(`/api/words/${first.body.data._id}`).set(auth).send({ status: 'known' }).expect(200)
    const again = await agent.post('/api/words').set(auth).send({ ...word, meaning: 'eat' }).expect(200)
    assert.equal(again.body.data.status, 'known', 're-saving keeps the review status')

    const lemmas = await agent.get('/api/words/lemmas?lang=ko').set(auth).expect(200)
    assert.deepEqual(lemmas.body.data, ['먹다'])
  })
})
