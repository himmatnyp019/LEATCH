/* Popup: account + the most-used settings. */
;(async () => {
  const { forms, account, settings: settingsStore, dom } = globalThis.LEATCH

  await account.mount(document.getElementById('account'), {
    intro: 'Log in to save lessons, words and notes — and to get AI-picked vocabulary.',
  })

  const autoPause = document.getElementById('auto-pause')
  const swap = document.getElementById('swap')
  swap.append(dom.icon('swap', { size: 16 }))
  const autoPauseValue = (study) =>
    study.autoPause === 'sentence' ? `sentence:${study.everyNSentences}` : study.autoPause === 'interval' ? `interval:${study.intervalSeconds}` : 'off'

  await forms.bindSettings(document.body, {
    onChange: (settings) => {
      swap.disabled = !globalThis.LEATCH.languages.isStudyLanguage(settings.nativeLang)
      const value = autoPauseValue(settings.study)
      if (![...autoPause.options].some((option) => option.value === value)) autoPause.append(dom.h('option', { value }, value.replace(':', ' every ')))
      autoPause.value = value
    },
  })

  autoPause.addEventListener('change', () => {
    const [mode, amount] = autoPause.value.split(':')
    const study =
      mode === 'sentence'
        ? { autoPause: 'sentence', everyNSentences: Number(amount) }
        : mode === 'interval'
          ? { autoPause: 'interval', intervalSeconds: Number(amount) }
          : { autoPause: 'off' }
    settingsStore.save({ study })
  })

  swap.addEventListener('click', async () => {
    const current = await settingsStore.load()
    const { isStudyLanguage } = globalThis.LEATCH.languages
    if (!isStudyLanguage(current.nativeLang)) return
    settingsStore.save({ learningLang: current.nativeLang, nativeLang: current.learningLang })
  })

  document.getElementById('open-library').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('library/library.html') }))
  document.getElementById('open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage())
})()
