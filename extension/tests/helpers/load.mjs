import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Loads extension classic scripts (they attach to globalThis.LEATCH) in order.
 *
 * @param {...string} files - paths relative to extension/src
 * @returns {object} globalThis.LEATCH
 */
export const loadScripts = (...files) => {
  for (const file of files) require(`../../src/${file}`)
  return globalThis.LEATCH
}
