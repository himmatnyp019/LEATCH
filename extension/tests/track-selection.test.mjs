import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadScripts } from './helpers/load.mjs'

const LEATCH = loadScripts('shared/languages.js', 'shared/settings.js', 'content/caption-parser.js', 'content/cue-builder.js', 'content/caption-loader.js')
const { chooseSourceTrack, chooseTranslation, resolveTargetLang } = LEATCH.captionLoader

const tracks = [
  { vssId: 'a.ko', languageCode: 'ko', kind: 'asr', isTranslatable: true },
  { vssId: '.en', languageCode: 'en', kind: '', isTranslatable: true },
  { vssId: '.ko', languageCode: 'ko', kind: '', isTranslatable: true },
]
const settings = { ...LEATCH.settings.DEFAULTS, learningLang: 'ko', nativeLang: 'en', translationLang: '' }

describe('track selection', () => {
  it('prefers human captions in the language being learned', () => {
    assert.equal(chooseSourceTrack(tracks, 'ko').vssId, '.ko')
    assert.equal(chooseSourceTrack(tracks.slice(0, 2), 'ko').vssId, 'a.ko')
    assert.equal(chooseSourceTrack(tracks, 'ko', '.en').vssId, '.en', 'explicit choice wins')
  })

  it('uses a human translation track when one exists', () => {
    const choice = chooseTranslation(tracks, [], tracks[2], 'en')
    assert.equal(choice.track.vssId, '.en')
    assert.equal(choice.tlang, '')
  })

  it('falls back to YouTube auto-translate with the exact language code', () => {
    const choice = chooseTranslation(tracks.slice(0, 1), [{ languageCode: 'zh-Hans' }, { languageCode: 'en' }], tracks[0], 'zh-Hans')
    assert.equal(choice.tlang, 'zh-Hans')
    assert.equal(chooseTranslation([{ ...tracks[0], isTranslatable: false }], [], { ...tracks[0], isTranslatable: false }, 'en'), null)
  })

  it('flips the translation direction when the video is already in the target language', () => {
    assert.equal(resolveTargetLang(settings, 'ko'), 'en')
    assert.equal(resolveTargetLang(settings, 'en'), 'ko', 'English video for an English speaker learning Korean → Korean translation')
    assert.equal(resolveTargetLang({ ...settings, translationLang: 'ja' }, 'ko'), 'ja')
  })
})
