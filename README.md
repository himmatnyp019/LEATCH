# LEATCH — learn languages while you watch

LEATCH is a Chrome extension (plus a small backend) for learning a language from YouTube videos.
The first version supports **Korean ⇄ English**: Korean learners whose native language is English,
and the reverse.

| On YouTube | Account & library |
| --- | --- |
| Dual subtitles, one sentence at a time (original + translation into the language you choose) | Email/password sign-up and login |
| 1–2 **key words or grammar points** per sentence, shown while that sentence is spoken, with meaning, romanization/IPA, 2 example sentences in both languages and 🔊 pronunciation | Save a lesson: video link, title, full subtitles and translations, key words, progress |
| **Study pauses**: pause the video (or let LEATCH auto-pause every N sentences / N seconds) to see the sentence in both languages with its key words and examples, then press play to continue | Save words (★) with the sentence they came from; mark them new / learning / known; export CSV |
| Timestamped notes, replay / previous / next sentence, keyboard shortcuts | Library page: lessons with transcript, notes and key words; word list |
| Full customization: show/hide each line, font, size, colors, background, position, panel size… | Watch progress synced automatically for saved lessons |

---

## Quick start

Requirements: Node.js 22+, MongoDB Atlas (or any MongoDB 6+), Chrome/Edge/Brave.
Production deployment, security layers and scaling are covered in [`server/README.md`](server/README.md).

### 1. Backend

```bash
cd server
```

```bash
cp .env.example .env
```

