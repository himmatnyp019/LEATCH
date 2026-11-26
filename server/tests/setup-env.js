// Imported first by every test file so env validation passes without a .env file.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET ??= 'test-secret-that-is-definitely-longer-than-32-chars'
process.env.ANTHROPIC_API_KEY ??= ''
