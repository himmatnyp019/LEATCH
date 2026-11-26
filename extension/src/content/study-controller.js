/**
 * Study pauses: pauses the video at sentence boundaries (every N sentences or every N seconds),
 * or reacts to manual pauses, and reports which sentences the learner just heard.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})

  const END_EPSILON = 0.08
  const SEEK_GRACE_MS = 500

  /**
   * @param {object} options
   * @param {HTMLVideoElement} options.video
   * @param {HTMLElement} options.player
   * @param {() => Array} options.getCues
   * @param {() => object} options.getSettings
   * @param {(stop: { reason: 'auto'|'manual', fromIndex: number, toIndex: number }) => void} options.onStop
   * @param {() => void} options.onResume
   */
  const create = ({ video, player, getCues, getSettings, onStop, onResume }) => {
    let lastProcessed = -1
    let segmentStart = 0
    let segmentStartTime = 0
    let sentencesInSegment = 0
    let pausingByUs = false
    let replayTarget = null
    let ignorePauseUntil = 0
    let frame = 0
    let active = false

    const cueIndexAt = (time) => LEATCH.cues.findCueIndex(getCues(), time)
    const blocked = () => !active || !getSettings().enabled || LEATCH.player.isAdShowing(player)

    /** Re-anchors the segment at the current playhead (after seeks, resumes, reloads). */
    const resetSegment = () => {
      const cues = getCues()
      const time = video.currentTime
      const index = cueIndexAt(time)
      const insideCue = index >= 0 && time < cues[index].end - END_EPSILON
      lastProcessed = insideCue ? index - 1 : index
      segmentStart = lastProcessed + 1
      segmentStartTime = time
      sentencesInSegment = 0
    }

    const shouldStopAfter = (cue, index) => {
      if (replayTarget === index) return true
      const { autoPause, everyNSentences, intervalSeconds } = getSettings().study
      if (autoPause === 'sentence') return sentencesInSegment >= Math.max(1, everyNSentences)
      if (autoPause === 'interval') return cue.end - segmentStartTime >= Math.max(5, intervalSeconds)
      return false
    }

    const tick = () => {
      frame = 0
      if (video.paused || blocked()) return
      const cues = getCues()
      const time = video.currentTime
      while (lastProcessed + 1 < cues.length && cues[lastProcessed + 1].end - END_EPSILON <= time) {
        const index = lastProcessed + 1
        lastProcessed = index
        sentencesInSegment += 1
        if (shouldStopAfter(cues[index], index)) {
          replayTarget = null
          pausingByUs = true
          video.pause()
          onStop({ reason: 'auto', fromIndex: Math.min(segmentStart, index), toIndex: index })
          return
        }
      }
      frame = requestAnimationFrame(tick)
    }

    const startLoop = () => {
      if (!frame && !video.paused) frame = requestAnimationFrame(tick)
    }

    const onPlay = () => {
      if (!active) return
      onResume()
      resetSegment()
      startLoop()
    }

    const onPause = () => {
      if (pausingByUs) {
        pausingByUs = false
        return
      }
      if (blocked() || video.ended || Date.now() < ignorePauseUntil) return
      if (!getSettings().study.showCardOnPause) return
      const index = cueIndexAt(video.currentTime)
      if (index >= 0) onStop({ reason: 'manual', fromIndex: index, toIndex: index })
    }

    const onSeeking = () => {
      ignorePauseUntil = Date.now() + SEEK_GRACE_MS
      if (active) resetSegment()
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('seeking', onSeeking)

    /** Seeks to `fromIndex`, plays, and pauses again after `toIndex`. */
    const replay = (fromIndex, toIndex) => {
      const cues = getCues()
      if (!cues[fromIndex]) return
      replayTarget = toIndex
      video.currentTime = cues[fromIndex].start + 0.01
      video.play()
    }

    return {
      start: () => {
        active = true
        resetSegment()
        startLoop()
      },
      stop: () => {
        active = false
        cancelAnimationFrame(frame)
        frame = 0
      },
      replay,
      resetSegment,
      destroy: () => {
        active = false
        cancelAnimationFrame(frame)
        video.removeEventListener('play', onPlay)
        video.removeEventListener('pause', onPause)
        video.removeEventListener('seeking', onSeeking)
      },
    }
  }

  LEATCH.studyController = { create }
})()
