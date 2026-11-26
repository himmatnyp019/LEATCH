import { createHash } from 'node:crypto'

/**
 * Stable SHA-1 hex digest of any JSON-serialisable value.
 *
 * @param {*} value - Value to hash
 * @returns {string} 40-char hex digest
 */
export const hashOf = (value) => createHash('sha1').update(JSON.stringify(value)).digest('hex')

/**
 * Returns today's date in UTC as `YYYY-MM-DD` (used for daily quotas).
 *
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10)
