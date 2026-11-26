/** Request/response channel to the MAIN-world caption hook (src/page/caption-hook.js). */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const FROM_PAGE = 'leatch:page'
  const FROM_CONTENT = 'leatch:content'
  const pending = new Map()
  let nextId = 1

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== FROM_PAGE) return
    const entry = pending.get(event.data.id)
    if (!entry) return
    pending.delete(event.data.id)
    clearTimeout(entry.timer)
    if (event.data.ok) entry.resolve(event.data.data)
    else entry.reject(new Error(event.data.error || 'Page bridge error'))
  })

  /**
   * Sends a request to the page hook.
   *
   * @param {'GET_PLAYER_DATA'|'FETCH_TRACK'} type
   * @param {object} [payload]
   * @param {number} [timeoutMs=15000]
   * @returns {Promise<any>}
   */
  const request = (type, payload = {}, timeoutMs = 15000) =>
    new Promise((resolve, reject) => {
      const id = `${Date.now()}-${nextId++}`
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`${type} timed out`))
      }, timeoutMs)
      pending.set(id, { resolve, reject, timer })
      window.postMessage({ source: FROM_CONTENT, id, type, payload }, location.origin)
    })

  LEATCH.bridge = { request }
})()
