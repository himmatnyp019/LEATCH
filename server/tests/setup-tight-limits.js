// Small limits so rate limiting can be exercised quickly (each test file runs in its own process).
process.env.RATE_LIMIT_AUTH_PER_15_MIN = '3'
process.env.RATE_LIMIT_GLOBAL_PER_MIN = '12'
