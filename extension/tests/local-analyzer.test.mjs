import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadScripts } from './helpers/load.mjs'

const LEATCH = loadScripts(
  'shared/languages.js',
  'content/analysis/korean.js',
  'content/analysis/dictionary-ko.js',
  'content/analysis/dictionary-en.js',
  'content/analysis/local-analyzer.js',
)

const korean = LEATCH.localAnalyzer.create('ko')
const english = LEATCH.localAnalyzer.create('en')
const lemmasIn = (analyzer, text) => analyzer.findAll(text).map((item) => item.lemma)

describe('Korean offline analyzer', () => {
  const cases = [
    ['저는 한국에 가고 싶어요', ['-고 싶다']],
    ['배가 아파서 병원에 갔어요', ['-아/어서', '아프다']],
    ['비가 오는데 우산이 없어요', ['-는데 / -(으)ㄴ데']],
    ['친구랑 같이 영화 봤어요', ['친구', '같이']],
    ['여기서 기다릴게요', ['-(으)ㄹ게(요)', '기다리다']],
    ['한국어를 읽을 수 있어요', ['-(으)ㄹ 수 있다/없다', '읽다']],
    ['어떻게 생각해요?', ['생각하다']],
    ['걱정하지 마세요', ['-지 마(세요)', '걱정하다']],
    ['내일 만날 거예요', ['-(으)ㄹ 거예요', '만나다']],
  ]
  for (const [sentence, expected] of cases) {
    it(`finds ${expected.join(', ')} in “${sentence}”`, () => {
      const found = lemmasIn(korean, sentence)
      expected.forEach((lemma) => assert.ok(found.includes(lemma), `${lemma} missing from ${JSON.stringify(found)}`))
    })
  }

  it('avoids common false positives', () => {
    assert.ok(!lemmasIn(korean, '여기서 기다려요').includes('-아/어서'), '여기서 is a particle, not -아/어서')
    assert.ok(!lemmasIn(korean, '이것도 괜찮아요').includes('-아/어도 되다'))
    assert.ok(!lemmasIn(korean, '라면 먹을래요').includes('-(으)면'))
  })

  it('returns the matched surface so it can be highlighted', () => {
    const item = korean.findAll('저는 한국에 가고 싶어요').find((entry) => entry.lemma === '-고 싶다')
    assert.equal(item.surface, '가고 싶어요')
    assert.equal(item.examples.length, 2)
  })

  it('picks at most N items per cue and rotates away from repeats', () => {
    const cues = ['진짜 맛있어요', '진짜 맛있어요', '진짜 맛있어요'].map((text) => ({ text }))
    const picks = korean.analyzeAll(cues, 1)
    assert.ok(picks.every((items) => items.length === 1))
    assert.notEqual(picks[0][0].lemma, picks[1][0].lemma, 'the next sentence shows a different word when possible')
  })
})

describe('English offline analyzer', () => {
  it('matches phrasal verbs with an object in between', () => {
    assert.ok(lemmasIn(english, 'I finally figured it out').includes('figure out'))
  })

  it('distinguishes used to from get used to', () => {
    assert.ok(lemmasIn(english, 'I used to live here').includes('used to'))
    const found = lemmasIn(english, "I'm getting used to it")
    assert.ok(found.includes('get used to'))
    assert.ok(!found.includes('used to'))
  })

  it('matches inflected single words', () => {
    const found = lemmasIn(english, 'Honestly, she realized it was an amazing experience')
    for (const lemma of ['honestly', 'realize', 'experience']) assert.ok(found.includes(lemma), lemma)
  })
})
