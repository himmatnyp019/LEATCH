/**
 * Content-script entry point: starts a LEATCH session for every YouTube watch page,
 * including YouTube's single-page navigations.
 */
;(() => {
  const LEATCH = globalThis.LEATCH
  let session = null
  let currentVideoId = null
  let navigationToken = 0

  const teardown = () => {
    session?.destroy()
    session = null
    currentVideoId = null
  }

  const handleNavigation = async () => {
    const videoId = LEATCH.player.getVideoId()
    if (videoId && videoId === currentVideoId) return
    teardown()
    if (!videoId) return

    currentVideoId = videoId
    const token = ++navigationToken
    const [settings, elements] = await Promise.all([LEATCH.settings.load(), LEATCH.player.waitForElements()])
    if (token !== navigationToken || !elements) return

    try {
      const created = await LEATCH.session.create({ videoId, elements, settings })
      if (token !== navigationToken) created.destroy()
      else session = created
    } catch (err) {
      console.error('[LEATCH] Failed to start on this video:', err)
    }
  }

  document.addEventListener('yt-navigate-finish', handleNavigation)
  window.addEventListener('popstate', handleNavigation)
  handleNavigation()

  LEATCH.settings.onChange((settings) => session?.updateSettings(settings))
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.auth) session?.reload()
  })
})()
