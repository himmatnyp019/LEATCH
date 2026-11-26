/* eslint-disable no-console */
import { env } from '../config/env.js'

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const activeLevel = env.isTest ? LEVELS.error : LEVELS[env.LOG_LEVEL]

const serialize = (value) => (value instanceof Error ? { message: value.message, name: value.name, stack: value.stack } : value)

const write = (level, args) => {
  if (LEVELS[level] > activeLevel) return
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  const time = new Date().toISOString()
  if (env.logFormat === 'json') {
    const [first, ...rest] = args
    const entry = typeof first === 'object' && first !== null && !(first instanceof Error)
      ? { time, level, pid: process.pid, ...first }
      : { time, level, pid: process.pid, msg: String(first), ...(rest.length ? { details: rest.map(serialize) } : {}) }
    sink(JSON.stringify(entry))
    return
  }
  sink(`[${time}] ${level.toUpperCase()}`, ...args)
}

/** Leveled logger: JSON lines in production (LOG_FORMAT=json), readable text in development. */
export const logger = {
  error: (...args) => write('error', args),
  warn: (...args) => write('warn', args),
  info: (...args) => write('info', args),
  debug: (...args) => write('debug', args),
}
