/** Pronunciation via the browser's built-in speech synthesis (free, no server needed). */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  let voices = []

  const refreshVoices = () => {
    voices = window.speechSynthesis?.getVoices?.() || []
  }
  if ('speechSynthesis' in window) {
    refreshVoices()
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices)
  }

  const localeFor = (lang) => LEATCH.languages.getLanguage(lang).tts

  /** Best voice for a language: the user's chosen voice, then Google/natural voices, then any match. */
  const pickVoice = (lang, preferredName) => {
    const base = LEATCH.languages.baseCode(lang)
    const candidates = voices.filter((voice) => LEATCH.languages.baseCode(voice.lang) === base)
    return (
      candidates.find((voice) => voice.name === preferredName) ||
      candidates.find((voice) => /google|natural|neural/i.test(voice.name)) ||
      candidates[0] ||
      null
    )
  }

  /**
   * Speaks text in the given language. Returns false when speech synthesis is unavailable.
   *
   * @param {string} text
   * @param {string} lang - e.g. 'ko'
   * @param {{ rate?: number, voiceName?: string }} [options]
   */
  const speak = (text, lang, { rate = 0.9, voiceName = '' } = {}) => {
    if (!text || !('speechSynthesis' in window)) return false
    if (!voices.length) refreshVoices()
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = localeFor(lang)
    utterance.rate = rate
    const voice = pickVoice(lang, voiceName)
    if (voice) utterance.voice = voice
    window.speechSynthesis.speak(utterance)
    return true
  }

  const stop = () => window.speechSynthesis?.cancel()

  LEATCH.tts = { speak, stop, pickVoice }
})()
