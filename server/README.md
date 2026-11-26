# LEATCH API — operations guide

Node.js 22 · Express 5 · MongoDB (Atlas) · optional Redis · optional Claude AI.

## 1. Connect to MongoDB Atlas

The server reads the standard variables you already configured:

| Variable | Notes |
| --- | --- |
| `MONGODB_URI` | Atlas SRV string. Credentials can be inline, a `<db_password>` placeholder, or omitted |
| `MONGODB_USERNAME` / `MONGODB_PASSWORD` | Used when the URI has no credentials, or to fill `<db_password>` (URL-encoded automatically) |
| `MONGODB_DB_NAME` | Database to use (default `leatch`). Atlas URIs often have no database path |

Also required: `JWT_SECRET` (48+ random characters in production).

```bash
npm install
```

```bash
npm run db:check
```

`db:check` connects with the exact production settings and prints the host, MongoDB version, ping
latency and collections, or a specific hint when it fails:

- **DNS / querySrv error** → hostname typo, or the network blocks DNS SRV lookups.
- **Server selection timed out** → in Atlas → **Network Access**, allow the public IP of the machine
  running the API (for a quick test, `0.0.0.0/0`; in production, only your servers' egress IPs).
- **Authentication failed** → check the database user in Atlas → **Database Access**. Give it
  `readWrite` on the LEATCH database only, not `atlasAdmin`.

Then build the indexes once (they are also created automatically when `MONGODB_AUTO_INDEX=true`):

```bash
npm run db:indexes
```

Connection behavior: pooled (`MONGODB_MAX_POOL_SIZE` per process), `retryWrites`/`retryReads`,
majority write concern, exponential-backoff retries at start-up, automatic reconnects. While the
database is unreachable, requests fail fast with `503 + Retry-After` instead of piling up.

## 2. Run

| Command | Use |
| --- | --- |
| `npm run dev` | development with auto-reload |
| `npm start` | one process (containers / Kubernetes: scale replicas) |
| `npm run start:cluster` | one worker per CPU core on a single VM (`WEB_CONCURRENCY` to override) |
| `docker compose up -d --build` | nginx edge + 2 API replicas + Redis (`--scale api=N`) |

Health endpoints: `GET /api/health` (liveness) and `GET /api/health/ready` (database reachable, not
draining). Point load-balancer health checks at `/api/health/ready`.

## 3. Security & abuse protection (layers)

| Layer | What it does |
| --- | --- |
| **Edge (nginx, `deploy/nginx.conf`)** | per-IP request rate (20 r/s, burst 40) and connection caps, 10 logins/min per IP, slow-client timeouts, 6 MB body cap, request IDs |
| **Load shedding** | measures event-loop lag; while the process is saturated, new requests get a quick `503 + Retry-After` so in-flight work still finishes |
| **Rate limits (API)** | per IP: 300 req/min overall, 20 failed auth attempts / 15 min with progressive slow-down; per account: 600 req/min, 60 writes/min, 30 AI calls/min; failed logins per target email across all IPs. Shared through Redis when `REDIS_URL` is set (exact across processes and instances); fails open if Redis is down |
| **Account protection** | scrypt password hashing on the libuv threadpool (never blocks the event loop) with a concurrency cap; legacy bcrypt hashes upgraded on login; temporary lock after 5 consecutive failures; identical response and timing for unknown emails |
| **Tokens** | HS256 JWT pinned algorithm, issuer and audience; revocable via token version (`POST /api/auth/logout-all`, password change) |
| **Input** | zod validation on every route; payloads with `$` operators, dotted keys or `__proto__` rejected; Mongoose `sanitizeFilter` on; regex searches escaped; 100 KB body limit (5 MB only for authenticated lesson saves, parsed after auth) |
| **HTTP hardening** | Helmet headers (HSTS in production), strict CORS (lock to `ALLOWED_EXTENSION_IDS`), `Cache-Control: no-store`, no `X-Powered-By`, no stack traces in production, request/headers/keep-alive timeouts, per-request timeout |
| **AI cost protection** | daily per-user quota, cross-user cache, identical concurrent requests share one model call, capped concurrent model calls |
| **Ops** | structured JSON logs with request IDs, graceful shutdown (drain then close DB/Redis), non-root read-only container, `npm audit` in CI |

**Volumetric DDoS** (multi-Gbps floods, botnets) can't be stopped inside the application. Put the
API behind a provider edge, for example Cloudflare (proxy + WAF + rate rules) or AWS CloudFront/ALB
with AWS Shield. Set `TRUST_PROXY` to the number of proxies in front of the API so rate limits see
real client IPs.

## 4. Scaling

- **Stateless API**: any number of replicas behind a load balancer. Shared state lives in MongoDB
  (data) and Redis (rate-limit counters).
- **Connections**: total MongoDB connections ≈ replicas × processes × `MONGODB_MAX_POOL_SIZE`.
  Keep this under your Atlas tier's connection limit (M10 ≈ 1,500).
- **Hot paths are cheap**: the lesson list reads precomputed counters instead of loading subtitle
  arrays. AI work is cached and deduplicated.
- **Measured** on a shared 4-core sandbox (4 workers + MongoDB + Redis + load generator on the same
  machine): about 25,000 req/s liveness, about 1,100–1,800 req/s for authenticated MongoDB-backed
  requests (p50 25–40 ms). A single-IP flood of 77,000 requests in 8 s was held to exactly 300/min
  across all workers, and the service stayed ready.

## 5. Tests

```bash
npm test
```

Unit + HTTP + rate-limit tests. Shared-store tests use a local `redis-server` when one is installed.
For the MongoDB integration suite, use a throwaway database. It drops `leatch-test` and refuses
Atlas URIs:

```bash
docker run -d -p 27017:27017 mongo:7
```

```bash
MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test
```
