/* Full settings page. */
;(async () => {
  const { forms, account, settings: store, dom, api, tts, languages } = globalThis.LEATCH

  const FONT_STACKS = {
    default: '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif',
    serif: '"Noto Serif KR", "Nanum Myeongjo", Georgia, serif',
    rounded: '"NanumSquareRound", "Arial Rounded MT Bold", sans-serif',
    mono: 'Menlo, Consolas, monospace',
  }
  const VOICE_SAMPLES = { ko: '안녕하세요! 만나서 반가워요.', en: 'Nice to meet you! How are you today?' }

  await account.mount(document.getElementById('account-widget'), {
    intro: 'Sign in with your email and password. New here? Create an account in seconds.',
  })

  // ---------- live preview ----------
  const preview = document.getElementById('preview-subs')
  const [previewOriginal, previewTranslation] = preview.children

  const hexToRgba = (hex, alpha) => {
    const value = /^#?([0-9a-f]{6})$/i.exec(hex || '')?.[1] ?? '000000'
    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const updatePreview = (settings) => {
    const subs = settings.subtitles
    const vars = {
      '--offset': `${subs.offsetPercent}%`,
      '--font': FONT_STACKS[subs.fontFamily] || FONT_STACKS.default,
      '--orig-size': subs.originalFontSize,
      '--tr-size': subs.translationFontSize,
      '--orig-color': subs.originalColor,
      '--tr-color': subs.translationColor,
      '--weight': subs.fontWeight,
      '--bg-color': hexToRgba(subs.backgroundColor, subs.backgroundOpacity),
    }
    Object.entries(vars).forEach(([name, value]) => preview.style.setProperty(name, String(value)))
    preview.classList.toggle('top', subs.position === 'top')
    preview.classList.toggle('hidden', !subs.show)
    previewOriginal.classList.toggle('hidden', !subs.showOriginal)
    previewTranslation.classList.toggle('hidden', !subs.showTranslation)
  }

  // ---------- voices ----------
  const voiceSelect = document.getElementById('voice-select')
  const populateVoices = (settings) => {
    const wanted = new Set([languages.baseCode(settings.learningLang), languages.baseCode(settings.nativeLang)])
    const voices = (window.speechSynthesis?.getVoices() || []).filter((voice) => wanted.has(languages.baseCode(voice.lang)))
    dom.clear(voiceSelect).append(dom.h('option', { value: '' }, 'Automatic (best available)'))
    voices.forEach((voice) => voiceSelect.append(dom.h('option', { value: voice.name }, `${voice.name} · ${voice.lang}`)))
    voiceSelect.value = settings.tts.voiceName
  }

  const binding = await forms.bindSettings(document.body, {
    onChange: (settings) => {
      updatePreview(settings)
      if (voiceSelect.options.length) populateVoices(settings)
    },
  })
  populateVoices(binding.get())
  window.speechSynthesis?.addEventListener('voiceschanged', () => populateVoices(binding.get()))

  document.getElementById('test-voice').addEventListener('click', () => {
    const settings = binding.get()
    const lang = languages.baseCode(settings.learningLang)
    tts.speak(VOICE_SAMPLES[lang] || VOICE_SAMPLES.en, lang, settings.tts)
  })

  // ---------- server ----------
  const serverInput = document.getElementById('server-url')
  const serverStatus = document.getElementById('server-status')
  serverInput.value = binding.get().serverUrl

  const showServerStatus = async () => {
    serverStatus.textContent = 'Checking connection…'
    const health = await api.health()
    serverStatus.textContent = health.ok
      ? `Connected ✓ · AI ${health.data.ai ? 'enabled' : 'disabled on this server (offline dictionary will be used)'}`
      : `Can't reach the server (${health.error}). Start it with "npm run dev" in the server folder.`
  }

  document.getElementById('save-server').addEventListener('click', async () => {
    const url = serverInput.value.trim().replace(/\/+$/, '')
    let origin
    try {
      origin = new URL(url).origin
    } catch {
      serverStatus.textContent = 'Please enter a valid URL, e.g. http://localhost:4000'
      return
    }
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false)
    if (!granted) {
      serverStatus.textContent = 'Permission to contact this server was not granted.'
      return
    }
    await store.save({ serverUrl: url })
    showServerStatus()
  })
  showServerStatus()

  // ---------- misc ----------
  document.getElementById('reset').addEventListener('click', async () => {
    if (!window.confirm('Reset all LEATCH settings to their defaults?')) return
    const settings = await store.reset()
    serverInput.value = settings.serverUrl
  })

  const links = [...document.querySelectorAll('.sidebar a[href^="#"]')]
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry) => links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`)))
    },
    { rootMargin: '-20% 0px -70% 0px' },
  )
  document.querySelectorAll('main section[id]').forEach((section) => observer.observe(section))
})()
