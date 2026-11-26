/* LEATCH background service worker: routes content-script requests to the LEATCH server. */
importScripts('../shared/languages.js', '../shared/settings.js', '../shared/api-client.js')

const { api } = globalThis.LEATCH

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

const handlers = {
  API: ({ method, path, body }) => {
    if (!ALLOWED_METHODS.has(method)) return { ok: false, error: 'Method not allowed' }
    return api.request(method, path, body)
  },
  AUTH_STATUS: async () => ({ ok: true, data: await api.getAuth() }),
  OPEN_PAGE: async ({ page, hash = '' }) => {
    if (page === 'options') await chrome.runtime.openOptionsPage()
    else await chrome.tabs.create({ url: chrome.runtime.getURL(`library/library.html${hash}`) })
    return { ok: true }
  },
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from this extension (content scripts and pages).
  if (sender.id !== chrome.runtime.id) return false
  const handler = handlers[message?.type]
  if (!handler) return false

  Promise.resolve()
    .then(() => handler(message.payload || {}, sender))
    .then(sendResponse, (err) => sendResponse({ ok: false, error: err?.message || String(err) }))
  return true
})

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage()
})
