/** Messaging helpers between the content script and the background worker. */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})

  /** True while the extension context is alive (false after the extension is reloaded/updated). */
  const isAlive = () => Boolean(chrome.runtime?.id)

  /**
   * Sends a typed message to the background worker.
   *
   * @param {string} type
   * @param {object} [payload]
   * @returns {Promise<{ ok: boolean, data?: any, error?: string, status?: number }>}
   */
  const call = async (type, payload = {}) => {
    if (!isAlive()) return { ok: false, error: 'LEATCH was updated — reload this page.' }
    try {
      return (await chrome.runtime.sendMessage({ type, payload })) || { ok: false, error: 'No response' }
    } catch (err) {
      return { ok: false, error: err?.message || 'Extension messaging failed' }
    }
  }

  /** Calls the LEATCH REST API through the background worker. */
  const api = (method, path, body) => call('API', { method, path, body })

  LEATCH.runtime = { call, api, isAlive }
})()
