/**
 * Runs in the page's MAIN world at document_start.
 *
 * YouTube's timedtext (subtitle) endpoint increasingly requires a proof-of-origin token that
 * only the player itself attaches. We observe the player's own timedtext requests, remember
 * their URL parameters and responses, and answer subtitle requests from the LEATCH content
 * script (isolated world) via window.postMessage.
 */
;(() => {
  if (window.__leatchCaptionHook) return
  window.__leatchCaptionHook = true

  const FROM_PAGE = 'leatch:page'
  const FROM_CONTENT = 'leatch:content'
  const TIMEDTEXT_PATH = '/api/timedtext'
  const POT_WAIT_MS = 6000
  const POLL_MS = 200
  const MAX_VIDEOS_TRACKED = 8
  // Params that describe *which* track to fetch; everything else is copied from the player's request.
  const TRACK_PARAMS = new Set(['lang', 'kind', 'tlang', 'fmt', 'name'])

  const nativeFetch = window.fetch.bind(window)
  /** videoId → { url: string|null, responses: Map<trackKey, text> } */
  const capturedByVideo = new Map()

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const trackKey = (params) => [params.get('lang') || '', params.get('kind') || '', params.get('tlang') || ''].join('|')

  const remember = (rawUrl, text) => {
    let url
    try {
      url = new URL(rawUrl, location.origin)
    } catch {
      return
    }
    const videoId = url.searchParams.get('v')
    if (!videoId) return

    const entry = capturedByVideo.get(videoId) || { url: null, responses: new Map() }
    if (url.searchParams.has('pot') || !entry.url) entry.url = url.toString()
    if (text && text.trim().startsWith('{')) entry.responses.set(trackKey(url.searchParams), text)

    capturedByVideo.delete(videoId)
    capturedByVideo.set(videoId, entry)
    while (capturedByVideo.size > MAX_VIDEOS_TRACKED) capturedByVideo.delete(capturedByVideo.keys().next().value)
  }

  const XHR = XMLHttpRequest.prototype
  const originalOpen = XHR.open
  const originalSend = XHR.send

  XHR.open = function open(method, url) {
    this.__leatchUrl = String(url)
    return originalOpen.apply(this, arguments)
  }

  XHR.send = function send() {
    if (this.__leatchUrl && this.__leatchUrl.includes(TIMEDTEXT_PATH)) {
      this.addEventListener('load', () => {
        let text = ''
        try {
          if (this.responseType === '' || this.responseType === 'text') text = this.responseText
        } catch {
          text = ''
        }
        remember(this.responseURL || this.__leatchUrl, text)
      })
    }
    return originalSend.apply(this, arguments)
  }

  window.fetch = function fetch(input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url
    const promise = nativeFetch(input, init)
    if (url && url.includes(TIMEDTEXT_PATH)) {
      promise
        .then((response) => response.clone().text())
        .then((text) => remember(url, text))
        .catch(() => {})
    }
    return promise
  }

  const currentVideoId = () => new URLSearchParams(location.search).get('v')
  const readText = (node) => node?.simpleText ?? (node?.runs || []).map((run) => run.text).join('') ?? ''

  const getPlayerResponse = () => {
    const videoId = currentVideoId()
    let response = null
    try {
      response = document.getElementById('movie_player')?.getPlayerResponse?.() || null
    } catch {
      response = null
    }
    if (response?.videoDetails?.videoId === videoId) return response
    const initial = window.ytInitialPlayerResponse
    if (initial?.videoDetails?.videoId === videoId) return initial
    return null
  }

  const getPlayerData = () => {
    const response = getPlayerResponse()
    if (!response) return null
    const renderer = response.captions?.playerCaptionsTracklistRenderer
    const details = response.videoDetails || {}
    return {
      videoId: details.videoId,
      title: details.title || '',
      author: details.author || '',
      lengthSeconds: Number(details.lengthSeconds) || 0,
      thumbnail: details.thumbnail?.thumbnails?.at(-1)?.url || '',
      tracks: (renderer?.captionTracks || []).map((track) => ({
        baseUrl: track.baseUrl,
        languageCode: track.languageCode,
        kind: track.kind || '',
        name: readText(track.name),
        vssId: track.vssId || '',
        isTranslatable: Boolean(track.isTranslatable),
      })),
      translationLanguages: (renderer?.translationLanguages || []).map((lang) => ({
        languageCode: lang.languageCode,
        name: readText(lang.languageName),
      })),
    }
  }

  const hasPot = (videoId) => Boolean(capturedByVideo.get(videoId)?.url?.includes('pot='))

  const buildTrackUrl = (baseUrl, tlang, videoId) => {
    const url = new URL(baseUrl, location.origin)
    const capturedUrl = capturedByVideo.get(videoId)?.url
    if (capturedUrl) {
      new URL(capturedUrl).searchParams.forEach((value, key) => {
        if (!TRACK_PARAMS.has(key) && !url.searchParams.has(key)) url.searchParams.set(key, value)
      })
    }
    url.searchParams.set('fmt', 'json3')
    if (tlang) url.searchParams.set('tlang', tlang)
    else url.searchParams.delete('tlang')
    return url
  }

  const fetchText = async (url) => {
    const response = await nativeFetch(url.toString(), { credentials: 'include' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  }

  /** Turns the player's captions on briefly so it performs its own token-bearing request. */
  const primeTokenFromPlayer = async (videoId) => {
    const button = document.querySelector('#movie_player .ytp-subtitles-button')
    if (!button) return false
    const wasOn = button.getAttribute('aria-pressed') === 'true'
    if (!wasOn) button.click()
    const startedAt = Date.now()
    while (Date.now() - startedAt < POT_WAIT_MS && !hasPot(videoId)) await sleep(POLL_MS)
    if (!wasOn && button.getAttribute('aria-pressed') === 'true') button.click()
    return hasPot(videoId)
  }

  const fetchTrack = async ({ baseUrl, tlang, videoId }) => {
    const wanted = buildTrackUrl(baseUrl, tlang, videoId)
    const key = trackKey(wanted.searchParams)
    const capturedText = () => capturedByVideo.get(videoId)?.responses.get(key) || ''

    if (capturedText()) return { text: capturedText(), via: 'captured' }

    let text = await fetchText(wanted).catch(() => '')
    if (!text.trim() && !hasPot(videoId)) {
      await primeTokenFromPlayer(videoId)
      text = capturedText() || (await fetchText(buildTrackUrl(baseUrl, tlang, videoId)).catch(() => ''))
    }
    return { text, via: 'fetch' }
  }

  const reply = (id, result) => window.postMessage({ source: FROM_PAGE, id, ...result }, location.origin)

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data?.source !== FROM_CONTENT) return
    const { id, type, payload } = event.data
    try {
      if (type === 'GET_PLAYER_DATA') reply(id, { ok: true, data: getPlayerData() })
      else if (type === 'FETCH_TRACK') reply(id, { ok: true, data: await fetchTrack(payload || {}) })
    } catch (err) {
      reply(id, { ok: false, error: String(err?.message || err) })
    }
  })
})()
