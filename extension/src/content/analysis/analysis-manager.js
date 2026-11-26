/**
 * Decides where vocabulary/grammar (and optional AI translations) come from and loads them lazily:
 *  - AI (LEATCH server): chunks of cues around the playhead, cached server-side for every user
 *  - local: the bundled offline dictionary
 * Only sections the learner actually watches are analyzed, which keeps AI token use low.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})

  const CHUNK_SIZE = 25
  const PREFETCH_WHEN_REMAINING = 8
  const MAX_PARALLEL_REQUESTS = 2
  const FATAL_STATUSES = new Set([401, 403, 503])

  /**
   * @param {object} options
   * @param {Array} options.cues
   * @param {string} options.videoId
   * @param {string} options.sourceLang
   * @param {string} options.meaningLang
   * @param {object} options.settings
   * @param {boolean} options.aiAvailable - logged in and the server has AI enabled
   * @param {(event: object) => void} options.onUpdate - called when results/engine/status change
   */
  const create = ({ cues, videoId, sourceLang, meaningLang, settings, aiAvailable, onUpdate }) => {
    const studyable = LEATCH.languages.isStudyLanguage(sourceLang) && !LEATCH.languages.sameLanguage(sourceLang, meaningLang)
    const needTranslation = settings.translationSource === 'ai' || cues.every((cue) => !cue.translation)

    const resolveEngine = () => {
      if (!studyable || settings.analysisEngine === 'off') return 'off'
      if (settings.analysisEngine === 'local') return 'local'
      if (aiAvailable) return 'ai'
      return 'local'
    }

    let engine = resolveEngine()
    let lastError = ''
    const chunkState = new Map()
    const aiResults = new Map()
    const translations = new Map()
    let localResults = null
    let inFlight = 0
    const queue = []

    const local = () => {
      if (!localResults) {
        const analyzer = LEATCH.localAnalyzer.create(LEATCH.languages.baseCode(sourceLang))
        localResults = analyzer.supported ? analyzer.analyzeAll(cues, 2) : cues.map(() => [])
      }
      return localResults
    }

    const notify = (event) => onUpdate?.({ engine, error: lastError, ...event })

    const runQueue = () => {
      while (inFlight < MAX_PARALLEL_REQUESTS && queue.length) {
        const chunkIndex = queue.shift()
        inFlight += 1
        requestChunk(chunkIndex).finally(() => {
          inFlight -= 1
          runQueue()
        })
      }
    }

    const requestChunk = async (chunkIndex) => {
      const start = chunkIndex * CHUNK_SIZE
      const lines = cues
        .slice(start, start + CHUNK_SIZE)
        .map((cue, offset) => ({ i: start + offset, text: cue.text.slice(0, 400), translation: (cue.translation || '').slice(0, 800) }))
        .filter((line) => line.text.trim())
      if (!lines.length) {
        chunkState.set(chunkIndex, 'done')
        return
      }

      const result = await LEATCH.runtime.api('POST', '/api/ai/analyze', {
        videoId,
        sourceLang: LEATCH.languages.baseCode(sourceLang),
        nativeLang: meaningLang,
        needTranslation,
        lines,
      })

      if (!result.ok) {
        chunkState.set(chunkIndex, 'error')
        lastError = result.error || 'AI analysis failed'
        if (FATAL_STATUSES.has(result.status) || result.status === 429 || result.status === 0) {
          engine = 'local'
          queue.length = 0
        }
        notify({ type: 'error', chunkIndex, status: result.status })
        return
      }

      for (const line of result.data.lines) {
        aiResults.set(line.i, line.items.map((item) => ({ ...item, source: 'ai' })))
        if (line.translation) translations.set(line.i, line.translation)
      }
      chunkState.set(chunkIndex, 'done')
      notify({ type: 'chunk', chunkIndex, cached: result.data.cached, from: start, to: start + CHUNK_SIZE - 1 })
    }

    const enqueue = (chunkIndex) => {
      if (chunkIndex < 0 || chunkIndex * CHUNK_SIZE >= cues.length || chunkState.has(chunkIndex)) return
      chunkState.set(chunkIndex, 'loading')
      queue.push(chunkIndex)
      runQueue()
    }

    /** Make sure the chunk around `cueIndex` (and the next one, near the end) is being analyzed. */
    const ensure = (cueIndex) => {
      if (engine !== 'ai' || cueIndex < 0) return
      const chunkIndex = Math.floor(cueIndex / CHUNK_SIZE)
      enqueue(chunkIndex)
      if (cueIndex % CHUNK_SIZE >= CHUNK_SIZE - PREFETCH_WHEN_REMAINING) enqueue(chunkIndex + 1)
    }

    /**
     * Items for a cue, trimmed to the user's preference.
     *
     * @returns {{ items: Array, pending: boolean, translation: string }}
     */
    const get = (cueIndex, maxItems = settings.vocab.maxPerSentence) => {
      if (cueIndex < 0 || cueIndex >= cues.length) return { items: [], pending: false, translation: '' }
      const translation = translations.get(cueIndex) || ''
      if (engine === 'off') return { items: [], pending: false, translation }
      if (engine === 'ai') {
        const items = aiResults.get(cueIndex)
        if (items) return { items: items.slice(0, maxItems), pending: false, translation }
        const state = chunkState.get(Math.floor(cueIndex / CHUNK_SIZE))
        if (state !== 'error') return { items: [], pending: true, translation }
      }
      return { items: local()[cueIndex].slice(0, maxItems), pending: false, translation }
    }

    /** All analyzed items (for saving a lesson). */
    const collectAll = () =>
      cues.flatMap((_, cueIndex) => {
        const { items } = get(cueIndex, 2)
        return items.map((item) => ({ cueIndex, ...item }))
      })

    return {
      ensure,
      get,
      collectAll,
      getEngine: () => engine,
      getError: () => lastError,
      needsTranslation: needTranslation,
      isStudyable: studyable,
    }
  }

  LEATCH.analysisManager = { create, CHUNK_SIZE }
})()
