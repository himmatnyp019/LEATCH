import { createServer } from 'node:http'

/**
 * Minimal in-memory stand-in for the LEATCH server, used by the e2e test.
 *
 * @param {number} port
 */
export const startMockApi = (port) => {
  const db = { videos: new Map(), words: [], analyzeRequests: [], token: 'e2e-token' }
  const user = { _id: 'u1', email: 'learner@example.com', name: 'Test Learner', preferences: { learningLang: 'ko', nativeLang: 'en' } }

  const send = (res, status, data, message = 'ok') => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(status < 400 ? { success: true, message, data } : { success: false, message, errors: [] }))
  }

  const readBody = (req) =>
    new Promise((resolve) => {
      let raw = ''
      req.on('data', (chunk) => (raw += chunk))
      req.on('end', () => resolve(raw ? JSON.parse(raw) : {}))
    })

  const analyzeLine = (line) => {
    const token = (line.text.match(/[가-힣]{2,}/g) || [])[1] || (line.text.match(/[가-힣]{2,}/) || [])[0]
    return {
      i: line.i,
      translation: '',
      items: token
        ? [{ surface: token, lemma: token, type: 'vocab', meaning: `AI meaning of ${token}`, reading: 'ai-reading', pos: 'noun', examples: [{ text: `${token} 예문 하나`, translation: 'AI example one' }, { text: `${token} 예문 둘`, translation: 'AI example two' }] }]
        : [],
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    const authed = req.headers.authorization === `Bearer ${db.token}`
    const path = url.pathname
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {}

    if (path === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: true, status: 'ok', ai: true }))
    }
    if (path === '/api/auth/login' && req.method === 'POST') {
      if (body.password !== 'secret123') return send(res, 401, null, 'Incorrect email or password')
      return send(res, 200, { token: db.token, user })
    }
    if (!authed) return send(res, 401, null, 'Please log in to continue')

    if (path === '/api/auth/me') return send(res, 200, user)
    if (path === '/api/ai/status') return send(res, 200, { enabled: true, model: 'mock', remainingToday: 100 })
    if (path === '/api/ai/analyze') {
      db.analyzeRequests.push(body)
      return send(res, 200, { cached: false, lines: body.lines.map(analyzeLine) })
    }
    if (path === '/api/words/lemmas') return send(res, 200, db.words.map((word) => word.lemma))
    if (path === '/api/words' && req.method === 'POST') {
      const word = { _id: `w${db.words.length + 1}`.padEnd(24, '0'), status: 'new', createdAt: new Date().toISOString(), ...body }
      db.words.push(word)
      return send(res, 201, word)
    }
    if (path === '/api/words' && req.method === 'GET') return send(res, 200, { items: db.words, pagination: { page: 1, limit: 60, total: db.words.length, pages: 1, hasNext: false } })
    if (path === '/api/videos' && req.method === 'GET') {
      const items = [...db.videos.values()].map(({ cues, vocab, notes, ...rest }) => ({ ...rest, cueCount: cues.length, vocabCount: vocab.length, noteCount: notes.length }))
      return send(res, 200, { items, pagination: { page: 1, limit: 24, total: items.length, pages: 1, hasNext: false } })
    }

    const videoMatch = path.match(/^\/api\/videos\/([\w-]{11})(\/notes|\/progress)?$/)
    if (videoMatch) {
      const [, videoId, sub] = videoMatch
      const video = db.videos.get(videoId)
      if (!sub && req.method === 'GET') return video ? send(res, 200, video) : send(res, 404, null, 'Not saved')
      if (!sub && req.method === 'PUT') {
        const next = { videoId, notes: [], progress: { position: 0, percent: 0 }, ...video, ...body, updatedAt: new Date().toISOString() }
        db.videos.set(videoId, next)
        return send(res, video ? 200 : 201, next)
      }
      if (!video) return send(res, 404, null, 'Not saved')
      if (sub === '/notes' && req.method === 'POST') {
        const note = { _id: `n${video.notes.length + 1}`.padEnd(24, '0'), ...body }
        video.notes.push(note)
        return send(res, 201, note)
      }
      if (sub === '/progress') {
        video.progress = { ...video.progress, ...body, percent: body.duration ? body.position / body.duration : 0, lastWatchedAt: new Date().toISOString() }
        return send(res, 200, video.progress)
      }
    }
    return send(res, 404, null, `No mock for ${req.method} ${path}`)
  })

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ db, close: () => server.close() })))
}
