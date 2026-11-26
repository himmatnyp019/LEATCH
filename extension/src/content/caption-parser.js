/**
 * Parses YouTube timedtext responses (json3, srv3 XML, srv1 XML) into timed events.
 * Pure functions — no DOM / no innerHTML (YouTube enforces Trusted Types).
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})

  const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

  /** Decodes HTML entities (named subset + numeric). */
  const decodeEntities = (text) =>
    String(text || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
      if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? match
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : match
    })

  /** Decodes entities, strips markup / zero-width characters and collapses whitespace. */
  const normalizeText = (text) =>
    decodeEntities(text)
      .replace(/<\/?[a-z][^>]*>/gi, ' ')
      .replace(/[​-‍﻿]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const byStart = (a, b) => a.start - b.start

  /**
   * json3 → events. Each event keeps per-word timings when present (auto-generated tracks).
   *
   * @param {{ events?: Array }} data
   * @returns {Array<{ start: number, end: number, text: string, words: Array<{ time: number, text: string }> }>}
   */
  const parseJson3 = (data) => {
    const events = []
    for (const event of data.events || []) {
      if (!Array.isArray(event.segs)) continue
      const start = (event.tStartMs || 0) / 1000
      const end = start + (event.dDurationMs || 0) / 1000
      const text = normalizeText(event.segs.map((seg) => seg.utf8 || '').join(''))
      if (!text) continue
      const words = event.segs
        .map((seg) => ({ time: start + (seg.tOffsetMs || 0) / 1000, text: normalizeText(seg.utf8) }))
        .filter((word) => word.text)
      events.push({ start, end, text, words })
    }
    return events.sort(byStart)
  }

  const readAttr = (attrs, name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null

  /** srv3 (`<p t d>`) or srv1 (`<text start dur>`) XML → events. */
  const parseXml = (xml) => {
    const events = []
    for (const [, attrs, body] of xml.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
      const start = Number(readAttr(attrs, 't')) / 1000
      const duration = Number(readAttr(attrs, 'd') || 0) / 1000
      const text = normalizeText(body.replace(/<br\s*\/?>/gi, ' '))
      if (Number.isFinite(start) && text) events.push({ start, end: start + duration, text, words: [] })
    }
    if (events.length) return events.sort(byStart)

    for (const [, attrs, body] of xml.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const start = Number(readAttr(attrs, 'start'))
      const duration = Number(readAttr(attrs, 'dur') || 0)
      // srv1 bodies are entity-encoded twice.
      const text = normalizeText(decodeEntities(body))
      if (Number.isFinite(start) && text) events.push({ start, end: start + duration, text, words: [] })
    }
    return events.sort(byStart)
  }

  /**
   * Parses any supported timedtext payload.
   *
   * @param {string} raw
   * @returns {Array<{ start: number, end: number, text: string, words: Array }>}
   */
  const parse = (raw) => {
    const text = String(raw || '').trim()
    if (text.startsWith('{')) {
      try {
        return parseJson3(JSON.parse(text))
      } catch {
        return []
      }
    }
    return text.startsWith('<') ? parseXml(text) : []
  }

  LEATCH.captions = { ...LEATCH.captions, parse, normalizeText, decodeEntities }
})()
