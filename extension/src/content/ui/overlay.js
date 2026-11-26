/**
 * Mounts the LEATCH overlay inside the YouTube player (so it also works in fullscreen),
 * isolated in a shadow root, and wires the UI components together.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { h } = LEATCH.dom

  const BASE_PLAYER_HEIGHT = 720
  const MIN_SCALE = 0.55
  const MAX_SCALE = 1.7
  const HOVER_HIDE_MS = 2500
  const TOAST_MS = 3200
  const NATIVE_CAPTIONS_STYLE_ID = 'leatch-hide-native-captions'
  // Events that must not reach YouTube's player handlers when they start inside our UI.
  const ISOLATED_EVENTS = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel', 'contextmenu', 'keydown', 'keyup', 'keypress']
  const FOCUSABLE_FIELDS = new Set(['TEXTAREA', 'INPUT', 'SELECT', 'OPTION'])

  const FONT_STACKS = {
    default: '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Segoe UI", Roboto, system-ui, sans-serif',
    serif: '"Noto Serif KR", "Nanum Myeongjo", "AppleMyungjo", Georgia, serif',
    rounded: '"NanumSquareRound", "Arial Rounded MT Bold", "Varela Round", "Apple SD Gothic Neo", sans-serif',
    mono: '"D2Coding", "JetBrains Mono", Menlo, Consolas, monospace',
  }

  let cssPromise = null
  const loadCss = () => {
    cssPromise ||= fetch(chrome.runtime.getURL('src/content/ui/overlay.css')).then((response) => response.text())
    return cssPromise
  }

  const hexToRgba = (hex, alpha) => {
    const value = /^#?([0-9a-f]{6})$/i.exec(hex || '')?.[1] ?? '000000'
    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  /** Hides YouTube's own caption window while LEATCH subtitles are active. */
  const setNativeCaptionsHidden = (hidden) => {
    const existing = document.getElementById(NATIVE_CAPTIONS_STYLE_ID)
    if (!hidden) return existing?.remove()
    if (existing) return
    const style = document.createElement('style')
    style.id = NATIVE_CAPTIONS_STYLE_ID
    style.textContent = '#movie_player .ytp-caption-window-container { display: none !important; }'
    document.head.append(style)
  }

  /**
   * @param {object} options
   * @param {HTMLElement} options.player - #movie_player
   * @param {object} options.handlers - callbacks for every UI action (see session.js)
   * @returns {Promise<object>} overlay API
   */
  const createOverlay = async ({ player, handlers }) => {
    document.getElementById('leatch-overlay')?.remove()

    const host = h('div', { id: 'leatch-overlay', style: { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '58' } })
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = await loadCss()

    const root = h('div', { class: 'lt' })
    const toasts = h('div', { class: 'lt-toasts' })
    const subtitleView = LEATCH.ui.createSubtitleView(handlers.subtitles)
    const vocabPanel = LEATCH.ui.createVocabPanel({ cardOptions: handlers.cardOptions })
    const studyCard = LEATCH.ui.createStudyCard({ cardOptions: handlers.cardOptions, ...handlers.study })
    const toolbar = LEATCH.ui.createToolbar(handlers.toolbar)

    root.append(subtitleView.element, vocabPanel.element, studyCard.element, toolbar.element, toasts)
    shadow.append(style, root)
    player.append(host)

    ISOLATED_EVENTS.forEach((type) =>
      host.addEventListener(type, (event) => {
        event.stopPropagation()
        // Keep keyboard focus on the player so YouTube's own shortcuts keep working after a click.
        const path = event.composedPath()
        const isField = FOCUSABLE_FIELDS.has(path[0]?.tagName)
        const isSubtitleText = path.some((node) => node.classList?.contains('lt-line')) && !path.some((node) => node.tagName === 'BUTTON')
        if (type === 'mousedown' && !isField && !isSubtitleText) event.preventDefault()
      }),
    )

    const resizeObserver = new ResizeObserver(() => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, player.clientHeight / BASE_PLAYER_HEIGHT))
      root.style.setProperty('--lt-scale', scale.toFixed(3))
    })
    resizeObserver.observe(player)

    const syncPlayerState = () => {
      root.classList.toggle('lt-controls', LEATCH.player.areControlsVisible(player))
      root.classList.toggle('lt-ad', LEATCH.player.isAdShowing(player))
    }
    const classObserver = new MutationObserver(syncPlayerState)
    classObserver.observe(player, { attributes: true, attributeFilter: ['class'] })
    syncPlayerState()

    let hoverTimer = null
    const onPointerMove = () => {
      root.classList.add('lt-hover')
      clearTimeout(hoverTimer)
      hoverTimer = setTimeout(() => root.classList.remove('lt-hover'), HOVER_HIDE_MS)
    }
    player.addEventListener('mousemove', onPointerMove)

    const applySettings = (settings) => {
      const subs = settings.subtitles
      const vars = {
        '--lt-orig-size': subs.originalFontSize,
        '--lt-tr-size': subs.translationFontSize,
        '--lt-orig-color': subs.originalColor,
        '--lt-tr-color': subs.translationColor,
        '--lt-sub-bg': hexToRgba(subs.backgroundColor, subs.backgroundOpacity),
        '--lt-font': FONT_STACKS[subs.fontFamily] || FONT_STACKS.default,
        '--lt-weight': subs.fontWeight,
        '--lt-offset': subs.offsetPercent,
        '--lt-panel-scale': settings.vocab.panelScale,
        '--lt-panel-opacity': settings.vocab.opacity,
      }
      Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, String(value)))
      setNativeCaptionsHidden(settings.enabled && subs.show && subs.hideNativeCaptions)
      root.classList.toggle('lt-hidden', !settings.enabled)
    }

    /** Shows a short message over the player. */
    const toast = (message, kind = 'info') => {
      const element = h('div', { class: 'lt-toast', dataset: { kind } }, message)
      toasts.append(element)
      setTimeout(() => element.remove(), TOAST_MS)
    }

    const setPaused = (paused) => root.classList.toggle('lt-paused', paused)

    const destroy = () => {
      resizeObserver.disconnect()
      classObserver.disconnect()
      player.removeEventListener('mousemove', onPointerMove)
      clearTimeout(hoverTimer)
      setNativeCaptionsHidden(false)
      host.remove()
    }

    return { root, subtitleView, vocabPanel, studyCard, toolbar, applySettings, toast, setPaused, destroy }
  }

  LEATCH.ui = { ...LEATCH.ui, createOverlay, setNativeCaptionsHidden }
})()
