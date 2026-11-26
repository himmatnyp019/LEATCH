import { ApiError } from '../utils/ApiError.js'

/**
 * Validates `{ body, params, query }` against a zod schema and replaces
 * `req.body` / `req.params` with the parsed (coerced, stripped) values.
 * Parsed query values are exposed as `req.validQuery` (Express 5 query is read-only).
 *
 * @param {import('zod').ZodTypeAny} schema - zod object with optional body/params/query keys
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({ body: req.body ?? {}, params: req.params ?? {}, query: req.query ?? {} })
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
    throw new ApiError(422, 'Validation failed', errors)
  }
  if (result.data.body) req.body = result.data.body
  if (result.data.params) Object.assign(req.params, result.data.params)
  req.validQuery = result.data.query ?? {}
  next()
}
