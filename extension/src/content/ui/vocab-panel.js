/** Floating panel showing the 1–2 key items of the sentence being spoken right now. */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { h, clear } = LEATCH.dom
  const STALE_HIDE_MS = 6000

  /**
   * @param {{ cardOptions: () => object }} deps - returns options for LEATCH.ui.createCard
   */
  const createVocabPanel = ({ cardOptions }) => {
    const status = h('div', { class: 'lt-vocab-status lt-hidden' })
    const cards = h('div', { class: 'lt-vocab-cards' })
    const element = h('div', { class: 'lt-vocab lt-hidden' }, status, cards)
    let lastKey = ''
    let staleTimer = null

    const setStale = (stale) => {
      element.classList.toggle('lt-stale', stale)
      clearTimeout(staleTimer)
      if (stale) staleTimer = setTimeout(() => element.classList.add('lt-hidden'), STALE_HIDE_MS)
    }

    /**
     * @param {{ items: Array, pending: boolean, settings: object, savedLemmas: Set<string>, visible: boolean }} state
     */
    const render = ({ items, pending, settings, savedLemmas, visible }) => {
      element.dataset.position = settings.vocab.position
      if (!visible || !settings.vocab.show) {
        element.classList.add('lt-hidden')
        lastKey = ''
        return
      }

      status.classList.toggle('lt-hidden', !pending || items.length > 0)
      status.textContent = pending ? 'Finding key words…' : ''

      if (!items.length) {
        if (pending) element.classList.remove('lt-hidden')
        else if (lastKey) setStale(true)
        return
      }

      const key = items.map((item) => `${item.lemma}:${savedLemmas.has(item.lemma)}`).join('|') + settings.vocab.showExamples
      element.classList.remove('lt-hidden')
      setStale(false)
      if (key === lastKey) return
      lastKey = key

      const options = cardOptions()
      clear(cards)
      items.forEach((item) => cards.append(LEATCH.ui.createCard(item, { ...options, saved: savedLemmas.has(item.lemma), showExamples: settings.vocab.showExamples })))
    }

    /** Briefly highlights the card for `lemma` (after clicking a word in the subtitle). */
    const pulse = (lemma) => {
      const card = [...cards.children].find((child) => child.dataset.lemma === lemma)
      if (!card) return
      card.classList.remove('lt-pulse')
      void card.offsetWidth
      card.classList.add('lt-pulse')
    }

    const invalidate = () => {
      lastKey = ''
    }

    return { element, render, pulse, invalidate }
  }

  LEATCH.ui = { ...LEATCH.ui, createVocabPanel }
})()
