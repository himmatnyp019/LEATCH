/**
 * Turns raw timedtext events into sentence-sized cues and aligns translations to them.
 * Pure functions (unit-tested in tests/cue-builder.test.mjs).
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})

  const SENTENCE_END = /[.!?。！？…♪]["'”’)\]」』]*$/
  const KO_POLITE_END = /(요|다|까|죠)$/
  const MAX_CUE_SECONDS = 9
  const MERGE_GAP_SECONDS = 0.5
  const ASR_PAUSE_SECONDS = 1.2
  const ASR_MAX_SECONDS = 7
  const ASR_TAIL_SECONDS = 1.2
  const NEAREST_MATCH_SECONDS = 1.5
  const MAX_CHARS = { ko: 48, ja: 40, zh: 36, th: 60 }
  const DEFAULT_MAX_CHARS = 110

  const baseCode = (code) => String(code || '').split('-')[0].toLowerCase()
  const maxChars = (lang) => MAX_CHARS[baseCode(lang)] ?? DEFAULT_MAX_CHARS
  const joiner = (lang) => (['ja', 'zh', 'th'].includes(baseCode(lang)) ? '' : ' ')

  /** Whether a line reads like a complete sentence (punctuation, or a Korean final ending). */
  const endsSentence = (text, lang) => {
    const trimmed = String(text).trim()
    return SENTENCE_END.test(trimmed) || (baseCode(lang) === 'ko' && KO_POLITE_END.test(trimmed))
  }

  /** Drops repeated lines and trims overlaps so at most one cue is active at a time. */
  const cleanTimeline = (cues) => {
    const output = []
    for (const cue of cues) {
      const previous = output.at(-1)
      if (previous && previous.text === cue.text && cue.start <= previous.end + 0.05) {
        previous.end = Math.max(previous.end, cue.end)
        continue
      }
      output.push({ ...cue })
    }
    for (let i = 0; i < output.length - 1; i++) {
      const next = output[i + 1]
      if (output[i].end > next.start && next.start > output[i].start) output[i].end = next.start
    }
    return output
  }

  /** Joins manual-caption fragments that are clearly one sentence split over two lines. */
  const mergeFragments = (cues, lang) => {
    const limit = maxChars(lang)
    const glue = joiner(lang)
    const output = []
    for (const cue of cues) {
      const previous = output.at(-1)
      const canMerge =
        previous &&
        !endsSentence(previous.text, lang) &&
        cue.start - previous.end <= MERGE_GAP_SECONDS &&
        cue.end - previous.start <= MAX_CUE_SECONDS &&
        previous.text.length + cue.text.length + 1 <= limit
      if (canMerge) {
        previous.text = `${previous.text}${glue}${cue.text}`
        previous.end = cue.end
      } else {
        output.push({ ...cue })
      }
    }
    return output
  }

  const collectWords = (events) =>
    events
      .flatMap((event) => (event.words?.length ? event.words : [{ time: event.start, text: event.text }]))
      .sort((a, b) => a.time - b.time)

  /** Groups word-timed auto captions into sentence-like cues using pauses, punctuation and length. */
  const segmentWords = (words, lang) => {
    const limit = maxChars(lang)
    const glue = joiner(lang)
    const isKorean = baseCode(lang) === 'ko'
    const cues = []
    let group = []

    const flush = (nextStart) => {
      if (!group.length) return
      const last = group.at(-1)
      const end = nextStart === undefined ? last.time + ASR_TAIL_SECONDS : Math.min(nextStart, last.time + ASR_TAIL_SECONDS + 0.4)
      cues.push({ start: group[0].time, end, text: group.map((word) => word.text).join(glue).trim() })
      group = []
    }

    for (const word of words) {
      const previous = group.at(-1)
      if (previous) {
        const gap = word.time - previous.time
        const length = group.reduce((sum, item) => sum + item.text.length + 1, 0)
        const tooLong = length + word.text.length > limit || word.time - group[0].time > ASR_MAX_SECONDS
        const pause = gap > ASR_PAUSE_SECONDS
        const sentence = SENTENCE_END.test(previous.text) || (isKorean && KO_POLITE_END.test(previous.text) && gap > 0.35 && length > 6)
        if (tooLong || pause || sentence) flush(word.time)
      }
      group.push(word)
    }
    flush()
    return cues
  }

  /**
   * Builds display cues from parsed events.
   *
   * @param {Array} events - from LEATCH.captions.parse
   * @param {{ isAsr?: boolean, lang?: string, merge?: boolean }} [options]
   * @returns {Array<{ start: number, end: number, text: string, translation: string }>}
   */
  const buildCues = (events, { isAsr = false, lang = '', merge = true } = {}) => {
    if (!events?.length) return []
    const wordTimed = isAsr && events.some((event) => event.words?.length > 1)
    let cues = wordTimed
      ? segmentWords(collectWords(events), lang)
      : events.map((event) => ({ start: event.start, end: Math.max(event.end, event.start + 0.4), text: event.text }))
    cues = cleanTimeline(cues)
    if (merge && !wordTimed) cues = mergeFragments(cues, lang)
    return cues.map((cue) => ({ ...cue, translation: '' }))
  }

  /** Index of the first cue whose end is after `time`. */
  const firstEndingAfter = (cues, time) => {
    let low = 0
    let high = cues.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (cues[mid].end <= time) low = mid + 1
      else high = mid
    }
    return low
  }

  const overlap = (a, b) => Math.min(a.end, b.end) - Math.max(a.start, b.start)

  /**
   * Assigns each translated event to the cue it overlaps most (or the nearest cue).
   *
   * @param {Array} cues
   * @param {Array} translatedEvents
   * @returns {Array} cues with `translation`
   */
  const attachTranslations = (cues, translatedEvents) => {
    if (!translatedEvents?.length) return cues
    const buckets = cues.map(() => [])

    for (const event of translatedEvents) {
      let best = -1
      let bestOverlap = 0
      for (let i = firstEndingAfter(cues, event.start); i < cues.length && cues[i].start < event.end; i++) {
        const amount = overlap(cues[i], event)
        if (amount > bestOverlap) {
          bestOverlap = amount
          best = i
        }
      }
      if (best < 0) {
        const middle = (event.start + event.end) / 2
        let bestDistance = NEAREST_MATCH_SECONDS
        const around = firstEndingAfter(cues, middle)
        for (let i = Math.max(0, around - 1); i <= Math.min(cues.length - 1, around + 1); i++) {
          const distance = Math.abs((cues[i].start + cues[i].end) / 2 - middle)
          if (distance < bestDistance) {
            bestDistance = distance
            best = i
          }
        }
      }
      if (best >= 0 && buckets[best].at(-1) !== event.text) buckets[best].push(event.text)
    }
    return cues.map((cue, i) => ({ ...cue, translation: buckets[i].join(' ') }))
  }

  /** True when events look like clean, non-overlapping sentence segments. */
  const looksSegmented = (events) => {
    if (!events || events.length < 3) return false
    let overlaps = 0
    for (let i = 1; i < events.length; i++) if (events[i].start < events[i - 1].end - 0.3) overlaps++
    const averageSeconds = events.reduce((sum, event) => sum + (event.end - event.start), 0) / events.length
    return overlaps / events.length < 0.2 && averageSeconds >= 1 && averageSeconds <= 12
  }

  /**
   * For auto-generated source captions: reuse the translated track's sentence boundaries,
   * so every cue pairs one source sentence with exactly one translation.
   */
  const alignWordsToSegments = (sourceEvents, translatedEvents, lang) => {
    const words = collectWords(sourceEvents)
    const glue = joiner(lang)
    const cues = []
    let cursor = 0

    translatedEvents.forEach((segment, index) => {
      const boundary = translatedEvents[index + 1]?.start ?? Infinity
      const group = []
      while (cursor < words.length && words[cursor].time < boundary) group.push(words[cursor++])
      if (group.length) {
        cues.push({
          start: Math.min(segment.start, group[0].time),
          end: Math.max(segment.end, group.at(-1).time + 0.3),
          text: group.map((word) => word.text).join(glue).trim(),
          translation: segment.text,
        })
      } else if (cues.length) {
        cues.at(-1).translation = `${cues.at(-1).translation} ${segment.text}`.trim()
      }
    })
    return cleanTimeline(cues)
  }

  /** Index of the last cue starting at or before `time` (-1 if none). */
  const findCueIndex = (cues, time) => {
    let low = 0
    let high = cues.length - 1
    let found = -1
    while (low <= high) {
      const mid = (low + high) >> 1
      if (cues[mid].start <= time) {
        found = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return found
  }

  LEATCH.cues = { buildCues, attachTranslations, alignWordsToSegments, looksSegmented, findCueIndex, endsSentence }
})()
