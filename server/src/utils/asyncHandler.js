/**
 * Wraps an async route handler so rejected promises reach the error handler.
 *
 * @param {Function} handler - `(req, res, next) => Promise`
 * @returns {Function} Express middleware
 */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)
