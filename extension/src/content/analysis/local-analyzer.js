/**
 * Offline vocabulary / grammar picker backed by the bundled starter dictionaries.
 * Produces the same item shape as the AI analysis:
 *   { surface, lemma, type, meaning, reading, pos, examples: [{ text, translation }], source: 'local' }
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})

  const KO_PARTICLES = [
    '에서는', '에서도', '에게서', '한테서', '으로는', '이에요', '입니다', '에서', '에게', '한테', '께서', '으로',
    '까지', '부터', '처럼', '보다', '이랑', '이나', '하고', '이야', '예요', '이다', '랑', '로', '은', '는', '이',
    '가', '을', '를', '에', '의', '도', '만', '와', '과', '나', '요', '야',
  ]
  const HADA_ENDINGS = ['하', '해', '했', '할', '한', '합', '함']
  const RECENT_WINDOW = 4
  const RECENT_PENALTY = 30

  const toItem = (entry, surface) => ({
    surface,
    lemma: entry.lemma,
    type: entry.type,
    meaning: entry.meaning,
    reading: entry.reading,
    pos: entry.pos,
    examples: entry.examples,
    level: entry.level,
    source: 'local',
  })

  // ---------- Korean ----------
  const buildKoreanIndex = (dictionary) => {
    const nouns = new Map()
    const exact = new Map()
    const prefixes = []
    for (const entry of dictionary.words) {
      const { match } = entry
      if (Array.isArray(match.noun)) match.noun.forEach((form) => nouns.set(form, entry))
      ;(match.exact || []).forEach((form) => exact.set(form, entry))
      ;(match.prefix || []).forEach((form) => prefixes.push([form, entry]))
      if (match.hada) {
        HADA_ENDINGS.forEach((ending) => prefixes.push([match.hada + ending, entry]))
        if (match.noun === true) nouns.set(match.hada, entry)
        ;(match.extraNouns || []).forEach((form) => nouns.set(form, entry))
      }
    }
    prefixes.sort((a, b) => b[0].length - a[0].length)
    return { nouns, exact, prefixes }
  }

  const stripParticles = (token) => [
    token,
    ...KO_PARTICLES.filter((particle) => token.length > particle.length && token.endsWith(particle)).map((particle) =>
      token.slice(0, -particle.length),
    ),
  ]

  const matchKoreanToken = (token, index) => {
    const exact = index.exact.get(token) || index.exact.get(token.replace(/요$/, ''))
    if (exact) return exact
    for (const candidate of stripParticles(token)) {
      const noun = index.nouns.get(candidate)
      if (noun) return noun
    }
    for (const [form, entry] of index.prefixes) {
      if (!token.startsWith(form)) continue
      // Single-syllable stems (먹, 읽 …) must be followed by an ending.
      if (form.length === 1 && token.length === 1) continue
      return entry
    }
    return null
  }

  const findKorean = (text, dictionary, index) => {
    const found = []
    for (const entry of dictionary.grammar) {
      const surface = entry.find(text)
      if (surface) found.push(toItem(entry, surface))
    }
    for (const [token] of text.matchAll(/[가-힣]+/g)) {
      const entry = matchKoreanToken(token, index)
      if (entry) found.push(toItem(entry, token))
    }
    return found
  }

  // ---------- English ----------
  const inflect = (base) => {
    const forms = new Set([base, `${base}s`, `${base}es`, `${base}ed`, `${base}d`, `${base}ing`])
    if (base.endsWith('e')) forms.add(`${base.slice(0, -1)}ing`)
    if (base.endsWith('y')) {
      forms.add(`${base.slice(0, -1)}ies`)
      forms.add(`${base.slice(0, -1)}ied`)
    }
    return forms
  }

  const buildEnglishIndex = (dictionary) => {
    const words = new Map()
    for (const entry of dictionary.words) {
      const forms = entry.forms ? new Set(entry.forms) : inflect(entry.lemma)
      forms.forEach((form) => words.set(form, entry))
    }
    return { words }
  }

  const findEnglish = (text, dictionary, index) => {
    const found = []
    for (const entry of [...dictionary.grammar, ...dictionary.phrases]) {
      const match = text.match(entry.pattern)
      if (match) found.push(toItem(entry, match[0]))
    }
    for (const [token] of text.matchAll(/[A-Za-z']+/g)) {
      const entry = index.words.get(token.toLowerCase())
      if (entry) found.push(toItem(entry, token))
    }
    return found
  }

  // ---------- selection ----------
  const score = (item, recentLemmas) =>
    item.level * 10 + (item.type === 'grammar' ? 3 : 0) + Math.min(item.surface.length, 8) / 4 - (recentLemmas.has(item.lemma) ? RECENT_PENALTY : 0)

  const pickBest = (candidates, max, recentLemmas) => {
    const unique = [...new Map(candidates.map((item) => [item.lemma, item])).values()]
    return unique
      .map((item) => ({ item, value: score(item, recentLemmas) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, max)
      .map(({ item }) => item)
  }

  /**
   * Creates an analyzer for one study language.
   *
   * @param {string} lang - 'ko' | 'en'
   * @returns {{ supported: boolean, meaningLang: string|null, analyzeAll: Function }}
   */
  const create = (lang) => {
    const dictionary = LEATCH.dictionaries?.[lang]
    if (!dictionary) return { supported: false, meaningLang: null, analyzeAll: (cues) => cues.map(() => []) }

    const index = lang === 'ko' ? buildKoreanIndex(dictionary) : buildEnglishIndex(dictionary)
    const findAll = (text) => (lang === 'ko' ? findKorean(text, dictionary, index) : findEnglish(text, dictionary, index))

    /**
     * Picks up to `max` items for every cue, rotating so recently shown lemmas are de-prioritised.
     *
     * @param {Array<{ text: string }>} cues
     * @param {number} [max=2]
     * @returns {Array<Array<object>>} items per cue
     */
    const analyzeAll = (cues, max = 2) => {
      const recent = []
      return cues.map((cue) => {
        const picked = pickBest(findAll(cue.text), max, new Set(recent.flat()))
        recent.push(picked.map((item) => item.lemma))
        if (recent.length > RECENT_WINDOW) recent.shift()
        return picked
      })
    }

    return { supported: true, meaningLang: dictionary.meaningLang, analyzeAll, findAll }
  }

  LEATCH.localAnalyzer = { create }
})()