Edit `.env` (or set real environment variables): `MONGODB_URI` (your Atlas connection string;
`MONGODB_USERNAME`/`MONGODB_PASSWORD` and `MONGODB_DB_NAME` are also supported) and a long random
`JWT_SECRET` (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
Optionally set `ANTHROPIC_API_KEY` to enable AI-picked key words (see [AI & tokens](#ai--tokens)).

```bash
npm install
```

```bash
npm run db:check
```

`db:check` verifies the Atlas connection (and tells you what to fix, e.g. Atlas Network Access).

```bash
npm run dev
```

The API listens on `http://localhost:4000` (`GET /api/health` to check). For production use
`npm run start:cluster` or `docker compose up -d --build` (nginx + replicas + Redis).
See [`server/README.md`](server/README.md).

### 2. Extension

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder (no build step).
3. The settings page opens. Create an account, then pick your languages.
4. Open any YouTube video that has Korean (or English) subtitles, auto-generated ones included.

The extension also works **without the server or login**: subtitles and translations come from YouTube,
and key words from a small built-in offline dictionary. Logging in adds saving and AI key words.

---

## How it works

```
YouTube tab
 ├─ src/page/caption-hook.js     (page "MAIN" world) watches the player's own subtitle requests and
 │                                fetches tracks with the same parameters (YouTube now requires a
 │                                token only the player attaches)
 └─ src/content/*                (extension content scripts)
     caption-loader  → picks tracks: Korean human captions › Korean auto captions › others;
                       translation: human track in your language › YouTube auto-translate (free)
     cue-builder     → joins split lines / segments auto captions into sentences, aligns translations
     analysis-manager→ key words per sentence, lazily, only around the playhead
                        • AI via the LEATCH server (when logged in and enabled), or
                        • local-analyzer + dictionary-ko/en (offline)
     ui/*            → overlay inside the player (shadow DOM, works in fullscreen):
                       subtitles, key-word panel, study card, toolbar
     study-controller→ auto-pause at sentence ends, manual-pause study card, replay
     lesson-sync     → save lesson / words / notes / progress
background service worker → the only place that talks to the LEATCH API (holds the session token)
popup / options / library   → extension pages
server/ (Express + MongoDB) → auth, lessons, words, notes, progress, AI analysis + shared cache
```

### Keyboard shortcuts (on YouTube)

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `A` / `D` | previous / next sentence | `S` | replay sentence, then pause |
| `Q` | cycle auto-pause modes | `H` | show/hide subtitles |
| `X` | show/hide translation | `V` | show/hide key-words panel |
| `Space` | continue after a study pause | | |

---

## AI & tokens

AI is optional and designed to spend as few tokens as possible:

- **Translations are free by default.** LEATCH uses human subtitles in your language when the video
  has them, otherwise YouTube's own auto-translate. AI translation is an opt-in setting.
- **Only what you watch is analyzed.** Subtitles are sent in chunks of 25 sentences around the
  playhead, not the whole video up front.
- **Shared cache.** Every analyzed chunk is stored by content hash (`AnalysisCache`), so the same video
  section is never paid for twice, for any user.
- **Examples once per word.** Example sentences live in a shared `Lexicon`. A word that has examples
  from any earlier video costs nothing new.
- **Two small structured calls.** Phase 1 picks ≤2 items per line (+ translation only if needed). Phase 2
  writes examples only for words missing from the lexicon. Both use JSON-schema structured output at
  `low` effort.
- **Per-user daily cap** (`AI_DAILY_CHUNK_LIMIT`, cache hits are free). When the cap is hit or AI is off,
  the extension silently falls back to the offline dictionary.

Model: `AI_MODEL` defaults to `claude-opus-5-5`. For much lower cost set `AI_MODEL=claude-haiku-5-5`
(this task is simple extraction).

---

## API

All endpoints are under `/api`. Authenticated ones need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` · `/health/ready` | liveness (+ whether AI is enabled) · readiness (database reachable) |
| POST | `/auth/register` · `/auth/login` | `{ email, password, name? }` → `{ user, token }` |
| GET / PATCH | `/auth/me` | profile, language preferences |
| POST | `/auth/password` | `{ currentPassword, newPassword }`, logs out other devices |
| POST | `/auth/logout-all` | revokes every token for the account |
| GET | `/videos?q=&page=` | saved lessons (without the heavy arrays) |
| GET / PUT / DELETE | `/videos/:videoId` | full lesson / create-or-update (vocab merged, notes kept) / delete |
| PATCH | `/videos/:videoId/progress` | `{ position, duration }` |
| POST / PATCH / DELETE | `/videos/:videoId/notes[/:noteId]` | timestamped notes |
| GET / POST | `/words` | list (filters `lang`, `status`, `q`) / save (idempotent per lemma) |
| GET | `/words/lemmas?lang=` | saved lemmas (for the ★ state on YouTube) |
| PATCH / DELETE | `/words/:id` | status / meaning / review, delete |
| GET | `/ai/status` | enabled, model, remaining analyses today |
| POST | `/ai/analyze` | `{ videoId, sourceLang, nativeLang, needTranslation, lines[≤40] }` |

---

## Tests

```bash
cd server && npm test
```

Unit tests (AI caching/dedupe, password hashing, tokens, guards, load shedding), HTTP tests
(validation, injection, body limits, CORS), and rate limiting, both in-memory and shared through a
local `redis-server`. To also run the MongoDB integration suite, use a throwaway database
(it drops `leatch-test` and refuses Atlas URIs):

```bash
docker run -d -p 27017:27017 mongo:7
```

```bash
MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test
```

CI (`.github/workflows/ci.yml`) runs all of this, `npm audit`, the Docker build and the extension
tests on every push.

```bash
cd extension && npm test
```

Subtitle parsing, sentence building, translation alignment, track selection and the offline analyzer.

```bash
cd extension && npm install && npx playwright install chromium && npm run test:e2e
```

End-to-end: loads the unpacked extension into Chromium with a mock YouTube page and a mock API, then
checks subtitles, key words, study pauses, login, saving and the library. Screenshots go to
`extension/tests/e2e/output/`.

---

## Project layout

```
extension/   Chrome MV3 extension (plain JS, no build step)
  manifest.json
  src/shared/       languages, settings (chrome.storage.sync), API client
  src/background/   service worker
  src/page/         MAIN-world caption hook
  src/content/      YouTube integration, analysis, UI overlay
  popup/ options/ library/ pages/   extension pages
  tests/            unit + e2e tests
server/      Node.js + Express + MongoDB (Mongoose) API
  src/modules/{auth,videos,words,ai,health}   route → controller → service → model
  src/config/  env validation, MongoDB + Redis connections
  src/middleware/  auth, rate limits, load shedding, guards, errors
  Dockerfile, docker-compose.yml, deploy/nginx.conf   production stack
```

## Known limitations / next steps

- Vocabulary analysis supports Korean and English as the *studied* language for now; translations work
  for ~18 languages.
- YouTube changes its player often. Caption fetching follows the player's own requests to cope with
  its caption tokens, but it may need updates over time.
- Chrome/Edge/Brave only for now (Firefox needs a small manifest port).
- Ideas for the next iteration: spaced-repetition review of saved words, word-level click-to-translate,
  more languages for the offline dictionary, a web dashboard.
