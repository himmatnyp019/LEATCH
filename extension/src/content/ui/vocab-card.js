/** Renders one vocabulary / grammar card (used by the live panel and the study card). */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { h, iconButton } = LEATCH.dom

  /** What to pronounce for an item: the dictionary form for words, the heard form for grammar. */
  const speechText = (item) =>
    item.type === 'grammar' ? item.surface || item.lemma.replace(/[-()/~…]|\(으\)|\.\.\./g, ' ').trim() : item.lemma

  /**
   * @param {object} item - analysis item
   * @param {object} options
   * @param {boolean} options.showExamples
   * @param {boolean} options.saved
   * @param {(text: string) => void} options.onSpeak - speaks in the study language
   * @param {(item: object) => void} options.onSave
   * @returns {HTMLElement}
   */
  const createCard = (item, { showExamples, saved, onSpeak, onSave }) => {
    const saveButton = iconButton('star', saved ? 'Saved to your words' : 'Save word', () => onSave(item), {
      cls: saved ? 'is-saved' : '',
      filled: saved,
      size: 16,
    })

    return h(
      'div',
      { class: 'lt-card', dataset: { type: item.type, lemma: item.lemma } },
      h(
        'div',
        { class: 'lt-card-head' },
        h('span', { class: 'lt-badge' }, item.type === 'grammar' ? 'Grammar' : 'Vocab'),
        h('span', { class: 'lt-card-actions' }, iconButton('speaker', 'Listen', () => onSpeak(speechText(item)), { size: 16 }), saveButton),
      ),
      h('div', { class: 'lt-term' }, item.lemma),
      item.reading || (item.surface && item.surface !== item.lemma)
        ? h(
            'div',
            { class: 'lt-reading' },
            item.reading || '',
            item.surface && item.surface !== item.lemma ? h('span', { class: 'lt-surface' }, `“${item.surface}”`) : null,
          )
        : null,
      h('div', { class: 'lt-meaning' }, item.meaning || '—'),
      showExamples && item.examples?.length
        ? h(
            'ol',
            { class: 'lt-examples' },
            item.examples.slice(0, 2).map((example) =>
              h(
                'li',
                {},
                h('div', { class: 'lt-ex-text' }, h('span', {}, example.text), iconButton('speaker', 'Listen to example', () => onSpeak(example.text), { cls: 'lt-sm', size: 13 })),
                example.translation ? h('div', { class: 'lt-ex-tr' }, example.translation) : null,
              ),
            ),
          )
        : null,
    )
  }

  LEATCH.ui = { ...LEATCH.ui, createCard, speechText }
})()
