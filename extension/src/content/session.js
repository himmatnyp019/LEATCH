/**
 * One LEATCH session per watched video: loads subtitles, keeps the overlay in sync with playback,
 * runs study pauses and connects UI actions to the account features.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { runtime, ui } = LEATCH

  const ACTIVE_GRACE_SECONDS = 0.25
  const PROGRESS_SYNC_MS = 30000
  const MAX_CARD_SENTENCES = 5
  const RELOAD_KEYS = ['enabled', 'learningLang', 'nativeLang', 'translationLang', 'translationSource', 'analysisEngine', 'serverUrl', 'subtitles.mergeSentences']
  const AUTO_PAUSE_CYCLE = [
    { autoPause: 'off' },
    { autoPause: 'sentence', everyNSentences: 1 },
    { autoPause: 'sentence', everyNSentences: 3 },
    { autoPause: 'interval', intervalSeconds: 30 },
  ]

  /**
   * @param {{ videoId: string, elements: { player: HTMLElement, video: HTMLVideoElement }, settings: object }} options
   */
  const create = async ({ videoId, elements, settings: initialSettings }) => {
    const { player, video } = elements
    let settings = initialSettings
    let destroyed = false
    let loadToken = 0
    let captions = null
    let cues = []
    let analysis = null
    let activeIndex = -1
    let preferredVssId = null
    let cardState = null
    let autoResumeTimer = null
    let renderFrame = 0
    let overlay = null
    let sync = null
    let study = null

    // ---------- helpers ----------
    const sourceLang = () => captions?.sourceLang || settings.learningLang
    const translationFor = (index) => cues[index]?.translation || analysis?.get(index).translation || ''
    const speak = (text) => LEATCH.tts.speak(text, sourceLang(), settings.tts)
    const ready = () => Boolean(captions?.status === 'ok' && analysis && settings.enabled)

    const toast = (message, kind) => overlay?.toast(message, kind)

    const languagePair = () => `${LEATCH.languages.baseCode(sourceLang()).toUpperCase()} → ${LEATCH.languages.baseCode(captions?.targetLang || settings.nativeLang).toUpperCase()}`

    const setStatus = (status) => overlay?.toolbar.update({ settings, status })

    const describeEngine = () => {
      const engine = analysis?.getEngine()
      if (engine === 'ai') return { level: 'ok', text: `${languagePair()} · AI`, title: 'Key words picked by AI (cached on your LEATCH server)' }
      if (engine === 'local') {
        const reason = analysis.getError() || (sync.isLoggedIn() ? 'AI is not enabled on the server' : 'Log in for AI-picked words')
        return { level: 'local', text: `${languagePair()} · offline dictionary`, title: reason }
      }
      return { level: 'warn', text: `${languagePair()} · subtitles only`, title: 'Vocabulary is available when studying Korean or English' }
    }

    // ---------- rendering ----------
    const activeAt = (time) => {
      const index = LEATCH.cues.findCueIndex(cues, time)
      return index >= 0 && time <= cues[index].end + ACTIVE_GRACE_SECONDS ? index : -1
    }

    const render = () => {
      if (!overlay || !sync) return
      if (!ready()) {
        overlay.subtitleView.render({ cue: null, items: [], translation: '', sourceLang: sourceLang(), settings })
        overlay.vocabPanel.render({ items: [], pending: false, settings, savedLemmas: sync.savedLemmas(), visible: false })
        return
      }
      const cue = activeIndex >= 0 ? cues[activeIndex] : null
      const result = cue ? analysis.get(activeIndex) : { items: [], pending: false, translation: '' }
      overlay.subtitleView.render({ cue, items: result.items, translation: cue ? translationFor(activeIndex) : '', sourceLang: sourceLang(), settings })
      overlay.vocabPanel.render({ items: result.items, pending: result.pending, settings, savedLemmas: sync.savedLemmas(), visible: Boolean(cue) })
    }

    const onTimeUpdate = () => {
      if (!ready()) return
      const time = video.currentTime
      const index = activeAt(time)
      const nearest = LEATCH.cues.findCueIndex(cues, time)
      analysis.ensure(Math.max(0, nearest))
      if (index === activeIndex) return
      activeIndex = index
      render()
      if (index >= 0 && settings.vocab.autoSpeak && !video.paused) {
        const [first] = analysis.get(index).items
        if (first) speak(ui.speechText(first))
      }
    }

    const renderLoop = () => {
      onTimeUpdate()
      renderFrame = video.paused ? 0 : requestAnimationFrame(renderLoop)
    }

    const onPlay = () => {
      overlay?.setPaused(false)
      if (!renderFrame) renderFrame = requestAnimationFrame(renderLoop)
    }

    const onPause = () => {
      overlay?.setPaused(true)
      sync.syncProgress()
    }

    // ---------- study card ----------
    const cancelAutoResume = () => {
      clearInterval(autoResumeTimer)
      autoResumeTimer = null
      overlay?.studyCard.setCountdown(null)
    }

    const startAutoResume = (seconds) => {
      cancelAutoResume()
      let remaining = seconds
      overlay.studyCard.setCountdown(remaining)
      autoResumeTimer = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          cancelAutoResume()
          video.play()
        } else {
          overlay.studyCard.setCountdown(remaining)
        }
      }, 1000)
    }

    const showCard = ({ reason, fromIndex, toIndex }) => {
      if (!ready() || !cues[toIndex]) return
      cardState = { reason, fromIndex, toIndex }
      const from = Math.max(fromIndex, toIndex - (MAX_CARD_SENTENCES - 1))
      const entries = []
      for (let index = from; index <= toIndex; index++) {
        analysis.ensure(index)
        entries.push({ index, cue: cues[index], items: analysis.get(index).items, translation: translationFor(index) })
      }
      overlay.studyCard.show({
        entries,
        time: video.currentTime,
        totalCues: cues.length,
        sourceLang: sourceLang(),
        savedLemmas: sync.savedLemmas(),
        lessonSaved: sync.isSaved(),
        reason,
      })
      if (reason === 'auto' && settings.study.autoResumeSeconds > 0) startAutoResume(settings.study.autoResumeSeconds)
      if (settings.study.speakOnPause) speak(cues[toIndex].text)
    }

    const refreshCard = () => {
      if (cardState && overlay?.studyCard.isOpen()) showCard(cardState)
    }

    const hideCard = () => {
      cancelAutoResume()
      cardState = null
      overlay?.studyCard.close()
    }

    const goToSentence = (index) => {
      if (!cues[index]) return
      video.currentTime = cues[index].start + 0.01
      if (video.paused) showCard({ reason: 'manual', fromIndex: index, toIndex: index })
    }

    const currentIndex = () => cardState?.toIndex ?? Math.max(0, LEATCH.cues.findCueIndex(cues, video.currentTime))

    // ---------- account actions ----------
    const findCueForLemma = (lemma) => {
      const candidates = cardState ? [cardState.toIndex, cardState.fromIndex] : []
      candidates.push(activeIndex, currentIndex())
      if (cardState) for (let i = cardState.fromIndex; i <= cardState.toIndex; i++) candidates.push(i)
      const hasLemma = (index) => index >= 0 && Boolean(analysis?.get(index, 2).items.some((item) => item.lemma === lemma))
      return candidates.find(hasLemma) ?? currentIndex()
    }

    const saveWord = async (item) => {
      const result = await sync.saveWord(item, findCueForLemma(item.lemma))
      if (result.ok) toast(`Saved “${item.lemma}” to your words`, 'success')
      else toast(result.error, 'error')
    }

    const saveLesson = async () => {
      if (!ready()) return toast('Subtitles are not loaded yet', 'error')
      const result = await sync.saveLesson()
      toast(result.ok ? 'Lesson saved to your library ✓' : result.error, result.ok ? 'success' : 'error')
      refreshCard()
    }

    const saveNote = async (text) => {
      const index = currentIndex()
      const result = await sync.addNote(text, video.currentTime, cues[index]?.text || '')
      if (!result.ok) toast(result.error, 'error')
      return result.ok
    }

    const updateSettings = async (partial) => LEATCH.settings.save(partial)

    // ---------- overlay ----------
    const handlers = {
      cardOptions: () => ({ onSpeak: speak, onSave: saveWord }),
      subtitles: {
        onWordClick: (item) => {
          speak(ui.speechText(item))
          overlay.vocabPanel.pulse(item.lemma)
        },
        onSpeakLine: speak,
      },
      study: {
        onContinue: () => video.play(),
        onReplay: () => {
          const { fromIndex, toIndex } = cardState || { fromIndex: currentIndex(), toIndex: currentIndex() }
          hideCard()
          study.replay(fromIndex, toIndex)
        },
        onPrev: () => goToSentence(currentIndex() - 1),
        onNext: () => goToSentence(currentIndex() + 1),
        onSaveLesson: saveLesson,
        onSaveNote: saveNote,
        onSpeak: speak,
        onInteract: cancelAutoResume,
      },
      toolbar: {
        onToggleSubtitles: () => updateSettings({ subtitles: { show: !settings.subtitles.show } }),
        onToggleVocab: () => updateSettings({ vocab: { show: !settings.vocab.show } }),
        onAutoPauseChange: (study) => updateSettings({ study }),
        onTrackChange: (vssId) => {
          preferredVssId = vssId
          load()
        },
        onSaveLesson: saveLesson,
        onOpenLibrary: () => runtime.call('OPEN_PAGE', { page: 'library' }),
        onOpenSettings: () => runtime.call('OPEN_PAGE', { page: 'options' }),
      },
    }

    overlay = await ui.createOverlay({ player, handlers })
    overlay.applySettings(settings)
    overlay.setPaused(video.paused)

    sync = LEATCH.lessonSync.create({
      getContext: () => ({
        videoId,
        video,
        cues,
        analysis,
        translationFor,
        playerData: captions?.playerData || {},
        source: captions?.source || {},
        sourceLang: sourceLang(),
        targetLang: captions?.targetLang || settings.nativeLang,
      }),
      onChange: () => {
        overlay.toolbar.update({ settings, saved: sync.isSaved() })
        overlay.vocabPanel.invalidate()
        render()
      },
    })

    study = LEATCH.studyController.create({
      video,
      player,
      getCues: () => cues,
      getSettings: () => settings,
      onStop: showCard,
      onResume: hideCard,
    })

    // ---------- loading ----------
    const onAnalysisUpdate = (event) => {
      if (event.type === 'error' && event.status === 429) toast('Daily AI limit reached — using the offline dictionary', 'error')
      else if (event.type === 'error' && event.status === 0) toast('LEATCH server unreachable — using the offline dictionary', 'error')
      setStatus(describeEngine())
      overlay.vocabPanel.invalidate()
      render()
      refreshCard()
    }

    const checkAiAvailable = async () => {
      const auth = (await runtime.call('AUTH_STATUS')).data
      if (!auth?.token || settings.analysisEngine === 'local' || settings.analysisEngine === 'off') return false
      const aiStatus = await runtime.api('GET', '/api/ai/status')
      return Boolean(aiStatus.ok && aiStatus.data.enabled)
    }

    const statusForFailure = (result) => {
      if (result.status === 'no-captions') return { level: 'warn', text: 'This video has no subtitles' }
      if (result.status === 'empty') return { level: 'error', text: "Couldn't download subtitles", title: 'Try turning YouTube captions (CC) on once, then reload.' }
      return { level: 'error', text: "Couldn't read this video", title: 'Reload the page and try again.' }
    }

    async function load() {
      const token = ++loadToken
      hideCard()
      study.stop()
      captions = null
      cues = []
      analysis = null
      activeIndex = -1
      render()

      if (!settings.enabled) return setStatus({ level: 'warn', text: 'LEATCH is turned off' })
      setStatus({ level: 'loading', text: 'Loading subtitles…' })

      const aiAvailable = await checkAiAvailable()
      const wantsAiTranslation = settings.translationSource === 'ai'
      const loaderSettings = wantsAiTranslation && !aiAvailable ? { ...settings, translationSource: 'youtube' } : settings
      if (wantsAiTranslation && !aiAvailable) toast('AI translation needs login + AI on the server — using YouTube translation', 'error')

      const result = await LEATCH.captionLoader.load({ videoId, settings: loaderSettings, preferredVssId }).catch((err) => ({ status: 'error', error: err }))
      if (destroyed || token !== loadToken) return

      captions = result
      overlay.toolbar.update({ settings, tracks: result.tracks || [], currentVssId: result.source?.vssId })
      if (result.status !== 'ok') return setStatus(statusForFailure(result))

      cues = result.cues
      analysis = LEATCH.analysisManager.create({
        cues,
        videoId,
        sourceLang: result.sourceLang,
        meaningLang: result.targetLang,
        settings: loaderSettings,
        aiAvailable,
        onUpdate: onAnalysisUpdate,
      })

      await sync.init()
      if (destroyed || token !== loadToken) return

      setStatus(describeEngine())
      study.start()
      onTimeUpdate()
      render()
      if (!video.paused) onPlay()
    }

    // ---------- keyboard shortcuts ----------
    const SHORTCUTS = {
      KeyA: () => goToSentence(currentIndex() - 1),
      KeyD: () => goToSentence(currentIndex() + 1),
      KeyS: () => {
        const index = currentIndex()
        hideCard()
        study.replay(index, index)
      },
      KeyQ: () => {
        const position = AUTO_PAUSE_CYCLE.findIndex((preset) => Object.entries(preset).every(([key, value]) => settings.study[key] === value))
        const next = AUTO_PAUSE_CYCLE[(position + 1) % AUTO_PAUSE_CYCLE.length]
        updateSettings({ study: next })
        toast(next.autoPause === 'off' ? 'Auto-pause off' : next.autoPause === 'sentence' ? `Pause every ${next.everyNSentences} sentence(s)` : `Pause every ${next.intervalSeconds} s`)
      },
      KeyV: () => handlers.toolbar.onToggleVocab(),
      KeyH: () => handlers.toolbar.onToggleSubtitles(),
      KeyX: () => updateSettings({ subtitles: { showTranslation: !settings.subtitles.showTranslation } }),
    }

    const onKeyDown = (event) => {
      if (!settings.shortcuts || !ready() || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const target = event.composedPath()[0]
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return
      const action = SHORTCUTS[event.code]
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      action()
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    document.addEventListener('keydown', onKeyDown, true)
    const progressTimer = setInterval(() => {
      if (!video.paused) sync.syncProgress()
    }, PROGRESS_SYNC_MS)

    load()

    return {
      videoId,
      reload: load,
      /** Applies new settings; reloads subtitles when language/engine options changed. */
      updateSettings: (next) => {
        const previous = settings
        settings = next
        overlay.applySettings(next)
        overlay.toolbar.update({ settings: next })
        overlay.vocabPanel.invalidate()
        const needsReload = RELOAD_KEYS.some((path) => LEATCH.settings.getPath(previous, path) !== LEATCH.settings.getPath(next, path))
        if (needsReload) load()
        else {
          if (!settings.study.showCardOnPause && cardState?.reason === 'manual') hideCard()
          render()
          refreshCard()
        }
      },
      destroy: () => {
        destroyed = true
        sync.syncProgress()
        clearInterval(progressTimer)
        cancelAnimationFrame(renderFrame)
        cancelAutoResume()
        study.destroy()
        video.removeEventListener('timeupdate', onTimeUpdate)
        video.removeEventListener('play', onPlay)
        video.removeEventListener('pause', onPause)
        document.removeEventListener('keydown', onKeyDown, true)
        LEATCH.tts.stop()
        overlay.destroy()
      },
    }
  }

  LEATCH.session = { create }
})()
