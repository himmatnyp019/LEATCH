import 'dotenv/config'
import { z } from 'zod'

const PLACEHOLDER_SECRET = 'replace-me-with-a-long-random-secret-at-least-32-chars'

const bool = (fallback) =>
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no', ''])
    .default(fallback ? 'true' : 'false')
    .transform((value) => (value === '' ? fallback : ['true', '1', 'yes'].includes(value)))

const int = (fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => z.coerce.number().int().min(min).max(max).default(fallback)

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: int(4000, { min: 1, max: 65535 }),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    LOG_FORMAT: z.enum(['json', 'pretty', '']).default(''),

    // --- Database ---
    MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/leatch'),
    MONGODB_USERNAME: z.string().default(''),
    MONGODB_PASSWORD: z.string().default(''),
    MONGODB_DB_NAME: z.string().regex(/^[\w-]{1,63}$/, 'Invalid database name').default('leatch'),
    MONGODB_MAX_POOL_SIZE: int(50, { min: 1, max: 500 }),
    MONGODB_MIN_POOL_SIZE: int(2, { min: 0, max: 100 }),
    MONGODB_AUTO_INDEX: bool(true),
    MONGODB_CONNECT_RETRIES: int(10, { min: 0, max: 1000 }),
    /** Wire compression (e.g. "zstd,zlib"); off by default — it costs CPU on every small query. */
    MONGODB_COMPRESSORS: z.string().regex(/^(|(zstd|snappy|zlib)(,(zstd|snappy|zlib))*)$/, 'Use zstd, snappy and/or zlib').default(''),

    // --- Auth ---
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES: z.string().default('30d'),
    LOGIN_MAX_FAILURES: int(5, { min: 1, max: 100 }),
    LOGIN_LOCK_MINUTES: int(15, { min: 1, max: 1440 }),
    PASSWORD_HASH_CONCURRENCY: int(4, { min: 1, max: 64 }),

    // --- HTTP / network ---
    TRUST_PROXY: z.string().default('0'),
    CORS_ORIGINS: z.string().default(''),
    ALLOWED_EXTENSION_IDS: z.string().default(''),
    COMPRESSION: bool(true),
    REQUEST_TIMEOUT_MS: int(30_000, { min: 1_000, max: 600_000 }),
    AI_REQUEST_TIMEOUT_MS: int(150_000, { min: 1_000, max: 600_000 }),
    SHUTDOWN_TIMEOUT_MS: int(25_000, { min: 1_000, max: 120_000 }),
    WEB_CONCURRENCY: int(0, { min: 0, max: 256 }),

    // --- Rate limiting & load shedding ---
    REDIS_URL: z.string().default(''),
    RATE_LIMIT_GLOBAL_PER_MIN: int(300, { min: 1 }),
    RATE_LIMIT_USER_PER_MIN: int(600, { min: 1 }),
    RATE_LIMIT_AUTH_PER_15_MIN: int(20, { min: 1 }),
    RATE_LIMIT_AI_PER_MIN: int(30, { min: 1 }),
    RATE_LIMIT_WRITE_PER_MIN: int(60, { min: 1 }),
    LOAD_SHED_MAX_LAG_MS: int(300, { min: 0, max: 10_000 }),

    // --- AI ---
    ANTHROPIC_API_KEY: z.string().default(''),
    AI_MODEL: z.string().default('claude-opus-5-5'),
    AI_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
    AI_DAILY_CHUNK_LIMIT: int(300),
    AI_MAX_CONCURRENT_REQUESTS: int(16, { min: 1, max: 512 }),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return
    if (value.JWT_SECRET === PLACEHOLDER_SECRET || value.JWT_SECRET.length < 48) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'use a unique random secret of at least 48 characters in production' })
    }
    if (/127\.0\.0\.1|localhost/.test(value.MONGODB_URI)) {
      ctx.addIssue({ code: 'custom', path: ['MONGODB_URI'], message: 'points to localhost in production' })
    }
  })

/** Parses TRUST_PROXY: hop count ("1"), boolean ("true"), or a list of subnets/addresses. */
const parseTrustProxy = (raw) => {
  const value = raw.trim()
  if (/^\d+$/.test(value)) return Number(value)
  if (value === 'true' || value === 'false') return value === 'true'
  return value.split(',').map((entry) => entry.trim()).filter(Boolean)
}

const list = (raw) => raw.split(',').map((entry) => entry.trim()).filter(Boolean)

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')
  console.error(`[env] Invalid environment configuration:\n${details}\nCopy server/.env.example to server/.env and fill it in.`)
  process.exit(1)
}

const data = parsed.data

/** Validated, typed environment configuration. */
export const env = Object.freeze({
  ...data,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  logFormat: data.LOG_FORMAT || (data.NODE_ENV === 'production' ? 'json' : 'pretty'),
  trustProxy: parseTrustProxy(data.TRUST_PROXY),
  corsOrigins: list(data.CORS_ORIGINS),
  allowedExtensionIds: list(data.ALLOWED_EXTENSION_IDS),
  isAiEnabled: Boolean(data.ANTHROPIC_API_KEY),
})
