/** Error carrying an HTTP status code; handled by the global error handler. */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human-readable message for the client
   * @param {Array<{field?: string, message: string}>} [errors=[]] - Field level details
   */
  constructor(statusCode, message, errors = []) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.errors = errors
    Error.captureStackTrace?.(this, this.constructor)
  }
}
