/**
 * REST client for the LEATCH server. Used by the service worker and extension pages
 * (content scripts go through the service worker to avoid page CORS rules).
 * Classic script: attaches `LEATCH.api`. Requires shared/settings.js.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const AUTH_KEY = 'auth'

  const getAuth = async () => (await chrome.storage.local.get(AUTH_KEY))[AUTH_KEY] || null
  const setAuth = (auth) => chrome.storage.local.set({ [AUTH_KEY]: auth })
  const clearAuth = () => chrome.storage.local.remove(AUTH_KEY)

  const serverUrl = async () => (await LEATCH.settings.load()).serverUrl.trim().replace(/\/+$/, '')

  /**
   * Performs an API request.
   *
   * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
   * @param {string} path - must start with /api/
   * @param {object} [body]
   * @returns {Promise<{ ok: boolean, status: number, data?: any, message?: string, error?: string, errors?: Array }>}
   */
  const request = async (method, path, body) => {
    if (!String(path).startsWith('/api/')) return { ok: false, status: 0, error: 'Invalid API path' }

    const [base, auth] = await Promise.all([serverUrl(), getAuth()])
    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth?.token) headers.Authorization = `Bearer ${auth.token}`

    let response
    try {
      response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    } catch {
      return { ok: false, status: 0, error: `Can't reach the LEATCH server at ${base}. Is it running?` }
    }

    let payload = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    // An expired/invalid session: forget it so the UI shows the login form again.
    if (response.status === 401 && auth?.token && !path.startsWith('/api/auth/login')) await clearAuth()

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: payload?.message || `Request failed (${response.status})`,
        errors: payload?.errors || [],
      }
    }
    return { ok: true, status: response.status, data: payload?.data, message: payload?.message }
  }

  const startSession = async (path, body) => {
    const result = await request('POST', path, body)
    if (result.ok) await setAuth({ token: result.data.token, user: result.data.user })
    return result
  }

  const login = (email, password) => startSession('/api/auth/login', { email, password })
  const register = (email, password, name) => startSession('/api/auth/register', { email, password, name })
  const logout = () => clearAuth()

  /** Refreshes the cached user profile; returns the request result. */
  const refreshMe = async () => {
    const result = await request('GET', '/api/auth/me')
    if (result.ok) {
      const auth = await getAuth()
      if (auth) await setAuth({ ...auth, user: result.data })
    }
    return result
  }

  /** Public health probe (no auth). */
  const health = async () => {
    try {
      const response = await fetch(`${await serverUrl()}/api/health`)
      return response.ok ? { ok: true, data: await response.json() } : { ok: false, error: `HTTP ${response.status}` }
    } catch {
      return { ok: false, error: 'Server unreachable' }
    }
  }

  LEATCH.api = { AUTH_KEY, request, getAuth, setAuth, clearAuth, login, register, logout, refreshMe, health, serverUrl }
})()
