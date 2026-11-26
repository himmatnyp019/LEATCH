/** Helpers for locating and inspecting the YouTube player. */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const POLL_MS = 250

  const isWatchPage = () => location.pathname === '/watch'
  const getVideoId = () => (isWatchPage() ? new URLSearchParams(location.search).get('v') : null)

  const findElements = () => {
    const player = document.getElementById('movie_player')
    const video = player?.querySelector('video.html5-main-video') || player?.querySelector('video')
    return player && video ? { player, video } : null
  }

  /**
   * Resolves with `{ player, video }` once both exist (or null after `timeoutMs`).
   *
   * @param {number} [timeoutMs=20000]
   */
  const waitForElements = async (timeoutMs = 20000) => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      const found = findElements()
      if (found) return found
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    }
    return null
  }

  const isAdShowing = (player) => player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')
  const areControlsVisible = (player) => !player.classList.contains('ytp-autohide')

  const formatTime = (seconds) => {
    const total = Math.max(0, Math.floor(seconds || 0))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = String(total % 60).padStart(2, '0')
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
  }

  LEATCH.player = { isWatchPage, getVideoId, findElements, waitForElements, isAdShowing, areControlsVisible, formatTime }
})()
