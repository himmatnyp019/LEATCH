// Imported first by every test file so env validation passes without a .env file.
// Tests must never touch the real (Atlas) database: override every MONGODB_* variable.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars'
process.env.ANTHROPIC_API_KEY = ''
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:1/leatch-unused'
process.env.MONGODB_USERNAME = ''
process.env.MONGODB_PASSWORD = ''
process.env.MONGODB_DB_NAME = 'leatch-test'
process.env.MONGODB_CONNECT_RETRIES = '0'
process.env.LOAD_SHED_MAX_LAG_MS = '0'
process.env.REDIS_URL ??= ''
