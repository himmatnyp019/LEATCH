/* Library page: saved lessons (subtitles, key words, notes, progress) and the word list. */
;(async () => {
  const { account, api, dom, tts, languages, settings: settingsStore } = globalThis.LEATCH
  const { h, clear, iconButton, highlight } = dom

  const LESSONS_PAGE_SIZE = 24
  const WORDS_PAGE_SIZE = 60
  const SEARCH_DEBOUNCE_MS = 300
  const STATUSES = [
    ['new', 'New'],
    ['learning', 'Learning'],
    ['known', 'Known'],
  ]

  const $ = (id) => document.getElementById(id)
  const views = { login: $('login-view'), lessons: $('lessons-view'), lesson: $('lesson-view'), words: $('words-view') }
  const state = { q: '', lessonsPage: 1, wordsPage: 1, wordsStatus: '', wordsLang: '' }
  let settings = await settingsStore.load()

  // ---------- helpers ----------
  const show = (name) => Object.entries(views).forEach(([key, element]) => element.classList.toggle('hidden', key !== name))

  const youtubeUrl = (videoId, seconds = 0) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}${seconds >= 1 ? `&t=${Math.floor(seconds)}s` : ''}`

  const formatTime = (seconds) => {
    const total = Math.max(0, Math.floor(seconds || 0))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const rest = String(total % 60).padStart(2, '0')
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
  }

  const timeAgo = (value) => {
    const seconds = (Date.now() - new Date(value).getTime()) / 1000
    if (!Number.isFinite(seconds)) return ''
    const units = [
      [86400 * 30, 'month'],
      [86400 * 7, 'week'],
      [86400, 'day'],
      [3600, 'hour'],
      [60, 'minute'],
    ]
    const [size, unit] = units.find(([unitSeconds]) => seconds >= unitSeconds) || [1, 'just now']
    if (unit === 'just now') return 'just now'
    const count = Math.floor(seconds / size)
    return `${count} ${unit}${count > 1 ? 's' : ''} ago`
  }

  const speak = (text, lang) => tts.speak(text, lang, settings.tts)
  const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`
  const alertBox = (message) => h('div', { class: 'alert error' }, message)
  const external = (href, label, cls = 'btn btn-sm') => h('a', { class: cls, href, target: '_blank', rel: 'noopener' }, label)

  const exampleList = (examples, lang, cls) =>
    examples?.length
      ? h(
          'ol',
          { class: cls },
          examples.map((example) =>
            h('li', {}, h('span', {}, example.text, ' '), iconButton('speaker', 'Listen', () => speak(example.text, lang), { cls: 'lt-sm', size: 13 }), example.translation ? h('div', { class: 'muted' }, example.translation) : null),
          ),
        )
      : null

  // ---------- lessons list ----------
  const lessonCard = (video) => {
    const thumb = h('div', { class: 'thumb' }, h('div', { class: 'progress' }, h('span', { style: { width: `${Math.round((video.progress?.percent || 0) * 100)}%` } })))
    if (/^https:\/\//.test(video.thumbnail || '')) thumb.style.backgroundImage = `url("${encodeURI(video.thumbnail)}")`
    if (video.progress?.completed) thumb.append(h('span', { class: 'done' }, 'Completed'))

    return h(
      'button',
      { class: 'lesson-card', type: 'button', onClick: () => (location.hash = `lesson/${video.videoId}`) },
      thumb,
      h(
        'div',
        { class: 'lesson-info' },
        h('strong', {}, video.title || video.videoId),
        h('span', { class: 'meta' }, video.channel || ''),
        h('span', { class: 'meta' }, [plural(video.cueCount, 'sentence'), plural(video.vocabCount, 'key word'), plural(video.noteCount, 'note')].join(' · ')),
        h('span', { class: 'meta' }, `${languages.baseCode(video.sourceLang).toUpperCase()} → ${languages.baseCode(video.translationLang).toUpperCase()} · watched ${timeAgo(video.progress?.lastWatchedAt || video.updatedAt)}`),
      ),
    )
  }

  const renderLessons = async (reset) => {
    show('lessons')
    const grid = $('lessons-grid')
    if (reset) {
      state.lessonsPage = 1
      clear(grid)
    }
    const query = new URLSearchParams({ page: state.lessonsPage, limit: LESSONS_PAGE_SIZE })
    if (state.q) query.set('q', state.q)
    const result = await api.request('GET', `/api/videos?${query}`)
    if (!result.ok) return grid.append(alertBox(result.error))

    const { items, pagination } = result.data
    items.forEach((video) => grid.append(lessonCard(video)))
    $('lessons-count').textContent = `${pagination.total} saved`
    $('lessons-more').classList.toggle('hidden', !pagination.hasNext)
    if (!pagination.total) {
      grid.append(h('div', { class: 'empty' }, state.q ? 'No lessons match your search.' : 'No saved lessons yet. On YouTube, press the bookmark button in the LEATCH toolbar to save a video.'))
    }
  }

  // ---------- lesson detail ----------
  const saveWordFromLesson = async (video, item) => {
    const cue = video.cues[item.cueIndex]
    const result = await api.request('POST', '/api/words', {
      lang: video.sourceLang,
      lemma: item.lemma,
      surface: item.surface || '',
      type: item.type,
      meaning: item.meaning || '',
      meaningLang: video.translationLang || '',
      reading: item.reading || '',
      pos: item.pos || '',
      examples: item.examples || [],
      context: cue ? { sentence: cue.text, translation: cue.translation || '', videoId: video.videoId, videoTitle: video.title || '', time: cue.start } : undefined,
    })
    return result.ok
  }

  const vocabSideCard = (video, items) => {
    const unique = [...new Map(items.map((item) => [item.lemma, item])).values()]
    return h(
      'div',
      { class: 'card stack' },
      h('h3', {}, `Key words (${unique.length})`),
      unique.length
        ? unique.slice(0, 80).map((item) => {
            const save = h('button', { class: 'btn btn-sm', type: 'button' }, '★ Save')
            save.addEventListener('click', async () => {
              save.disabled = true
              save.textContent = (await saveWordFromLesson(video, item)) ? 'Saved ✓' : 'Failed'
            })
            return h(
              'div',
              { class: 'stack', style: { gap: '2px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' } },
              h(
                'div',
                { class: 'row' },
                h('span', { class: `badge ${item.type === 'grammar' ? 'grammar' : ''}` }, item.type),
                h('strong', {}, item.lemma),
                iconButton('speaker', 'Listen', () => speak(item.type === 'grammar' ? item.surface || item.lemma : item.lemma, video.sourceLang), { size: 14 }),
                h('span', { class: 'spacer' }),
                save,
              ),
              item.reading ? h('span', { class: 'muted' }, item.reading) : null,
              h('span', {}, item.meaning),
              exampleList(item.examples, video.sourceLang, 'word-examples'),
            )
          })
        : h('p', { class: 'muted' }, 'Key words appear here after you watch the video with LEATCH and save it again.'),
    )
  }

  const notesCard = (video) => {
    const list = h('div', {})
    const renderNotes = () => {
      clear(list)
      if (!video.notes.length) list.append(h('p', { class: 'muted' }, 'No notes yet. Pause the video on YouTube and write one in the study card.'))
      video.notes
        .slice()
        .sort((a, b) => a.time - b.time)
        .forEach((note) => {
          const remove = iconButton('trash', 'Delete note', async () => {
            const result = await api.request('DELETE', `/api/videos/${video.videoId}/notes/${note._id}`)
            if (result.ok) {
              video.notes = video.notes.filter((item) => item._id !== note._id)
              renderNotes()
            }
          })
          list.append(
            h(
              'div',
              { class: 'note' },
              external(youtubeUrl(video.videoId, note.time), formatTime(note.time), 'time-link'),
              h('div', {}, h('p', {}, note.text), note.cueText ? h('small', {}, note.cueText) : null),
              remove,
            ),
          )
        })
    }
    renderNotes()
    return h('div', { class: 'card stack' }, h('h3', {}, 'Notes'), list)
  }

  const transcriptCard = (video) => {
    const vocabByCue = new Map()
    video.vocab.forEach((item) => vocabByCue.set(item.cueIndex, [...(vocabByCue.get(item.cueIndex) || []), item]))
    const needle = state.q.toLowerCase()
    const rows = video.cues
      .map((cue, index) => ({ cue, index }))
      .filter(({ cue }) => !needle || cue.text.toLowerCase().includes(needle) || (cue.translation || '').toLowerCase().includes(needle))
      .map(({ cue, index }) => {
        const items = vocabByCue.get(index) || []
        return h(
          'div',
          { class: 'transcript-row' },
          external(youtubeUrl(video.videoId, cue.start), formatTime(cue.start), 'time-link'),
          h(
            'div',
            {},
            h('div', { class: 'transcript-text', lang: video.sourceLang }, highlight(cue.text, items), ' ', iconButton('speaker', 'Listen', () => speak(cue.text, video.sourceLang), { cls: 'lt-sm', size: 13 })),
            cue.translation ? h('div', { class: 'transcript-translation' }, cue.translation) : null,
            items.length ? h('div', { class: 'transcript-vocab' }, items.map((item) => h('span', { class: 'chip', title: item.reading || '' }, `${item.lemma} — ${item.meaning}`))) : null,
          ),
        )
      })
    return h('div', { class: 'card transcript' }, rows.length ? rows : h('div', { class: 'empty' }, 'No sentences match your search.'))
  }

  const renderLesson = async (videoId) => {
    show('lesson')
    const container = clear(views.lesson)
    container.append(h('p', { class: 'muted' }, 'Loading lesson…'))
    const result = await api.request('GET', `/api/videos/${encodeURIComponent(videoId)}`)
    clear(container)
    if (!result.ok) return container.append(alertBox(result.error))

    const video = result.data
    const remove = h('button', { class: 'btn btn-sm btn-danger', type: 'button' }, 'Delete lesson')
    remove.addEventListener('click', async () => {
      if (!window.confirm('Delete this lesson and its notes from your library?')) return
      const deleted = await api.request('DELETE', `/api/videos/${video.videoId}`)
      if (deleted.ok) location.hash = 'lessons'
    })

    container.append(
      h(
        'div',
        { class: 'lesson-header' },
        h('a', { class: 'btn btn-sm', href: '#lessons' }, '← Lessons'),
        h('h1', {}, video.title || video.videoId),
        external(youtubeUrl(video.videoId, video.progress?.position), `▶ Continue at ${formatTime(video.progress?.position)}`, 'btn btn-sm btn-primary'),
        external(youtubeUrl(video.videoId), 'Watch from start'),
        remove,
      ),
      h(
        'div',
        { class: 'lesson-detail' },
        transcriptCard(video),
        h('aside', { class: 'side' }, notesCard(video), vocabSideCard(video, video.vocab)),
      ),
    )
  }

  // ---------- words ----------
  const wordCard = (word) => {
    const statusButtons = STATUSES.map(([value, label]) =>
      h('button', { type: 'button', class: word.status === value ? 'active' : '', dataset: { value } }, label),
    )
    const statusControl = h('div', { class: 'segmented' }, statusButtons)
    statusControl.addEventListener('click', async (event) => {
      const value = event.target.closest('button')?.dataset.value
      if (!value || value === word.status) return
      const result = await api.request('PATCH', `/api/words/${word._id}`, { status: value, reviewed: true })
      if (!result.ok) return
      word.status = value
      statusButtons.forEach((button) => button.classList.toggle('active', button.dataset.value === value))
    })

    const card = h(
      'article',
      { class: `word-card ${word.type === 'grammar' ? 'grammar' : ''}` },
      h(
        'div',
        { class: 'word-top' },
        h('span', { class: `badge ${word.type === 'grammar' ? 'grammar' : ''}` }, word.type),
        h('span', { class: 'muted' }, languages.getLanguage(word.lang).name),
        h('span', { class: 'spacer' }),
        iconButton('trash', 'Delete word', async () => {
          const result = await api.request('DELETE', `/api/words/${word._id}`)
          if (result.ok) card.remove()
        }),
      ),
      h('div', { class: 'row' }, h('span', { class: 'word-term', lang: word.lang }, word.lemma), iconButton('speaker', 'Listen', () => speak(word.type === 'grammar' ? word.surface || word.lemma : word.lemma, word.lang))),
      word.reading ? h('span', { class: 'muted' }, word.reading) : null,
      h('div', { class: 'word-meaning' }, word.meaning || '—'),
      exampleList(word.examples, word.lang, 'word-examples'),
      word.context?.sentence
        ? h(
            'div',
            { class: 'word-context' },
            h('div', { lang: word.lang }, highlight(word.context.sentence, [{ surface: word.surface, type: word.type }])),
            word.context.translation ? h('div', { class: 'muted' }, word.context.translation) : null,
            word.context.videoId ? external(youtubeUrl(word.context.videoId, word.context.time), `▶ ${word.context.videoTitle || 'Watch'} · ${formatTime(word.context.time)}`, 'context-link') : null,
          )
        : null,
      h('div', { class: 'word-foot' }, statusControl, h('span', { class: 'spacer' }), h('small', { class: 'muted' }, `Added ${timeAgo(word.createdAt)}`)),
    )
    return card
  }

  const wordsQuery = (page, limit) => {
    const query = new URLSearchParams({ page, limit })
    if (state.q) query.set('q', state.q)
    if (state.wordsLang) query.set('lang', state.wordsLang)
    if (state.wordsStatus) query.set('status', state.wordsStatus)
    return query
  }

  const renderWords = async (reset) => {
    show('words')
    const list = $('words-list')
    if (reset) {
      state.wordsPage = 1
      clear(list)
    }
    document.querySelectorAll('#words-status button').forEach((button) => button.classList.toggle('active', button.dataset.status === state.wordsStatus))
    const result = await api.request('GET', `/api/words?${wordsQuery(state.wordsPage, WORDS_PAGE_SIZE)}`)
    if (!result.ok) return list.append(alertBox(result.error))

    const { items, pagination } = result.data
    items.forEach((word) => list.append(wordCard(word)))
    $('words-count').textContent = plural(pagination.total, 'word')
    $('words-more').classList.toggle('hidden', !pagination.hasNext)
    if (!pagination.total) list.append(h('div', { class: 'empty' }, 'No saved words yet. Click ★ on a key word while watching to save it here.'))
  }

  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

  const exportCsv = async () => {
    const rows = [['term', 'reading', 'meaning', 'type', 'language', 'example 1', 'example 1 translation', 'example 2', 'example 2 translation', 'sentence', 'sentence translation', 'status']]
    for (let page = 1; ; page++) {
      const result = await api.request('GET', `/api/words?${wordsQuery(page, 200)}`)
      if (!result.ok) break
      result.data.items.forEach((word) => {
        const [first = {}, second = {}] = word.examples || []
        rows.push([word.lemma, word.reading, word.meaning, word.type, word.lang, first.text, first.translation, second.text, second.translation, word.context?.sentence, word.context?.translation, word.status])
      })
      if (!result.data.pagination.hasNext) break
    }
    const blob = new Blob([`﻿${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const link = h('a', { href: URL.createObjectURL(blob), download: `leatch-words-${new Date().toISOString().slice(0, 10)}.csv` })
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  // ---------- routing & events ----------
  const route = async () => {
    const auth = await api.getAuth()
    document.querySelector('.lib-head nav').classList.toggle('hidden', !auth?.token)
    if (!auth?.token) return show('login')

    const [name, param] = (location.hash.slice(1) || 'lessons').split('/')
    document.querySelectorAll('#tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === (name === 'lesson' ? 'lessons' : name)))
    if (name === 'lesson' && param) return renderLesson(param)
    if (name === 'words') return renderWords(true)
    return renderLessons(true)
  }

  document.querySelectorAll('#tabs button').forEach((button) => button.addEventListener('click', () => (location.hash = button.dataset.tab)))
  $('lessons-more').addEventListener('click', () => {
    state.lessonsPage += 1
    renderLessons(false)
  })
  $('words-more').addEventListener('click', () => {
    state.wordsPage += 1
    renderWords(false)
  })
  $('words-status').addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (!button) return
    state.wordsStatus = button.dataset.status
    renderWords(true)
  })
  const langFilter = $('words-lang')
  languages.STUDY_LANGUAGES.forEach((code) => langFilter.append(h('option', { value: code }, languages.getLanguage(code).name)))
  langFilter.addEventListener('change', () => {
    state.wordsLang = langFilter.value
    renderWords(true)
  })
  $('export-csv').addEventListener('click', exportCsv)

  let searchTimer = null
  $('search').addEventListener('input', (event) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      state.q = event.target.value.trim()
      route()
    }, SEARCH_DEBOUNCE_MS)
  })

  window.addEventListener('hashchange', route)
  settingsStore.onChange((next) => {
    settings = next
  })
  await account.mount($('account-widget'), {
    intro: 'Log in to see your saved lessons, words and notes.',
    onChange: () => route(),
  })
})()
