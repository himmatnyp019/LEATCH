/* eslint-disable no-console */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const activeLevel = process.env.NODE_ENV === 'test' ? LEVELS.error : LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info

const write = (level, args) => {
  if (LEVELS[level] > activeLevel) return
  const stamp = new Date().toISOString()
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  sink(`[${stamp}] ${level.toUpperCase()}`, ...args)
}

/** Minimal leveled logger (no dependency). Set LOG_LEVEL=debug for more output. */
export const logger = {
  error: (...args) => write('error', args),
  warn: (...args) => write('warn', args),
  info: (...args) => write('info', args),
  debug: (...args) => write('debug', args),
}
