/**
 * End-to-end test: loads the unpacked extension into Chromium, serves a mock YouTube watch page
 * and a mock LEATCH API, then exercises subtitles, key words, study pauses, login and saving.
 *
 *   node tests/e2e/run-e2e.mjs [screenshot-dir]
 */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { startMockApi } from './mock-api.mjs'
import { VIDEO_ID, timedtext, watchPage } from './mock-youtube.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const here = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_DIR = path.resolve(here, '../..')
const SCREENSHOT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, 'output')
const VIDEO_FILE = readFileSync(path.join(here, 'fixtures/mock-video.webm'))
const WATCH_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`

mkdirSync(SCREENSHOT_DIR, { recursive: true })

const step = (name) => console.log(`\n▶ ${name}`)
const ok = (message) => console.log(`  ✓ ${message}`)

/** Evaluates inside the overlay's shadow root. */
const overlay = (page, fn, arg) =>
  page.evaluate(
    ([source, value]) => {
      const root = document.getElementById('leatch-overlay')?.shadowRoot
      // eslint-disable-next-line no-new-func
      return root ? new Function('root', 'arg', `return (${source})(root, arg)`)(root, value) : null
    },
    [fn.toString(), arg],
  )

const waitForOverlay = (page, fn, arg, timeout = 15000) =>
  page.waitForFunction(
    ([source, value]) => {
      const root = document.getElementById('leatch-overlay')?.shadowRoot
      // eslint-disable-next-line no-new-func
      return root && new Function('root', 'arg', `return (${source})(root, arg)`)(root, value)
    },
    [fn.toString(), arg],
    { timeout },
  )

const video = {
  play: (page) => page.evaluate(() => document.querySelector('video').play()),
  pause: (page) => page.evaluate(() => document.querySelector('video').pause()),
  seek: (page, time) => page.evaluate((t) => (document.querySelector('video').currentTime = t), time),
  state: (page) => page.evaluate(() => ({ time: document.querySelector('video').currentTime, paused: document.querySelector('video').paused })),
}

/** Waits (briefly) for the settings tab the extension opens on first install, then closes it. */
const closeInstallTab = async (context) => {
  const isOptions = (candidate) => candidate.url().includes('/options/options.html')
  const existing = context.pages().find(isOptions) || (await context.waitForEvent('page', { predicate: isOptions, timeout: 5000 }).catch(() => null))
  await existing?.close()
}

/** Serves the mock video with HTTP range support so the media element is seekable. */
const fulfillVideo = (route) => {
  const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '')
  if (!range) return route.fulfill({ contentType: 'video/webm', headers: { 'Accept-Ranges': 'bytes' }, body: VIDEO_FILE })
  const start = Number(range[1])
  const end = range[2] ? Number(range[2]) : VIDEO_FILE.length - 1
  return route.fulfill({
    status: 206,
    contentType: 'video/webm',
    headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${VIDEO_FILE.length}` },
    body: VIDEO_FILE.subarray(start, end + 1),
  })
}

