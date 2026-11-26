/**
 * Login / sign-up / account widget used by the popup, settings page and library.
 * Requires shared/settings.js, shared/api-client.js and content/ui/dom.js.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { h, clear } = LEATCH.dom
  const { api } = LEATCH

  const initials = (user) => (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()

  /**
   * Mounts the widget into `container` and keeps it in sync with the stored session.
   *
   * @param {HTMLElement} container
   * @param {{ onChange?: (auth: object|null) => void, intro?: string }} [options]
   */
  const mount = async (container, { onChange, intro } = {}) => {
    let mode = 'login'
    let busy = false

    const renderUser = (auth) =>
      h(
        'div',
        { class: 'account-user' },
        h('div', { class: 'avatar' }, initials(auth.user)),
        h('div', { class: 'who' }, h('strong', {}, auth.user?.name || 'Learner'), h('span', { class: 'muted' }, auth.user?.email || '')),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm', type: 'button', onClick: () => api.logout() }, 'Log out'),
      )

    const renderForm = async () => {
      const error = h('div', { class: 'alert error hidden', role: 'alert' })
      const name = h('input', { type: 'text', name: 'name', placeholder: 'Your name (optional)', autocomplete: 'name', maxlength: 60 })
      const email = h('input', { type: 'email', name: 'email', placeholder: 'Email', autocomplete: 'email', required: true })
      const password = h('input', {
        type: 'password',
        name: 'password',
        placeholder: mode === 'login' ? 'Password' : 'Password (8+ chars, a letter and a number)',
        autocomplete: mode === 'login' ? 'current-password' : 'new-password',
        required: true,
        minlength: mode === 'login' ? 1 : 8,
      })
      const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, mode === 'login' ? 'Log in' : 'Create account')

      const form = h(
        'form',
        { class: 'stack', novalidate: true },
        mode === 'register' ? name : null,
        email,
        password,
        error,
        submit,
      )

      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        if (busy) return
        busy = true
        submit.disabled = true
        error.classList.add('hidden')
        const result =
          mode === 'login'
            ? await api.login(email.value.trim(), password.value)
            : await api.register(email.value.trim(), password.value, name.value.trim())
        busy = false
        submit.disabled = false
        if (!result.ok) {
          const details = (result.errors || []).map((item) => item.message).join(' · ')
          error.textContent = details ? `${result.error}: ${details}` : result.error
          error.classList.remove('hidden')
        }
      })

      const tabs = h(
        'div',
        { class: 'segmented', role: 'tablist' },
        ['login', 'register'].map((value) =>
          h('button', { type: 'button', class: mode === value ? 'active' : '', onClick: () => {
            mode = value
            render()
          } }, value === 'login' ? 'Log in' : 'Create account'),
        ),
      )

      return h(
        'div',
        { class: 'stack' },
        intro ? h('p', { class: 'muted', style: { margin: 0 } }, intro) : null,
        tabs,
        form,
        h('div', { class: 'hint' }, 'Server: ', h('code', {}, await api.serverUrl())),
      )
    }

    const render = async () => {
      const auth = await api.getAuth()
      const content = auth?.token ? renderUser(auth) : await renderForm()
      clear(container).append(content)
      onChange?.(auth)
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[api.AUTH_KEY]) render()
    })
    await render()
    api.getAuth().then((auth) => auth?.token && api.refreshMe())
  }

  LEATCH.account = { mount }
})()
