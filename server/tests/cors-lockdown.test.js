import './setup-env.js'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

process.env.ALLOWED_EXTENSION_IDS = 'abcdefghijklmnopabcdefghijklmnop'
const { isAllowedOrigin } = await import('../src/app.js')

describe('CORS lock-down to known extension IDs', () => {
  it('allows only the published extension ID', () => {
    assert.equal(isAllowedOrigin('chrome-extension://abcdefghijklmnopabcdefghijklmnop'), true)
    assert.equal(isAllowedOrigin('chrome-extension://someotherextensionidxxxxxxxxxxxx'), false)
    assert.equal(isAllowedOrigin('https://evil.example'), false)
    assert.equal(isAllowedOrigin(undefined), true, 'non-browser clients have no Origin')
  })
})
