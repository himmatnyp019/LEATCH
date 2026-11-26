/** Hangul syllable helpers used by the offline Korean grammar matcher. */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const HANGUL_FIRST = 0xac00
  const HANGUL_LAST = 0xd7a3
  const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
  const VOWELS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
  // Vowels a syllable ends with after the -아/어 infinitive contraction (가, 봐, 먹어, 배워, 해, 마셔 …).
  const INFINITIVE_VOWELS = new Set(['ㅏ', 'ㅐ', 'ㅓ', 'ㅕ', 'ㅘ', 'ㅝ', 'ㅙ', 'ㅒ'])

  const isHangul = (char) => {
    const code = char?.charCodeAt(0)
    return code >= HANGUL_FIRST && code <= HANGUL_LAST
  }

  /** Final consonant (받침) of a syllable: '' when none, null for non-Hangul. */
  const finalOf = (char) => (isHangul(char) ? FINALS[(char.charCodeAt(0) - HANGUL_FIRST) % 28] : null)

  /** Medial vowel of a syllable (null for non-Hangul). */
  const vowelOf = (char) => (isHangul(char) ? VOWELS[Math.floor((char.charCodeAt(0) - HANGUL_FIRST) / 28) % 21] : null)

  /** True for syllables that look like the end of an -아/어 infinitive (no final consonant). */
  const isInfinitiveSyllable = (char) => finalOf(char) === '' && INFINITIVE_VOWELS.has(vowelOf(char))

  LEATCH.korean = { isHangul, finalOf, vowelOf, isInfinitiveSyllable }
})()
