import { ApiError } from './ApiError.js'

/**
 * Limits how many async tasks run at once. Extra callers wait in a bounded queue; when the
 * queue is full the call is rejected with 503 instead of piling up memory under load.
 *
 * @param {{ concurrency: number, maxQueue?: number, name?: string }} options
 * @returns {{ run: <T>(task: () => Promise<T>) => Promise<T>, stats: () => { active: number, queued: number } }}
 */
export const createLimiter = ({ concurrency, maxQueue = 200, name = 'task' }) => {
  let active = 0
  const queue = []

  const next = () => {
    if (active >= concurrency || !queue.length) return
    active += 1
    const { task, resolve, reject } = queue.shift()
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        active -= 1
        next()
      })
  }

  const run = (task) => {
    if (queue.length >= maxQueue) {
      return Promise.reject(new ApiError(503, `Server busy (${name}) — please retry in a moment`))
    }
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject })
      next()
    })
  }

  return { run, stats: () => ({ active, queued: queue.length }) }
}

/**
 * Collapses concurrent calls with the same key into one in-flight promise ("single flight").
 *
 * @returns {<T>(key: string, task: () => Promise<T>) => Promise<T>}
 */
export const createSingleFlight = () => {
  const inFlight = new Map()
  return (key, task) => {
    if (inFlight.has(key)) return inFlight.get(key)
    const promise = Promise.resolve()
      .then(task)
      .finally(() => inFlight.delete(key))
    inFlight.set(key, promise)
    return promise
  }
}
