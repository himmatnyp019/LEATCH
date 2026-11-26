/**
 * Binds form controls to settings declaratively:
 *   <input data-setting="subtitles.originalFontSize" type="range">
 *   <select data-setting="nativeLang" data-options="languages" data-empty="Same as native" data-label="short">
 *   <div data-show-when="study.autoPause=sentence|interval">…</div>
 *   <output data-for="subtitles.originalFontSize" data-suffix="px">
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { h } = LEATCH.dom
  const SAVE_DEBOUNCE_MS = 250

  const languageOptions = (kind) => {
    const { LANGUAGES, STUDY_LANGUAGES } = LEATCH.languages
    return kind === 'study' ? LANGUAGES.filter((lang) => STUDY_LANGUAGES.includes(lang.code)) : LANGUAGES
  }

  const isNumeric = (element) => element.type === 'number' || element.type === 'range' || element.dataset.type === 'number'

  const readValue = (element) => {
    if (element.type === 'checkbox') return element.checked
    if (!isNumeric(element)) return element.value
    const value = Number(element.value)
    const min = element.min === '' ? -Infinity : Number(element.min)
    const max = element.max === '' ? Infinity : Number(element.max)
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null
  }

  const writeValue = (element, value) => {
    if (element.type === 'checkbox') element.checked = Boolean(value)
    else element.value = value ?? ''
  }

  const formatOutput = (value, output) => {
    const scale = Number(output.dataset.scale || 1)
    const shown = typeof value === 'number' ? Math.round(value * scale * 100) / 100 : value
    return `${shown}${output.dataset.suffix || ''}`
  }

  /**
   * Wires every `[data-setting]` control inside `root` to chrome.storage settings.
   *
   * @param {HTMLElement} root
   * @param {{ onChange?: (settings: object) => void }} [options]
   * @returns {Promise<{ get: () => object }>}
   */
  const bindSettings = async (root, { onChange } = {}) => {
    root.querySelectorAll('select[data-options]').forEach((select) => {
      if (select.dataset.empty) select.append(h('option', { value: '' }, select.dataset.empty))
      const label = (lang) => (select.dataset.label === 'short' || lang.name === lang.native ? lang.name : `${lang.name} · ${lang.native}`)
      languageOptions(select.dataset.options).forEach((lang) => select.append(h('option', { value: lang.code }, label(lang))))
    })

    let settings = await LEATCH.settings.load()
    const fields = [...root.querySelectorAll('[data-setting]')]
    const timers = new Map()

    const render = (next) => {
      settings = next
      fields.forEach((element) => {
        if (element === document.activeElement && element.type !== 'checkbox' && element.type !== 'range') return
        writeValue(element, LEATCH.settings.getPath(next, element.dataset.setting))
      })
      root.querySelectorAll('output[data-for]').forEach((output) => {
        output.textContent = formatOutput(LEATCH.settings.getPath(next, output.dataset.for), output)
      })
      root.querySelectorAll('[data-show-when]').forEach((element) => {
        const [path, expected] = element.dataset.showWhen.split('=')
        element.classList.toggle('hidden', !expected.split('|').includes(String(LEATCH.settings.getPath(next, path))))
      })
      onChange?.(next)
    }

    fields.forEach((element) => {
      const live = element.type === 'range' || element.type === 'color'
      element.addEventListener(live ? 'input' : 'change', () => {
        const value = readValue(element)
        if (value === null) return
        const path = element.dataset.setting
        clearTimeout(timers.get(path))
        timers.set(path, setTimeout(async () => render(await LEATCH.settings.save(LEATCH.settings.setPath({}, path, value))), live ? SAVE_DEBOUNCE_MS : 0))
        const output = root.querySelector(`output[data-for="${path}"]`)
        if (output) output.textContent = formatOutput(value, output)
      })
    })

    LEATCH.settings.onChange(render)
    render(settings)
    return { get: () => settings }
  }

  LEATCH.forms = { bindSettings }
})()
