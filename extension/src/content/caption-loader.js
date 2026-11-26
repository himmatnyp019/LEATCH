/**
 * Picks the right subtitle tracks for the learner, fetches them through the page bridge and
 * produces aligned sentence cues `{ start, end, text, translation }`.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const PLAYER_DATA_TIMEOUT_MS = 12000
  const RETRY_MS = 400

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const { sameLanguage, baseCode } = LEATCH.languages

  const waitForPlayerData = async (videoId) => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < PLAYER_DATA_TIMEOUT_MS) {
      try {
        const data = await LEATCH.bridge.request('GET_PLAYER_DATA', {}, 3000)
        if (data?.videoId === videoId) return data
      } catch {
        // The page hook may not be ready yet; retry.
      }
      await sleep(RETRY_MS)
    }
    return null
  }

  /** Prefers human captions in the language being learned, then auto captions, then anything. */
  const chooseSourceTrack = (tracks, learningLang, preferredVssId) => {
    const preferred = preferredVssId && tracks.find((track) => track.vssId === preferredVssId)
    if (preferred) return preferred
    const inLanguage = tracks.filter((track) => sameLanguage(track.languageCode, learningLang))
    return (
      inLanguage.find((track) => track.kind !== 'asr') ||
      inLanguage[0] ||
      tracks.find((track) => track.kind !== 'asr') ||
      tracks[0]
    )
  }

  /** Translation target; flips to the other side of the pair when the video is already in it. */
  const resolveTargetLang = (settings, sourceLang) => {
    const target = LEATCH.settings.translationTarget(settings)
    if (!sameLanguage(target, sourceLang)) return target
    return sameLanguage(sourceLang, settings.learningLang) ? settings.nativeLang : settings.learningLang
  }

  /** A human-made track in the target language beats YouTube's machine translation. */
  const chooseTranslation = (tracks, translationLanguages, source, targetLang) => {
    const human = tracks.find((track) => track !== source && track.kind !== 'asr' && sameLanguage(track.languageCode, targetLang))
    if (human) return { track: human, tlang: '' }
    if (!source.isTranslatable) return null
    const exact = translationLanguages.find((lang) => lang.languageCode === targetLang)
    const close = translationLanguages.find((lang) => sameLanguage(lang.languageCode, targetLang))
    const tlang = exact?.languageCode || close?.languageCode || (translationLanguages.length ? null : targetLang)
    return tlang ? { track: source, tlang } : null
  }

  const fetchEvents = async (track, videoId, tlang = '') => {
    const result = await LEATCH.bridge.request('FETCH_TRACK', { baseUrl: track.baseUrl, videoId, tlang }, 25000)
    return LEATCH.captions.parse(result?.text)
  }

  const trackLabel = (track) => track.name || `${track.languageCode}${track.kind === 'asr' ? ' (auto)' : ''}`

  /**
   * Loads and aligns subtitles for the current video.
   *
   * @param {{ videoId: string, settings: object, preferredVssId?: string }} options
   * @returns {Promise<object>} `{ status, playerData, tracks, source, sourceLang, targetLang, cues, translationOrigin }`
   */
  const load = async ({ videoId, settings, preferredVssId }) => {
    const playerData = await waitForPlayerData(videoId)
    if (!playerData) return { status: 'no-player-data' }

    const { tracks, translationLanguages } = playerData
    if (!tracks.length) return { status: 'no-captions', playerData, tracks }

    const source = chooseSourceTrack(tracks, settings.learningLang, preferredVssId)
    const sourceLang = baseCode(source.languageCode)
    const targetLang = resolveTargetLang(settings, source.languageCode)
    const sourceEvents = await fetchEvents(source, videoId)
    if (!sourceEvents.length) return { status: 'empty', playerData, tracks, source }

    let translatedEvents = []
    let translationOrigin = 'none'
    if (settings.translationSource === 'youtube') {
      const choice = chooseTranslation(tracks, translationLanguages, source, targetLang)
      if (choice) {
        translatedEvents = await fetchEvents(choice.track, videoId, choice.tlang).catch(() => [])
        if (translatedEvents.length) translationOrigin = choice.tlang ? 'youtube' : 'human'
      }
    }

    const isAsr = source.kind === 'asr'
    const { buildCues, attachTranslations, alignWordsToSegments, looksSegmented } = LEATCH.cues
    const cues =
      isAsr && translatedEvents.length && looksSegmented(translatedEvents)
        ? alignWordsToSegments(sourceEvents, translatedEvents, sourceLang)
        : attachTranslations(buildCues(sourceEvents, { isAsr, lang: sourceLang, merge: settings.subtitles.mergeSentences }), translatedEvents)

    return {
      status: 'ok',
      playerData,
      tracks,
      source: { ...source, label: trackLabel(source) },
      sourceLang,
      targetLang,
      cues,
      translationOrigin,
    }
  }

  LEATCH.captionLoader = { load, chooseSourceTrack, chooseTranslation, resolveTargetLang, trackLabel }
})()
