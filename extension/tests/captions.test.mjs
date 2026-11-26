import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadScripts } from './helpers/load.mjs'

const LEATCH = loadScripts('shared/languages.js', 'content/caption-parser.js', 'content/cue-builder.js')
const { parse } = LEATCH.captions
const { buildCues, attachTranslations, alignWordsToSegments, looksSegmented, findCueIndex } = LEATCH.cues

const json3 = (events) => JSON.stringify({ events })

describe('caption parser', () => {
  it('parses manual json3 events and decodes entities', () => {
    const events = parse(json3([
      { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: '안녕하세요 &amp; 반가워요' }] },
      { tStartMs: 1500, dDurationMs: 1000, segs: [{ utf8: '\n' }] },
      { tStartMs: 2000, dDurationMs: 2000, segs: [{ utf8: 'Tom &#39;s line\nwraps' }] },
    ]))
    assert.equal(events.length, 2)
    assert.equal(events[0].text, '안녕하세요 & 반가워요')
    assert.equal(events[1].text, "Tom 's line wraps")
    assert.equal(events[1].start, 2)
    assert.equal(events[1].end, 4)
  })

  it('keeps word timings of auto-generated json3 tracks', () => {
    const [event] = parse(json3([{ tStartMs: 1000, dDurationMs: 3000, segs: [{ utf8: '오늘은' }, { utf8: ' 날씨가', tOffsetMs: 400 }, { utf8: ' 좋네요', tOffsetMs: 900 }] }]))
    assert.equal(event.text, '오늘은 날씨가 좋네요')
    assert.deepEqual(event.words.map((word) => [word.time, word.text]), [[1, '오늘은'], [1.4, '날씨가'], [1.9, '좋네요']])
  })

  it('parses srv3 and srv1 XML', () => {
    const srv3 = parse('<timedtext><body><p t="500" d="1500">첫 번째<br/>줄</p><p t="2500" d="1000">두 번째</p></body></timedtext>')
    assert.deepEqual(srv3.map((event) => event.text), ['첫 번째 줄', '두 번째'])
    const srv1 = parse('<transcript><text start="1.5" dur="2">It&amp;#39;s fine</text></transcript>')
    assert.equal(srv1[0].text, "It's fine")
    assert.equal(srv1[0].start, 1.5)
  })

  it('returns an empty list for unusable payloads', () => {
    assert.deepEqual(parse(''), [])
    assert.deepEqual(parse('{not json'), [])
  })
})

describe('cue builder', () => {
  it('merges manual fragments that are one sentence, but not finished sentences', () => {
    const events = [
      { start: 0, end: 2, text: '제가 어제 친구랑', words: [] },
      { start: 2.1, end: 4, text: '영화를 봤어요', words: [] },
      { start: 4.2, end: 6, text: '정말 재미있었어요', words: [] },
    ]
    const cues = buildCues(events, { lang: 'ko', merge: true })
    assert.deepEqual(cues.map((cue) => cue.text), ['제가 어제 친구랑 영화를 봤어요', '정말 재미있었어요'])
    assert.equal(cues[0].end, 4)
  })

  it('does not merge when disabled and trims overlaps', () => {
    const cues = buildCues([
      { start: 0, end: 3, text: 'first part', words: [] },
      { start: 2, end: 4, text: 'second.', words: [] },
    ], { lang: 'en', merge: false })
    assert.equal(cues[0].end, 2)
  })

  it('segments word-timed auto captions on pauses and sentence endings', () => {
    const words = [
      ['안녕하세요', 0], ['여러분', 0.5], ['오늘은', 3], ['한국어를', 3.4], ['공부해요', 3.9], ['같이', 4.5], ['해요', 4.9],
    ].map(([text, time]) => ({ time, text }))
    const cues = buildCues([{ start: 0, end: 6, text: 'x', words }], { isAsr: true, lang: 'ko' })
    assert.deepEqual(cues.map((cue) => cue.text), ['안녕하세요 여러분', '오늘은 한국어를 공부해요', '같이 해요'])
  })

  it('attaches translations by overlap without duplicating repeated lines', () => {
    const cues = [
      { start: 0, end: 4, text: 'A B', translation: '' },
      { start: 4, end: 8, text: 'C', translation: '' },
    ]
    const translated = [
      { start: 0, end: 2, text: 'a' },
      { start: 2, end: 4, text: 'b' },
      { start: 4.1, end: 7, text: 'c' },
      { start: 4.1, end: 7, text: 'c' },
    ]
    assert.deepEqual(attachTranslations(cues, translated).map((cue) => cue.translation), ['a b', 'c'])
  })

  it('aligns auto-caption words to translated sentence segments', () => {
    const source = [{ start: 0, end: 6, text: '', words: [{ time: 0.2, text: '밥' }, { time: 0.6, text: '먹었어요?' }, { time: 2.2, text: '네' }, { time: 2.6, text: '먹었어요' }] }]
    const translated = [
      { start: 0, end: 2, text: 'Did you eat?' },
      { start: 2, end: 4, text: 'Yes, I ate.' },
      { start: 4, end: 5, text: '(laughs)' },
    ]
    assert.ok(looksSegmented(translated))
    const cues = alignWordsToSegments(source, translated, 'ko')
    assert.deepEqual(cues.map((cue) => [cue.text, cue.translation]), [['밥 먹었어요?', 'Did you eat?'], ['네 먹었어요', 'Yes, I ate. (laughs)']])
  })

  it('finds the cue for a time with binary search', () => {
    const cues = [{ start: 0, end: 1 }, { start: 2, end: 3 }, { start: 5, end: 6 }]
    assert.equal(findCueIndex(cues, -1), -1)
    assert.equal(findCueIndex(cues, 2.5), 1)
    assert.equal(findCueIndex(cues, 4), 1)
    assert.equal(findCueIndex(cues, 10), 2)
  })
})
