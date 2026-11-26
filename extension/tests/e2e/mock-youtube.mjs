/** Mock YouTube watch page + timedtext endpoint for the e2e test. */
export const VIDEO_ID = 'abcdefghijk'

export const KO_LINES = [
  [0.4, 2.8, '저는 한국에 가고 싶어요'],
  [3.0, 5.6, '친구랑 같이 영화 봤어요'],
  [5.9, 8.6, '배가 아파서 병원에 갔어요'],
  [8.9, 11.6, '비가 오는데 우산이 없어요'],
  [11.9, 14.6, '내일 친구를 만날 거예요'],
  [14.9, 18.0, '정말 재미있었어요'],
]

export const EN_LINES = [
  'I want to go to Korea.',
  'I watched a movie with my friend.',
  'My stomach hurt, so I went to the hospital.',
  "It's raining, but I don't have an umbrella.",
  "I'm going to meet my friend tomorrow.",
  'It was really fun.',
]

const json3 = (texts) =>
  JSON.stringify({
    events: KO_LINES.map(([start, end], index) => ({ tStartMs: Math.round(start * 1000), dDurationMs: Math.round((end - start) * 1000), segs: [{ utf8: texts[index] }] })),
  })

export const timedtext = (url) => (url.searchParams.get('tlang') === 'en' ? json3(EN_LINES) : json3(KO_LINES.map((line) => line[2])))

export const watchPage = () => {
  const base = `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&caps=asr&xoaf=5&hl=en&ip=0.0.0.0&ipbits=0&expire=9999999999&sparams=ip%2Cipbits%2Cexpire%2Cv%2Ccaps%2Cxoaf&signature=MOCK&key=yt8`
  const playerResponse = {
    videoDetails: { videoId: VIDEO_ID, title: '한국어 브이로그 · Korean vlog (mock)', author: 'LEATCH Test Channel', lengthSeconds: '30', thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/mock/hqdefault.jpg' }] } },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [{ baseUrl: `${base}&lang=ko`, languageCode: 'ko', name: { simpleText: 'Korean' }, vssId: '.ko', isTranslatable: true }],
        translationLanguages: [{ languageCode: 'en', languageName: { simpleText: 'English' } }, { languageCode: 'ja', languageName: { simpleText: 'Japanese' } }],
      },
    },
  }
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Mock YouTube</title>
<style>
  body { margin: 0; background: #0f0f0f; font-family: Roboto, Arial, sans-serif; color: #fff; }
  #movie_player { position: relative; width: 1120px; height: 630px; margin: 24px auto; background: #000; overflow: hidden; }
  #movie_player video { width: 100%; height: 100%; }
  .ytp-caption-window-container { position: absolute; bottom: 60px; width: 100%; text-align: center; font-size: 22px; }
  .ytp-subtitles-button { position: absolute; bottom: 8px; right: 8px; }
  h1 { width: 1120px; margin: 0 auto; font-size: 20px; }
</style></head>
<body>
  <div id="movie_player" class="html5-video-player ytp-autohide">
    <video class="html5-main-video" src="/leatch-test/video.webm" muted playsinline></video>
    <div class="ytp-caption-window-container">NATIVE YOUTUBE CAPTION</div>
    <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
  </div>
  <h1>한국어 브이로그 · Korean vlog (mock)</h1>
  <script>
    window.ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};
    document.getElementById('movie_player').getPlayerResponse = () => window.ytInitialPlayerResponse;
  </script>
</body></html>`
}