const main = async () => {
  const api = await startMockApi(4000)
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'leatch-e2e-'))
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`, '--autoplay-policy=no-user-gesture-required'],
  })

  try {
    await context.route('https://www.youtube.com/**', (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/watch') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: watchPage() })
      if (url.pathname === '/api/timedtext') return route.fulfill({ contentType: 'application/json', body: timedtext(url) })
      if (url.pathname === '/leatch-test/video.webm') return fulfillVideo(route)
      return route.fulfill({ status: 404, body: '' })
    })
    await context.route('https://i.ytimg.com/**', (route) => route.fulfill({ status: 404, body: '' }))

    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
    const extensionId = new URL(worker.url()).host
    ok(`extension loaded (${extensionId})`)
    const extensionUrl = (file) => `chrome-extension://${extensionId}/${file}`

    // ---------------------------------------------------------------
    step('Logged out: subtitles + offline dictionary')
    // The extension opens its settings tab on install; keep the YouTube tab in front so the
    // headless compositor keeps animating it (background tabs don't advance CSS animations).
    await closeInstallTab(context)
    const page = await context.newPage()
    await page.bringToFront()
    page.on('console', (message) => message.type() === 'error' && console.log('  [page error]', message.text()))
    await page.goto(WATCH_URL)
    await page.waitForSelector('#leatch-overlay', { state: 'attached', timeout: 20000 })
    await waitForOverlay(page, (root) => /offline dictionary/.test(root.querySelector('.lt-status-text')?.textContent || ''))
    ok('overlay mounted, engine = offline dictionary')

    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.ytp-caption-window-container')).display), 'none')
    ok("YouTube's own captions are hidden")

    await video.seek(page, 0.5)
    await video.play(page)
    await waitForOverlay(page, (root) => root.querySelector('.lt-original .lt-text')?.textContent.includes('가고 싶어요'))
    const firstLine = await overlay(page, (root) => ({
      original: root.querySelector('.lt-original .lt-text').textContent,
      translation: root.querySelector('.lt-translation').textContent,
      highlighted: [...root.querySelectorAll('.lt-original mark')].map((mark) => mark.textContent),
      cards: [...root.querySelectorAll('.lt-vocab .lt-card .lt-term')].map((term) => term.textContent),
    }))
    assert.equal(firstLine.translation, 'I want to go to Korea.')
    assert.ok(firstLine.cards.includes('-고 싶다'), `cards: ${firstLine.cards}`)
    assert.ok(firstLine.highlighted.includes('가고 싶어요'))
    ok(`dual subtitle: “${firstLine.original}” / “${firstLine.translation}”`)
    ok(`key words: ${firstLine.cards.join(', ')}`)

    await waitForOverlay(page, (root) => root.querySelector('.lt-original .lt-text')?.textContent.includes('영화 봤어요'))
    const secondCards = await overlay(page, (root) => [...root.querySelectorAll('.lt-vocab .lt-card .lt-term')].map((term) => term.textContent))
    assert.ok(secondCards.length >= 1 && !secondCards.includes('-고 싶다'))
    ok(`switched to next sentence's key words: ${secondCards.join(', ')}`)
    await page.mouse.move(400, 200)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1-player-subtitles-and-vocab.png') })

    // ---------------------------------------------------------------
    step('Manual pause opens the study card; play hides it')
    await video.pause(page)
    await waitForOverlay(page, (root) => !root.querySelector('.lt-study').classList.contains('lt-hidden'))
    const card = await overlay(page, (root) => ({
      sentence: root.querySelector('.lt-study-sentence.is-primary .lt-study-original').textContent,
      translation: root.querySelector('.lt-study-sentence.is-primary .lt-study-translation')?.textContent,
      cards: root.querySelectorAll('.lt-study-vocab .lt-card').length,
      examples: root.querySelectorAll('.lt-study-vocab .lt-examples li').length,
    }))
    assert.ok(card.sentence.includes('영화 봤어요'))
    assert.equal(card.translation, 'I watched a movie with my friend.')
    assert.ok(card.cards >= 1 && card.examples >= 2)
    ok(`study card: ${card.cards} key word card(s) with ${card.examples} examples`)
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '2-study-card-on-pause.png') })
    await video.play(page)
    await waitForOverlay(page, (root) => root.querySelector('.lt-study').classList.contains('lt-hidden'))
    ok('study card hidden on play')

    // ---------------------------------------------------------------
    step('Auto-pause after every sentence')
    await worker.evaluate(() => globalThis.LEATCH.settings.save({ study: { autoPause: 'sentence', everyNSentences: 1 } }))
    await video.pause(page)
    await video.seek(page, 6.0)
    await page.waitForTimeout(300)
    await video.play(page)
    await waitForOverlay(page, (root) => /Study pause/.test(root.querySelector('.lt-study-meta')?.textContent || '') && !root.querySelector('.lt-study').classList.contains('lt-hidden'), null, 8000)
    const stopped = await video.state(page)
    assert.ok(stopped.paused, 'video paused automatically')
    assert.ok(stopped.time > 8.2 && stopped.time < 8.9, `paused at sentence end (t=${stopped.time.toFixed(2)})`)
    ok(`paused automatically at ${stopped.time.toFixed(2)}s — end of “배가 아파서 병원에 갔어요”`)
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '3-auto-pause-study-card.png') })
    await worker.evaluate(() => globalThis.LEATCH.settings.save({ study: { autoPause: 'off' } }))

    // ---------------------------------------------------------------
    step('Log in from the popup → AI key words')
    const popup = await context.newPage()
    await popup.setViewportSize({ width: 360, height: 640 })
    await popup.goto(extensionUrl('popup/popup.html'))
    await popup.fill('input[type=email]', 'learner@example.com')
    await popup.fill('input[type=password]', 'wrong-password')
    await popup.click('button[type=submit]')
    await popup.waitForSelector('.alert.error:not(.hidden)')
    ok('wrong password shows an error')
    await popup.fill('input[type=password]', 'secret123')
    await popup.click('button[type=submit]')
    await popup.waitForSelector('.account-user')
    ok('logged in')
    await popup.screenshot({ path: path.join(SCREENSHOT_DIR, '4-popup.png'), fullPage: true })
    await popup.close()

    await page.bringToFront()
    await waitForOverlay(page, (root) => /· AI/.test(root.querySelector('.lt-status-text')?.textContent || ''))
    ok('session reloaded with AI engine')
    await video.seek(page, 3.2)
    await video.play(page)
    await waitForOverlay(page, (root) => [...root.querySelectorAll('.lt-vocab .lt-meaning')].some((meaning) => meaning.textContent.startsWith('AI meaning')))
    assert.ok(api.db.analyzeRequests.length >= 1)
    assert.equal(api.db.analyzeRequests[0].needTranslation, false, 'YouTube translation available → no AI translation requested')
    assert.equal(api.db.analyzeRequests[0].lines.length, 6)
    ok(`AI analysis requested once per chunk (${api.db.analyzeRequests.length} request, ${api.db.analyzeRequests[0].lines.length} lines)`)

    // ---------------------------------------------------------------
    step('Save a word, the lesson and a note')
    // Pauses right after a seek are ignored on purpose (scrubbing), so let playback settle first.
    await page.waitForTimeout(800)
    await video.pause(page)
    await waitForOverlay(page, (root) => !root.querySelector('.lt-study').classList.contains('lt-hidden'))
    await overlay(page, (root) => root.querySelector('.lt-study-vocab .lt-card button[aria-label="Save word"]').click())
    await waitForOverlay(page, (root) => root.querySelector('.lt-toast')?.textContent.includes('Saved'))
    assert.equal(api.db.words.length, 1)
    assert.ok(api.db.words[0].context.sentence.length > 0)
    ok(`word saved: ${api.db.words[0].lemma} (with source sentence)`)

    await overlay(page, (root) => {
      const input = root.querySelector('.lt-note-input')
      input.value = '친구랑 = with a friend (casual)'
      root.querySelector('.lt-note-row .lt-btn').click()
    })
    await waitForOverlay(page, (root) => root.querySelector('.lt-note-status')?.textContent.includes('Saved'))
    const saved = api.db.videos.get(VIDEO_ID)
    assert.ok(saved, 'adding a note saves the lesson first')
    assert.equal(saved.cues.length, 6)
    assert.equal(saved.cues[0].translation, 'I want to go to Korea.')
    assert.equal(saved.url, WATCH_URL)
    assert.ok(saved.vocab.length >= 1)
    assert.equal(saved.notes.length, 1)
    ok(`lesson saved: ${saved.cues.length} sentences, ${saved.vocab.length} key words, ${saved.notes.length} note`)

    // ---------------------------------------------------------------
    step('Library and settings pages')
    const library = await context.newPage()
    await library.setViewportSize({ width: 1280, height: 860 })
    await library.goto(extensionUrl('library/library.html'))
    await library.waitForSelector('.lesson-card')
    await library.screenshot({ path: path.join(SCREENSHOT_DIR, '5-library-lessons.png') })
    await library.click('.lesson-card')
    await library.waitForSelector('.transcript-row')
    assert.equal(await library.locator('.transcript-row').count(), 6)
    await library.screenshot({ path: path.join(SCREENSHOT_DIR, '6-library-lesson.png') })
    ok('lesson detail shows transcript, notes and key words')
    await library.goto(extensionUrl('library/library.html#words'))
    await library.waitForSelector('.word-card')
    await library.screenshot({ path: path.join(SCREENSHOT_DIR, '7-library-words.png') })
    ok('word list renders')

    const options = await context.newPage()
    await options.setViewportSize({ width: 1280, height: 900 })
    await options.goto(extensionUrl('options/options.html'))
    await options.waitForSelector('.account-user')
    await options.screenshot({ path: path.join(SCREENSHOT_DIR, '8-settings.png') })
    ok('settings page renders')

    console.log(`\nAll e2e checks passed. Screenshots: ${SCREENSHOT_DIR}`)
  } finally {
    await context.close()
    api.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error('\n✗ E2E FAILED:', err)
  process.exit(1)
})
