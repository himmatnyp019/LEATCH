/**
 * The study pause card: shown when the video pauses (manually or by auto-pause).
 * Shows the sentence(s) in both languages, the key vocab/grammar with examples, and a note box.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { h, clear, highlight, iconButton, icon } = LEATCH.dom
  const MAX_CARDS = 6

  const button = (label, iconName, onClick, cls = '') =>
    h('button', { class: `lt-btn ${cls}`.trim(), type: 'button', onClick }, icon(iconName, { size: 16 }), h('span', {}, label))

  /**
   * @param {object} handlers
   * @param {() => object} handlers.cardOptions
   * @param {() => void} handlers.onContinue
   * @param {() => void} handlers.onReplay
   * @param {() => void} handlers.onPrev
   * @param {() => void} handlers.onNext
   * @param {() => void} handlers.onSaveLesson
   * @param {(text: string) => Promise<boolean>} handlers.onSaveNote
   * @param {(text: string) => void} handlers.onSpeak
   * @param {() => void} handlers.onInteract - user touched the card (cancels auto-resume)
   */
  const createStudyCard = (handlers) => {
    const meta = h('div', { class: 'lt-study-meta' })
    const countdown = h('button', { class: 'lt-chip lt-hidden', type: 'button', title: 'Stay paused' })
    const sentences = h('div', { class: 'lt-study-sentences' })
    const vocabTitle = h('div', { class: 'lt-section-title' }, 'Key words & grammar')
    const vocab = h('div', { class: 'lt-study-vocab' })
    const noteInput = h('textarea', { class: 'lt-note-input', rows: 2, placeholder: 'Add a note for this moment… (saved to your library)', maxlength: 2000 })
    const noteStatus = h('span', { class: 'lt-note-status' })
    const saveNoteButton = h('button', { class: 'lt-btn lt-btn-ghost', type: 'button' }, icon('pen', { size: 15 }), h('span', {}, 'Save note'))
    const saveLessonButton = button('Save lesson', 'bookmark', () => handlers.onSaveLesson(), 'lt-btn-ghost')

    const panel = h(
      'div',
      { class: 'lt-study-panel', role: 'dialog', 'aria-label': 'Study pause' },
      h('div', { class: 'lt-study-head' }, meta, countdown, iconButton('close', 'Close (keep paused)', () => close())),
      h('div', { class: 'lt-study-body' }, sentences, vocabTitle, vocab, h('div', { class: 'lt-note' }, noteInput, h('div', { class: 'lt-note-row' }, noteStatus, saveNoteButton))),
      h(
        'div',
        { class: 'lt-study-foot' },
        button('Previous', 'prev', () => handlers.onPrev()),
        button('Replay', 'replay', () => handlers.onReplay()),
        button('Next', 'next', () => handlers.onNext()),
        h('span', { class: 'lt-spacer' }),
        saveLessonButton,
        h('button', { class: 'lt-btn lt-btn-primary', type: 'button', title: 'Continue (Space)', onClick: () => handlers.onContinue() }, icon('play', { size: 16, filled: true }), h('span', {}, 'Continue')),
      ),
    )
    const element = h('div', { class: 'lt-study lt-hidden' }, panel)
    let open = false

    panel.addEventListener('pointerdown', () => handlers.onInteract())
    panel.addEventListener('keydown', () => handlers.onInteract())
    countdown.addEventListener('click', () => handlers.onInteract())

    saveNoteButton.addEventListener('click', async () => {
      const text = noteInput.value.trim()
      if (!text) return
      noteStatus.textContent = 'Saving…'
      const ok = await handlers.onSaveNote(text)
      noteStatus.textContent = ok ? 'Saved ✓' : ''
      if (ok) noteInput.value = ''
    })

    const renderSentence = ({ cue, items, translation }, sourceLang, primary) =>
      h(
        'div',
        { class: `lt-study-sentence ${primary ? 'is-primary' : ''}` },
        h(
          'div',
          { class: 'lt-study-original', lang: sourceLang },
          h('span', {}, highlight(cue.text, items)),
          iconButton('speaker', 'Listen', () => handlers.onSpeak(cue.text), { cls: 'lt-sm', size: 15 }),
        ),
        translation ? h('div', { class: 'lt-study-translation' }, translation) : null,
      )

    /**
     * @param {object} state
     * @param {Array<{ index: number, cue: object, items: Array, translation: string }>} state.entries - oldest → newest
     * @param {number} state.time
     * @param {number} state.totalCues
     * @param {string} state.sourceLang
     * @param {Set<string>} state.savedLemmas
     * @param {boolean} state.lessonSaved
     * @param {'auto'|'manual'} state.reason
     */
    const show = ({ entries, time, totalCues, sourceLang, savedLemmas, lessonSaved, reason }) => {
      const primary = entries.at(-1)
      meta.textContent = `${reason === 'auto' ? 'Study pause' : 'Paused'} · ${LEATCH.player.formatTime(time)} · sentence ${primary.index + 1} of ${totalCues}`

      clear(sentences)
      sentences.append(renderSentence(primary, sourceLang, true))
      if (entries.length > 1) {
        sentences.append(h('div', { class: 'lt-section-title' }, 'Earlier in this part'))
        entries.slice(0, -1).reverse().forEach((entry) => sentences.append(renderSentence(entry, sourceLang, false)))
      }

      const allItems = [...new Map(entries.slice().reverse().flatMap((entry) => entry.items).map((item) => [item.lemma, item])).values()].slice(0, MAX_CARDS)
      clear(vocab)
      vocabTitle.classList.toggle('lt-hidden', !allItems.length)
      const options = handlers.cardOptions()
      allItems.forEach((item) => vocab.append(LEATCH.ui.createCard(item, { ...options, saved: savedLemmas.has(item.lemma), showExamples: true })))

      saveLessonButton.querySelector('span').textContent = lessonSaved ? 'Saved' : 'Save lesson'
      saveLessonButton.classList.toggle('is-saved', lessonSaved)
      noteStatus.textContent = ''
      element.classList.remove('lt-hidden')
      open = true
    }

    const close = () => {
      element.classList.add('lt-hidden')
      setCountdown(null)
      open = false
    }

    /** Shows "Resuming in Ns" (null hides it). */
    const setCountdown = (seconds) => {
      countdown.classList.toggle('lt-hidden', seconds === null)
      if (seconds !== null) countdown.textContent = `Resuming in ${seconds}s · stay`
    }

    return { element, show, close, setCountdown, isOpen: () => open }
  }

  LEATCH.ui = { ...LEATCH.ui, createStudyCard }
})()
