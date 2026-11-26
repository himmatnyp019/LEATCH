/** Consistent success envelope: `{ success, statusCode, message, data }`. */
export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {*} data - Payload
   * @param {string} [message='Success'] - Short message
   */
  constructor(statusCode, data, message = 'Success') {
    this.success = statusCode < 400
    this.statusCode = statusCode
    this.message = message
    this.data = data
  }
}
