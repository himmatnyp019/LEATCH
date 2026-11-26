/** Languages the vocabulary analysis currently supports (as the language being studied). */
export const ANALYZABLE_LANGUAGES = ['ko', 'en']

/** BCP-47 style codes accepted for subtitles / meanings. Kept loose on purpose. */
export const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/

/** YouTube video IDs are 11 chars of [A-Za-z0-9_-]. */
export const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/

export const MAX_LINES_PER_ANALYSIS = 40
export const MAX_LINE_LENGTH = 400
export const MAX_ITEMS_PER_LINE = 2
export const EXAMPLES_PER_ITEM = 2
export const MAX_CUES_PER_VIDEO = 6000
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

/** Body size for ordinary JSON requests. */
export const DEFAULT_BODY_LIMIT = '100kb'
/** Body size for saving a whole lesson (full subtitles + vocab). */
export const LESSON_BODY_LIMIT = '5mb'
