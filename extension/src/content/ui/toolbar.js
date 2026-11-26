/** Small control bar in the top-left corner of the player (appears on hover / when paused). */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { h, clear, iconButton } = LEATCH.dom

  const AUTO_PAUSE_PRESETS = [
    ['off', 'Auto-pause: off'],
    ['sentence:1', 'Pause after every sentence'],
    ['sentence:2', 'Pause every 2 sentences'],
    ['sentence:3', 'Pause every 3 sentences'],
    ['interval:15', 'Pause every 15 s'],
    ['interval:30', 'Pause every 30 s'],
    ['interval:60', 'Pause every 60 s'],
  ]

  const autoPauseValue = (study) => {
    if (study.autoPause === 'sentence') return `sentence:${study.everyNSentences}`
    if (study.autoPause === 'interval') return `interval:${study.intervalSeconds}`
    return 'off'
  }

  const describeAutoPause = (value) => {
    const [mode, amount] = value.split(':')
    if (mode === 'sentence') return `Pause every ${amount} sentences`
    if (mode === 'interval') return `Pause every ${amount} s`
    return 'Auto-pause: off'
  }

  /**
   * @param {object} handlers
   * @param {() => void} handlers.onToggleSubtitles
   * @param {() => void} handlers.onToggleVocab
   * @param {(study: object) => void} handlers.onAutoPauseChange
   * @param {(vssId: string) => void} handlers.onTrackChange
   * @param {() => void} handlers.onSaveLesson
   * @param {() => void} handlers.onOpenLibrary
   * @param {() => void} handlers.onOpenSettings
   */
  const createToolbar = (handlers) => {
    const dot = h('span', { class: 'lt-dot' })
    const statusText = h('span', { class: 'lt-status-text' }, 'Loading…')
    const subsButton = iconButton('captions', 'Show / hide subtitles (H)', () => handlers.onToggleSubtitles())
    const vocabButton = iconButton('book', 'Show / hide vocabulary (V)', () => handlers.onToggleVocab())
    const saveButton = iconButton('bookmark', 'Save this lesson to your library', () => handlers.onSaveLesson())
    const autoPause = h('select', { class: 'lt-select', title: 'Study auto-pause (Q)' })
    const track = h('select', { class: 'lt-select lt-track', title: 'Subtitle track' })

    autoPause.addEventListener('change', () => {
      const [mode, amount] = autoPause.value.split(':')
      handlers.onAutoPauseChange(
        mode === 'sentence'
          ? { autoPause: 'sentence', everyNSentences: Number(amount) }
          : mode === 'interval'
            ? { autoPause: 'interval', intervalSeconds: Number(amount) }
            : { autoPause: 'off' },
      )
    })
    track.addEventListener('change', () => handlers.onTrackChange(track.value))

    const element = h(
      'div',
      { class: 'lt-toolbar' },
      h('span', { class: 'lt-brand' }, dot, 'LEATCH'),
      statusText,
      subsButton,
      vocabButton,
      autoPause,
      track,
      saveButton,
      iconButton('library', 'Open my library', () => handlers.onOpenLibrary()),
      iconButton('sliders', 'Settings', () => handlers.onOpenSettings()),
    )

    /**
     * @param {object} state
     * @param {object} state.settings
     * @param {{ level: 'loading'|'ok'|'local'|'warn'|'error', text: string, title?: string }} [state.status]
     * @param {Array} [state.tracks]
     * @param {string} [state.currentVssId]
     * @param {boolean} [state.saved]
     */
    const update = ({ settings, status, tracks, currentVssId, saved }) => {
      if (status) {
        dot.dataset.level = status.level
        statusText.textContent = status.text
        statusText.title = status.title || status.text
      }
      subsButton.classList.toggle('is-off', !settings.subtitles.show)
      vocabButton.classList.toggle('is-off', !settings.vocab.show)

      const value = autoPauseValue(settings.study)
      const presets = AUTO_PAUSE_PRESETS.some(([preset]) => preset === value) ? AUTO_PAUSE_PRESETS : [...AUTO_PAUSE_PRESETS, [value, describeAutoPause(value)]]
      clear(autoPause)
      presets.forEach(([optionValue, label]) => autoPause.append(h('option', { value: optionValue, selected: optionValue === value }, label)))
      autoPause.classList.toggle('is-active', value !== 'off')

      if (tracks) {
        clear(track)
        tracks.forEach((item) => track.append(h('option', { value: item.vssId, selected: item.vssId === currentVssId }, LEATCH.captionLoader.trackLabel(item))))
        track.classList.toggle('lt-hidden', tracks.length < 2)
      }
      if (saved !== undefined) {
        saveButton.classList.toggle('is-saved', saved)
        saveButton.title = saved ? 'Saved in your library (click to update)' : 'Save this lesson to your library'
        const svg = saveButton.querySelector('svg')
        svg?.setAttribute('fill', saved ? 'currentColor' : 'none')
      }
    }

    return { element, update }
  }

  LEATCH.ui = { ...LEATCH.ui, createToolbar }
})()
