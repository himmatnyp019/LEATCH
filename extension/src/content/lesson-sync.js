/**
 * Account features for the current video: saving the lesson (link, subtitles, translations,
 * vocabulary), saving words, timestamped notes and watch progress.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { api, call } = LEATCH.runtime

  const clip = (value, max) => String(value ?? '').slice(0, max)
  const seconds = (value) => (Number.isFinite(value) && value > 0 ? Math.min(Math.round(value * 100) / 100, 86400) : 0)

  /**
   * @param {{ getContext: () => object, onChange: () => void }} options
   *   getContext returns `{ videoId, playerData, source, sourceLang, targetLang, cues, analysis, video, translationFor }`
   */
  const create = ({ getContext, onChange }) => {
    let auth = null
    let saved = false
    let savedLemmas = new Set()

    const isLoggedIn = () => Boolean(auth?.token)

    /** Loads login state, whether this video is already saved and which words are saved. */
    const init = async () => {
      auth = (await call('AUTH_STATUS')).data || null
      saved = false
      savedLemmas = new Set()
      if (!isLoggedIn()) return onChange()

      const { videoId, sourceLang } = getContext()
      const [video, lemmas] = await Promise.all([
        api('GET', `/api/videos/${videoId}`),
        api('GET', `/api/words/lemmas?lang=${encodeURIComponent(sourceLang)}`),
      ])
      saved = video.ok
      if (lemmas.ok) savedLemmas = new Set(lemmas.data)
      onChange()
    }

    const buildLesson = () => {
      const context = getContext()
      const { videoId, playerData, source, video } = context
      return {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: clip(playerData.title, 300),
        channel: clip(playerData.author, 200),
        thumbnail: clip(playerData.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, 500),
        durationSec: seconds(playerData.lengthSeconds || video.duration),
        sourceLang: context.sourceLang,
        translationLang: context.targetLang,
        trackLabel: clip(source.label, 120),
        cues: context.cues.map((cue, index) => ({
          start: seconds(cue.start),
          end: seconds(cue.end),
          text: clip(cue.text, 1000),
          translation: clip(context.translationFor(index), 1000),
        })),
        vocab: context.analysis.collectAll().map((item) => ({
          cueIndex: item.cueIndex,
          surface: clip(item.surface, 120),
          lemma: clip(item.lemma, 120),
          type: item.type === 'grammar' ? 'grammar' : 'vocab',
          meaning: clip(item.meaning, 300),
          reading: clip(item.reading, 160),
          pos: clip(item.pos, 40),
          examples: (item.examples || []).slice(0, 2).map((example) => ({ text: clip(example.text, 400), translation: clip(example.translation, 400) })),
        })),
        progress: { position: seconds(video.currentTime), duration: seconds(video.duration) },
      }
    }

    /** Creates/updates the saved lesson. */
    const saveLesson = async () => {
      if (!isLoggedIn()) return { ok: false, error: 'Log in (click the LEATCH icon in the toolbar) to save lessons.' }
      const result = await api('PUT', `/api/videos/${getContext().videoId}`, buildLesson())
      if (result.ok) {
        saved = true
        onChange()
      }
      return result
    }

    /** Saves a vocabulary item with the sentence it came from. */
    const saveWord = async (item, cueIndex) => {
      if (!isLoggedIn()) return { ok: false, error: 'Log in (click the LEATCH icon in the toolbar) to save words.' }
      const context = getContext()
      const cue = context.cues[cueIndex]
      const result = await api('POST', '/api/words', {
        lang: context.sourceLang,
        lemma: clip(item.lemma, 120),
        surface: clip(item.surface, 120),
        type: item.type === 'grammar' ? 'grammar' : 'vocab',
        meaning: clip(item.meaning, 300),
        meaningLang: context.targetLang,
        reading: clip(item.reading, 160),
        pos: clip(item.pos, 40),
        examples: (item.examples || []).slice(0, 2).map((example) => ({ text: clip(example.text, 400), translation: clip(example.translation, 400) })),
        context: cue
          ? {
              sentence: clip(cue.text, 1000),
              translation: clip(context.translationFor(cueIndex), 1000),
              videoId: context.videoId,
              videoTitle: clip(context.playerData.title, 300),
              time: seconds(cue.start),
            }
          : undefined,
      })
      if (result.ok) {
        savedLemmas.add(item.lemma)
        onChange()
      }
      return result
    }

    /** Adds a note at `time` (saves the lesson first if needed). */
    const addNote = async (text, time, cueText) => {
      if (!saved) {
        const result = await saveLesson()
        if (!result.ok) return result
      }
      return api('POST', `/api/videos/${getContext().videoId}/notes`, { time: seconds(time), text: clip(text, 2000), cueText: clip(cueText, 1000) })
    }

    /** Sends watch progress for saved lessons. */
    const syncProgress = async () => {
      if (!saved || !isLoggedIn()) return
      const { video, videoId } = getContext()
      if (!Number.isFinite(video.currentTime)) return
      await api('PATCH', `/api/videos/${videoId}/progress`, { position: seconds(video.currentTime), duration: seconds(video.duration) })
    }

    return {
      init,
      saveLesson,
      saveWord,
      addNote,
      syncProgress,
      isLoggedIn,
      isSaved: () => saved,
      savedLemmas: () => savedLemmas,
    }
  }

  LEATCH.lessonSync = { create }
})()
