/**
 * User settings with defaults, stored in chrome.storage.sync (synced across the user's browsers).
 * Classic script: attaches `LEATCH.settings`.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const STORAGE_KEY = 'settings'

  const DEFAULTS = Object.freeze({
    enabled: true,
    learningLang: 'ko',
    nativeLang: 'en',
    /** Subtitle translation target; empty = native language. */
    translationLang: '',
    /** 'youtube' = free YouTube auto-translate, 'ai' = translate with the LEATCH server (uses AI tokens). */
    translationSource: 'youtube',
    /** 'auto' = AI when logged in & available, else offline dictionary; 'ai' | 'local' | 'off'. */
    analysisEngine: 'auto',
    serverUrl: 'http://localhost:4000',
    subtitles: {
      show: true,
      showOriginal: true,
      showTranslation: true,
      hideNativeCaptions: true,
      mergeSentences: true,
      highlightVocab: true,
      position: 'bottom',
      offsetPercent: 9,
      originalFontSize: 30,
      translationFontSize: 22,
      originalColor: '#ffffff',
      translationColor: '#ffd666',
      fontFamily: 'default',
      fontWeight: 600,
      backgroundColor: '#000000',
      backgroundOpacity: 0.6,
    },
    vocab: {
      show: true,
      maxPerSentence: 2,
      position: 'top-right',
      showExamples: true,
      panelScale: 1,
      opacity: 0.9,
      autoSpeak: false,
    },
    study: {
      showCardOnPause: true,
      /** 'off' | 'sentence' | 'interval' */
      autoPause: 'off',
      everyNSentences: 1,
      intervalSeconds: 30,
      /** 0 = wait for the user to press play. */
      autoResumeSeconds: 0,
      speakOnPause: false,
    },
    tts: { rate: 0.9, voiceName: '' },
    shortcuts: true,
    autoSaveProgress: true,
  })

  const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

  /** Recursively merges `override` onto `base` (arrays and primitives replace). */
  const deepMerge = (base, override) => {
    const output = { ...base }
    for (const [key, value] of Object.entries(override || {})) {
      output[key] = isPlainObject(value) && isPlainObject(base?.[key]) ? deepMerge(base[key], value) : value
    }
    return output
  }

  const getPath = (object, path) => path.split('.').reduce((node, key) => node?.[key], object)

  /** Returns a copy of `object` with `path` (dot notation) set to `value`. */
  const setPath = (object, path, value) => {
    const keys = path.split('.')
    const output = structuredClone(object)
    let node = output
    keys.slice(0, -1).forEach((key) => {
      node[key] = isPlainObject(node[key]) ? node[key] : {}
      node = node[key]
    })
    node[keys.at(-1)] = value
    return output
  }

  const load = async () => {
    const stored = await chrome.storage.sync.get(STORAGE_KEY)
    return deepMerge(DEFAULTS, stored[STORAGE_KEY])
  }

  const save = async (partial) => {
    const next = deepMerge(await load(), partial)
    await chrome.storage.sync.set({ [STORAGE_KEY]: next })
    return next
  }

  const reset = async () => {
    await chrome.storage.sync.remove(STORAGE_KEY)
    return deepMerge(DEFAULTS, {})
  }

  /** Subscribes to settings changes from any context. Returns an unsubscribe function. */
  const onChange = (callback) => {
    const listener = (changes, area) => {
      if (area === 'sync' && changes[STORAGE_KEY]) callback(deepMerge(DEFAULTS, changes[STORAGE_KEY].newValue))
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }

  /** The language subtitles are translated into. */
  const translationTarget = (settings) => settings.translationLang || settings.nativeLang

  LEATCH.settings = { DEFAULTS, STORAGE_KEY, load, save, reset, onChange, deepMerge, getPath, setPath, translationTarget }
})()
