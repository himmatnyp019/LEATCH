import Anthropic from '@anthropic-ai/sdk'

import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { logger } from '../../utils/logger.js'

const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
const REQUEST_TIMEOUT_MS = 120_000

let client = null
const getClient = () => {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: REQUEST_TIMEOUT_MS })
  return client
}

const toApiError = (err) => {
  if (err instanceof Anthropic.RateLimitError) return new ApiError(429, 'The AI service is busy — try again shortly')
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    logger.error('[ai] Anthropic credentials rejected — check ANTHROPIC_API_KEY')
    return new ApiError(503, 'AI is misconfigured on the server')
  }
  if (err instanceof Anthropic.APIError) {
    logger.error(`[ai] Anthropic API error ${err.status}:`, err.message)
    return new ApiError(502, 'The AI request failed')
  }
  return err
}

/**
 * Sends one request to Claude and returns the JSON object it produced under `schema`
 * (structured outputs). Uses low effort by default since the task is simple extraction.
 *
 * @param {{ system: string, user: string, schema: object, maxTokens?: number }} request
 * @returns {Promise<{ data: object, usage: object }>}
 */
export const createJsonCompletion = async ({ system, user, schema, maxTokens = 16000 }) => {
  if (!env.isAiEnabled) throw new ApiError(503, 'AI is not configured on this server')

  let response
  try {
    response = await getClient().beta.messages.create({
      model: env.AI_MODEL,
      max_tokens: maxTokens,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: env.AI_EFFORT, format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: user }],
    })
  } catch (err) {
    throw toApiError(err)
  }

  if (response.stop_reason === 'refusal') throw new ApiError(422, 'The AI declined to analyze this text')
  if (response.stop_reason === 'max_tokens') throw new ApiError(502, 'The AI response was cut off')

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  logger.info(
    `[ai] ${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`,
  )

  try {
    return { data: JSON.parse(text), usage: response.usage }
  } catch {
    throw new ApiError(502, 'The AI returned malformed output')
  }
}
