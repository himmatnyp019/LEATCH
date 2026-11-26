/**
 * Language registry shared by every extension context (content scripts, pages, worker).
 * Classic script: attaches `LEATCH.languages` to the global object.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})

  /** Languages offered for translation / meanings. `tts` is the speech-synthesis locale. */
  const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English', tts: 'en-US' },
    { code: 'ko', name: 'Korean', native: '한국어', tts: 'ko-KR' },
    { code: 'ja', name: 'Japanese', native: '日本語', tts: 'ja-JP' },
    { code: 'zh-Hans', name: 'Chinese (Simplified)', native: '简体中文', tts: 'zh-CN' },
    { code: 'zh-Hant', name: 'Chinese (Traditional)', native: '繁體中文', tts: 'zh-TW' },
    { code: 'es', name: 'Spanish', native: 'Español', tts: 'es-ES' },
    { code: 'fr', name: 'French', native: 'Français', tts: 'fr-FR' },
    { code: 'de', name: 'German', native: 'Deutsch', tts: 'de-DE' },
    { code: 'pt', name: 'Portuguese', native: 'Português', tts: 'pt-BR' },
    { code: 'it', name: 'Italian', native: 'Italiano', tts: 'it-IT' },
    { code: 'ru', name: 'Russian', native: 'Русский', tts: 'ru-RU' },
    { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', tts: 'vi-VN' },
    { code: 'th', name: 'Thai', native: 'ไทย', tts: 'th-TH' },
    { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', tts: 'id-ID' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी', tts: 'hi-IN' },
    { code: 'ne', name: 'Nepali', native: 'नेपाली', tts: 'ne-NP' },
    { code: 'ar', name: 'Arabic', native: 'العربية', tts: 'ar-SA' },
    { code: 'tr', name: 'Turkish', native: 'Türkçe', tts: 'tr-TR' },
  ]

  /** Languages we can extract vocabulary/grammar from (the language being studied). */
  const STUDY_LANGUAGES = ['ko', 'en']

  /** `en-US` → `en`, `zh-Hans` → `zh`. */
  const baseCode = (code) => String(code || '').split('-')[0].toLowerCase()

  const sameLanguage = (a, b) => Boolean(a && b) && baseCode(a) === baseCode(b)

  const getLanguage = (code) =>
    LANGUAGES.find((lang) => lang.code === code) ||
    LANGUAGES.find((lang) => sameLanguage(lang.code, code)) || { code, name: code, native: code, tts: code }

  const isStudyLanguage = (code) => STUDY_LANGUAGES.includes(baseCode(code))

  LEATCH.languages = { LANGUAGES, STUDY_LANGUAGES, baseCode, sameLanguage, getLanguage, isStudyLanguage }
})()
