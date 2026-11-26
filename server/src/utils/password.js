import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import bcrypt from 'bcryptjs'

import { env } from '../config/env.js'
import { createLimiter } from './concurrency.js'

const scrypt = promisify(scryptCallback)

/**
 * scrypt parameters (OWASP-recommended profile N=2^14, r=8, p=5 ≈ 16 MiB per hash).
 * Hashing runs on libuv's threadpool, so it never blocks the event loop.
 */
const PARAMS = { N: 2 ** 14, r: 8, p: 5 }
const KEY_LENGTH = 64
const SALT_BYTES = 16
const MAX_MEMORY = 64 * 1024 * 1024

// Password hashing is the most CPU/memory-expensive thing the API does; cap it so a login
// flood cannot exhaust the server (excess requests get a fast 503 instead of queueing forever).
const hashLimiter = createLimiter({ concurrency: env.PASSWORD_HASH_CONCURRENCY, maxQueue: 200, name: 'password hashing' })

const derive = (password, salt, { N, r, p }) => scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r, p, maxmem: MAX_MEMORY })

/**
 * Hashes a password. Format: `scrypt$N$r$p$<salt b64>$<hash b64>`.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
export const hashPassword = (password) =>
  hashLimiter.run(async () => {
    const salt = randomBytes(SALT_BYTES)
    const key = await derive(password, salt, PARAMS)
    return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$')
  })

/**
 * Verifies a password against a stored hash (scrypt, or legacy bcrypt `$2…`). Constant-time compare.
 *
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export const verifyPassword = (password, stored) =>
  hashLimiter.run(async () => {
    if (typeof stored !== 'string') return false
    if (stored.startsWith('$2')) return bcrypt.compare(password, stored)

    const [scheme, N, r, p, salt, hash] = stored.split('$')
    if (scheme !== 'scrypt' || !salt || !hash) return false
    const expected = Buffer.from(hash, 'base64')
    const actual = await derive(password, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p) })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  })

/** True when a stored hash uses an older algorithm/parameters and should be re-hashed on login. */
export const needsRehash = (stored) => !String(stored ?? '').startsWith(`scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$`)

let dummyHashPromise = null

/** A valid hash of a random password, used to keep login timing equal when the email is unknown. */
export const dummyHash = () => {
  dummyHashPromise ||= hashPassword(randomBytes(16).toString('hex'))
  return dummyHashPromise
}
