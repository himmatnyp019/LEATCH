/** Dual subtitle lines (original with highlighted vocab + translation). */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { h, clear, highlight, iconButton } = LEATCH.dom

  /**
   * @param {{ onWordClick: Function, onSpeakLine: Function }} handlers
   */
  const createSubtitleView = ({ onWordClick, onSpeakLine }) => {
    const original = h('div', { class: 'lt-line lt-original', lang: '' })
    const translation = h('div', { class: 'lt-line lt-translation' })
    const element = h('div', { class: 'lt-subs lt-empty' }, original, translation)
    let lastKey = ''

    /**
     * @param {{ cue: object|null, items: Array, translation: string, sourceLang: string, settings: object }} state
     */
    const render = ({ cue, items, translation: translatedText, sourceLang, settings }) => {
      const subs = settings.subtitles
      element.dataset.position = subs.position
      element.classList.toggle('lt-hidden', !subs.show)
      if (!cue) {
        element.classList.add('lt-empty')
        lastKey = ''
        return
      }
      element.classList.remove('lt-empty')

      const key = `${cue.start}|${cue.text}|${translatedText}|${items.map((item) => item.surface).join(',')}|${subs.highlightVocab}`
      if (key === lastKey) return
      lastKey = key

      clear(original)
      original.lang = sourceLang
      original.append(
        h('span', { class: 'lt-text' }, highlight(cue.text, subs.highlightVocab ? items : [], onWordClick)),
        iconButton('speaker', 'Listen to this sentence', () => onSpeakLine(cue.text), { cls: 'lt-line-speak', size: 15 }),
      )
      translation.textContent = translatedText || ''
      original.classList.toggle('lt-hidden', !subs.showOriginal)
      translation.classList.toggle('lt-hidden', !subs.showTranslation || !translatedText)
    }

    return { element, render }
  }

  LEATCH.ui = { ...LEATCH.ui, createSubtitleView }
})()
