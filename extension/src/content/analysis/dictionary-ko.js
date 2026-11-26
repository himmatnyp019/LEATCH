/**
 * Offline starter dictionary for learners of Korean (meanings in English).
 * Used when AI analysis is unavailable. Each entry carries two example sentences.
 *
 * Word matchers:
 *   noun:   exact token, optionally followed by a particle (친구가, 친구랑 …)
 *   exact:  exact token (adverbs)
 *   hada:   하다-verb base; matches 생각해요 / 생각했어 / 생각할 … (and the bare noun when `noun: true`)
 *   prefix: token starts with one of the given conjugation stems
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const { finalOf, isInfinitiveSyllable } = LEATCH.korean

  const ex = (pairs) => pairs.map(([text, translation]) => ({ text, translation }))

  /** Returns a finder that yields the first regex match accepted by `check`. */
  const find = (pattern, check) => (text) => {
    for (const match of text.matchAll(pattern)) if (!check || check(match)) return match[0].trim()
    return null
  }
  const endsWithFinal = (word, final) => finalOf(word.at(-1)) === final
  const NOUNS_ENDING_IN_MYEON = new Set(['라면', '화면', '장면', '표면', '측면', '반면', '정면', '전면', '방면', '국면', '수면', '이면'])

  const grammar = (lemma, meaning, reading, level, finder, examples) => ({
    lemma, type: 'grammar', pos: 'pattern', meaning, reading, level, find: finder, examples: ex(examples),
  })
  const word = (lemma, pos, reading, meaning, level, match, examples) => ({
    lemma, type: 'vocab', pos, reading, meaning, level, match, examples: ex(examples),
  })

  const GRAMMAR = [
    grammar('-고 싶다', 'want to (do)', '-go sipda', 1, find(/[가-힣]+고\s?싶[가-힣]*/g), [
      ['한국에 가고 싶어요.', 'I want to go to Korea.'],
      ['오늘은 집에서 쉬고 싶어.', 'I want to rest at home today.'],
    ]),
    grammar('-(으)ㄹ 수 있다/없다', 'can / cannot', '-(eu)l su itda', 2,
      find(/([가-힣]+)\s?수\s?(있|없)[가-힣]*/g, (m) => endsWithFinal(m[1], 'ㄹ')), [
        ['저는 한국어를 읽을 수 있어요.', 'I can read Korean.'],
        ['지금은 갈 수 없어요.', "I can't go right now."],
      ]),
    grammar('-아/어서', 'so, because; and then', '-a/eoseo', 1,
      find(/[가-힣]*([가-힣])서(?=[\s,.!?]|$)/g, (m) => m[0].length >= 2 && isInfinitiveSyllable(m[1])), [
        ['배가 아파서 병원에 갔어요.', 'My stomach hurt, so I went to the hospital.'],
        ['친구를 만나서 같이 밥을 먹었어요.', 'I met a friend and we ate together.'],
      ]),
    grammar('-지만', 'but, although', '-jiman', 1, find(/[가-힣]+지만/g), [
      ['비싸지만 맛있어요.', "It's expensive but delicious."],
      ['한국어는 어렵지만 재미있어요.', 'Korean is hard but fun.'],
    ]),
    grammar('-는데 / -(으)ㄴ데', 'and/but (giving background)', '-neunde', 2,
      find(/[가-힣]*([가-힣])데(요)?(?=[\s,.!?]|$)/g, (m) => m[1] === '는' || finalOf(m[1]) === 'ㄴ'), [
        ['비가 오는데 우산이 없어요.', "It's raining, but I don't have an umbrella."],
        ['배고픈데 뭐 먹을까요?', "I'm hungry — shall we eat something?"],
      ]),
    grammar('-(으)니까', 'because, since', '-(eu)nikka', 2, find(/[가-힣]+니까/g), [
      ['늦었으니까 택시를 타요.', "It's late, so let's take a taxi."],
      ['추우니까 따뜻하게 입으세요.', "It's cold, so dress warmly."],
    ]),
    grammar('-고 있다', 'be ~ing (in progress)', '-go itda', 1,
      find(/[가-힣]+고\s?(있|계)[가-힣]*/g, (m) => !m[0].includes('싶')), [
        ['지금 공부하고 있어요.', "I'm studying now."],
        ['친구를 기다리고 있어.', "I'm waiting for a friend."],
      ]),
    grammar('-(으)ㄹ 거예요', 'will; be going to', '-(eu)l geoyeyo', 1,
      find(/([가-힣]+)\s?(거예요|거에요|거야|겁니다|거지|거라)/g, (m) => endsWithFinal(m[1], 'ㄹ')), [
        ['내일 친구를 만날 거예요.', "I'm going to meet a friend tomorrow."],
        ['주말에 뭐 할 거야?', 'What are you going to do this weekend?'],
      ]),
    grammar('-아/어야 하다', 'have to, must', '-a/eoya hada', 2,
      find(/[가-힣]+야\s?(해|하|돼|되|합|됩|했|됐)[가-힣]*/g, (m) => !/^(이야|거야|뭐야)/.test(m[0])), [
        ['오늘까지 숙제를 해야 해요.', 'I have to finish my homework by today.'],
        ['내일 일찍 일어나야 돼.', 'I have to get up early tomorrow.'],
      ]),
    grammar('-아/어도 되다', 'may; it is okay to', '-a/eodo doeda', 2,
      find(/([가-힣]+)도\s?(돼|되|됩|괜찮)[가-힣]*/g, (m) => isInfinitiveSyllable(m[1].at(-1))), [
        ['여기 앉아도 돼요?', 'May I sit here?'],
        ['사진 찍어도 괜찮아요.', "It's okay to take pictures."],
      ]),
    grammar('-(으)면 안 되다', 'must not', '-(eu)myeon an doeda', 2, find(/[가-힣]+면\s?안\s?(돼|되|됩)[가-힣]*/g), [
      ['여기서 담배를 피우면 안 돼요.', 'You must not smoke here.'],
      ['늦으면 안 돼.', "You can't be late."],
    ]),
    grammar('-(으)면', 'if, when', '-(eu)myeon', 1,
      find(/[가-힣]+면(?=[\s,.!?]|$)/g, (m) => !NOUNS_ENDING_IN_MYEON.has(m[0])), [
        ['시간이 있으면 같이 영화 봐요.', "If you have time, let's watch a movie together."],
        ['피곤하면 좀 쉬세요.', "If you're tired, take a rest."],
      ]),
    grammar('-(으)려고', 'in order to; intending to', '-(eu)ryeogo', 2, find(/[가-힣]+려고/g), [
      ['한국어를 배우려고 학원에 다녀요.', 'I go to an academy to learn Korean.'],
      ['지금 나가려고 했어요.', 'I was just about to go out.'],
    ]),
    grammar('-기 때문에', 'because (of)', '-gi ttaemune', 2, find(/[가-힣]*\s?때문[가-힣]*/g), [
      ['비가 오기 때문에 집에 있어요.', "I'm staying home because it's raining."],
      ['너 때문에 웃었어.', 'I laughed because of you.'],
    ]),
    grammar('-(으)ㄴ 적이 있다', 'have (ever) done', '-(eu)n jeogi itda', 2,
      find(/([가-힣]+)\s?적(이|도|은)?\s?(있|없)[가-힣]*/g, (m) => endsWithFinal(m[1], 'ㄴ')), [
        ['한국에 가 본 적이 있어요?', 'Have you ever been to Korea?'],
        ['그런 말은 들은 적이 없어요.', "I've never heard that."],
      ]),
    grammar('-네요', 'oh, … ! (surprise, admiration)', '-neyo', 2, find(/[가-힣]+네요/g), [
      ['날씨가 정말 좋네요!', 'The weather is really nice!'],
      ['한국어를 잘하시네요.', 'You speak Korean well!'],
    ]),
    grammar('-잖아(요)', 'you know; as you know', '-janayo', 3, find(/[가-힣]+잖아[가-힣]*/g), [
      ['내가 말했잖아.', 'I told you, didn’t I?'],
      ['오늘 주말이잖아요.', "It's the weekend today, you know."],
    ]),
    grammar('-거든(요)', 'because, you see (giving a reason)', '-geodeunyo', 3, find(/[가-힣]+거든[가-힣]*/g), [
      ['오늘은 못 가요. 약속이 있거든요.', "I can't go today. I have plans, you see."],
      ['그 영화 진짜 재밌거든.', 'That movie is really fun, you know.'],
    ]),
    grammar('-죠 (-지요)', '…, right? / let’s', '-jyo', 2, find(/[가-힣]+(죠|지요)(?=[\s,.!?~]|$)/g), [
      ['이거 맛있죠?', 'This is tasty, right?'],
      ['같이 가시죠.', "Let's go together."],
    ]),
    grammar('-(으)세요', 'please do; (polite/honorific)', '-(eu)seyo', 1,
      find(/[가-힣]+(세요|십시오|셔요)/g, (m) => !m[0].endsWith('주세요')), [
        ['여기 앉으세요.', 'Please sit here.'],
        ['어디 가세요?', 'Where are you going?'],
      ]),
    grammar('-(으)ㄹ게(요)', "I'll … (promise, intention)", '-(eu)lgeyo', 2,
      find(/[가-힣]*([가-힣])게(요)?(?=[\s,.!?~]|$)/g, (m) => finalOf(m[1]) === 'ㄹ'), [
        ['내일 전화할게요.', "I'll call you tomorrow."],
        ['금방 갈게.', "I'll be right there."],
      ]),
    grammar('-(으)ㄹ까요?', 'shall we …? / do you think …?', '-(eu)lkkayo', 2,
      find(/[가-힣]*([가-힣])까(요)?(?=[\s,.!?~]|$)/g, (m) => finalOf(m[1]) === 'ㄹ'), [
        ['같이 점심 먹을까요?', 'Shall we have lunch together?'],
        ['내일 비가 올까요?', 'Do you think it will rain tomorrow?'],
      ]),
    grammar('-아/어 주다', 'do something for someone', '-a/eo juda', 2,
      find(/([가-힣]+)\s?(주세요|줘요|줘|줬|줄래|주실|주시|줄게|줄까|주면)/g, (m) => isInfinitiveSyllable(m[1].at(-1))), [
        ['잠깐만 기다려 주세요.', 'Please wait a moment.'],
        ['이것 좀 도와줄래?', 'Can you help me with this?'],
      ]),
    grammar('-게 되다', 'end up; come to (do)', '-ge doeda', 3, find(/[가-힣]+게\s?(됐|되|돼|됩)[가-힣]*/g), [
      ['한국에서 일하게 됐어요.', 'I ended up working in Korea.'],
      ['그 사람을 좋아하게 됐어.', 'I came to like that person.'],
    ]),
    grammar('-(으)ㄴ/는 것 같다', 'it seems; I think', '-neun geot gatda', 2, find(/[가-힣]+\s?(것|거)\s?같[가-힣]*/g), [
      ['비가 올 것 같아요.', 'It looks like it’s going to rain.'],
      ['그 사람 화난 것 같아.', 'I think that person is angry.'],
    ]),
    grammar('-(으)면서', 'while (doing)', '-(eu)myeonseo', 2, find(/[가-힣]+면서/g), [
      ['음악을 들으면서 공부해요.', 'I study while listening to music.'],
      ['걸으면서 이야기했어요.', 'We talked while walking.'],
    ]),
    grammar('-(으)ㄹ 때', 'when (at the time)', '-(eu)l ttae', 2,
      find(/([가-힣]+)\s때[가-힣]*/g, (m) => endsWithFinal(m[1], 'ㄹ')), [
        ['어렸을 때 부산에 살았어요.', 'I lived in Busan when I was young.'],
        ['시간 있을 때 연락해.', 'Get in touch when you have time.'],
      ]),
    grammar('-다고/라고 하다', '(someone) says that …', '-dago hada', 3,
      find(/[가-힣]+(다고|라고|냐고|자고)\s?(해|하|했|합|들었|그러)[가-힣]*/g), [
        ['친구가 내일 온다고 했어요.', 'My friend said they would come tomorrow.'],
        ['이름이 민수라고 해요.', 'He says his name is Minsu.'],
      ]),
    grammar('-기로 하다', 'decide to', '-giro hada', 3, find(/[가-힣]+기로\s?(했|하|해|합)[가-힣]*/g), [
      ['다음 달에 이사하기로 했어요.', 'We decided to move next month.'],
      ['운동을 시작하기로 했어.', 'I decided to start working out.'],
    ]),
    grammar('-지 않다', 'not (negation)', '-ji anta', 1, find(/[가-힣]+지\s?않[가-힣]*/g), [
      ['오늘은 춥지 않아요.', "It's not cold today."],
      ['그 영화는 보지 않았어.', "I didn't watch that movie."],
    ]),
    grammar('-지 마(세요)', "don't (do)", '-ji maseyo', 1, find(/[가-힣]+지\s?마(세요|요|라)?(?=[\s,.!?~]|$)/g), [
      ['걱정하지 마세요.', "Don't worry."],
      ['울지 마.', "Don't cry."],
    ]),
  ]

  const WORDS = [
    // --- nouns ---
    word('시간', 'noun', 'sigan', 'time; hour', 1, { noun: ['시간'] }, [
      ['시간이 정말 빨리 가요.', 'Time goes by really fast.'],
      ['오늘은 시간이 없어요.', "I don't have time today."],
    ]),
    word('친구', 'noun', 'chingu', 'friend', 1, { noun: ['친구'] }, [
      ['주말에 친구를 만나요.', 'I meet my friend on the weekend.'],
      ['우리는 오래된 친구예요.', "We're old friends."],
    ]),
    word('가족', 'noun', 'gajok', 'family', 1, { noun: ['가족'] }, [
      ['가족이랑 여행을 갔어요.', 'I went on a trip with my family.'],
      ['가족이 몇 명이에요?', 'How many people are in your family?'],
    ]),
    word('음식', 'noun', 'eumsik', 'food', 1, { noun: ['음식'] }, [
      ['한국 음식을 좋아해요.', 'I like Korean food.'],
      ['이 음식은 너무 매워요.', 'This food is too spicy.'],
    ]),
    word('날씨', 'noun', 'nalssi', 'weather', 1, { noun: ['날씨'] }, [
      ['오늘 날씨가 좋네요.', 'The weather is nice today.'],
      ['날씨가 추워졌어요.', 'The weather got cold.'],
    ]),
    word('기분', 'noun', 'gibun', 'mood, feeling', 1, { noun: ['기분'] }, [
      ['오늘 기분이 어때요?', 'How are you feeling today?'],
      ['기분이 너무 좋아!', 'I feel so good!'],
    ]),
    word('마음', 'noun', 'maeum', 'heart, mind', 2, { noun: ['마음'] }, [
      ['마음이 아파요.', 'My heart aches.'],
      ['그 마음 알아요.', 'I know how you feel.'],
    ]),
    word('회사', 'noun', 'hoesa', 'company, office', 1, { noun: ['회사'] }, [
      ['아빠는 회사에 가셨어요.', 'Dad went to the office.'],
      ['회사가 집에서 멀어요.', 'My company is far from home.'],
    ]),
    word('문제', 'noun', 'munje', 'problem; question', 2, { noun: ['문제'] }, [
      ['문제가 생겼어요.', 'A problem came up.'],
      ['이 문제는 너무 어려워요.', 'This question is too hard.'],
    ]),
    word('세상', 'noun', 'sesang', 'the world', 2, { noun: ['세상'] }, [
      ['세상에서 제일 맛있어요.', "It's the tastiest in the world."],
      ['세상이 많이 변했어요.', 'The world has changed a lot.'],
    ]),
    word('경험', 'noun', 'gyeongheom', 'experience', 2, { noun: ['경험'] }, [
      ['좋은 경험이었어요.', 'It was a good experience.'],
      ['일한 경험이 있어요?', 'Do you have work experience?'],
    ]),
    word('계획', 'noun', 'gyehoek', 'plan', 2, { noun: ['계획'] }, [
      ['주말 계획이 있어요?', 'Do you have plans for the weekend?'],
      ['계획대로 됐어요.', 'It went according to plan.'],
    ]),
    word('소리', 'noun', 'sori', 'sound, noise', 2, { noun: ['소리'] }, [
      ['무슨 소리예요?', 'What is that sound?'],
      ['소리 좀 줄여 주세요.', 'Please turn the volume down.'],
    ]),
    word('사진', 'noun', 'sajin', 'photo', 1, { noun: ['사진'] }, [
      ['사진 좀 찍어 주세요.', 'Please take a photo for me.'],
      ['이 사진 정말 예뻐요.', 'This photo is really pretty.'],
    ]),
    word('노래', 'noun', 'norae', 'song', 1, { noun: ['노래'] }, [
      ['이 노래 알아요?', 'Do you know this song?'],
      ['노래를 잘 불러요.', 'She sings well.'],
    ]),
    word('선물', 'noun', 'seonmul', 'gift, present', 1, { noun: ['선물'] }, [
      ['생일 선물이에요.', "It's a birthday present."],
      ['선물 고마워요!', 'Thanks for the gift!'],
    ]),
    word('대박', 'noun', 'daebak', 'awesome!; a huge hit', 3, { noun: ['대박'] }, [
      ['와, 대박!', 'Wow, awesome!'],
      ['그 영화 대박 났어요.', 'That movie was a huge hit.'],
    ]),
    // --- adverbs ---
    word('진짜', 'adverb', 'jinjja', 'really; real', 1, { exact: ['진짜', '진짜로', '진짜요'] }, [
      ['진짜 맛있어요!', "It's really delicious!"],
      ['진짜요? 몰랐어요.', "Really? I didn't know."],
    ]),
    word('정말', 'adverb', 'jeongmal', 'really, truly', 1, { exact: ['정말', '정말로', '정말요'] }, [
      ['정말 고마워요.', 'Thank you so much.'],
      ['정말 그렇게 생각해요?', 'Do you really think so?'],
    ]),
    word('너무', 'adverb', 'neomu', 'too; so (very)', 1, { exact: ['너무'] }, [
      ['너무 피곤해요.', "I'm so tired."],
      ['이 가방은 너무 비싸요.', 'This bag is too expensive.'],
    ]),
    word('갑자기', 'adverb', 'gapjagi', 'suddenly', 2, { exact: ['갑자기'] }, [
      ['갑자기 비가 왔어요.', 'It suddenly rained.'],
      ['갑자기 왜 그래?', 'Why are you acting like that all of a sudden?'],
    ]),
    word('벌써', 'adverb', 'beolsseo', 'already', 2, { exact: ['벌써'] }, [
      ['벌써 열 시예요.', "It's already ten o'clock."],
      ['벌써 다 먹었어요?', 'You ate it all already?'],
    ]),
    word('아직', 'adverb', 'ajik', 'still; (not) yet', 1, { exact: ['아직', '아직도'] }, [
      ['아직 안 끝났어요.', "It's not finished yet."],
      ['아직도 자요?', 'Are you still sleeping?'],
    ]),
    word('같이', 'adverb', 'gachi', 'together', 1, { exact: ['같이'] }, [
      ['같이 가요!', "Let's go together!"],
      ['친구랑 같이 살아요.', 'I live with a friend.'],
    ]),
    word('혼자', 'noun', 'honja', 'alone, by oneself', 2, { noun: ['혼자'] }, [
      ['혼자 여행했어요.', 'I traveled alone.'],
      ['혼자서 할 수 있어요.', 'I can do it by myself.'],
    ]),
    word('다시', 'adverb', 'dasi', 'again', 1, { exact: ['다시'] }, [
      ['다시 한번 말해 주세요.', 'Please say it once more.'],
      ['내일 다시 올게요.', "I'll come again tomorrow."],
    ]),
    word('항상', 'adverb', 'hangsang', 'always', 2, { exact: ['항상'] }, [
      ['항상 고마워요.', "I'm always grateful."],
      ['그는 항상 늦어요.', 'He is always late.'],
    ]),
    word('가끔', 'adverb', 'gakkeum', 'sometimes', 2, { exact: ['가끔', '가끔씩'] }, [
      ['가끔 영화를 봐요.', 'I sometimes watch movies.'],
      ['가끔 생각나요.', 'I think of it sometimes.'],
    ]),
    word('빨리', 'adverb', 'ppalli', 'quickly, fast', 1, { exact: ['빨리'] }, [
      ['빨리 와!', 'Come quickly!'],
      ['시간이 빨리 지나갔어요.', 'Time passed quickly.'],
    ]),
    word('천천히', 'adverb', 'cheoncheonhi', 'slowly', 2, { exact: ['천천히'] }, [
      ['천천히 말해 주세요.', 'Please speak slowly.'],
      ['천천히 드세요.', 'Take your time eating.'],
    ]),
    word('열심히', 'adverb', 'yeolsimhi', 'hard, diligently', 2, { exact: ['열심히'] }, [
      ['열심히 공부했어요.', 'I studied hard.'],
      ['열심히 할게요!', "I'll do my best!"],
    ]),
    word('그냥', 'adverb', 'geunyang', 'just; for no reason', 2, { exact: ['그냥'] }, [
      ['그냥 집에 있을래요.', "I'll just stay home."],
      ['그냥 궁금해서요.', 'I was just curious.'],
    ]),
    word('아마', 'adverb', 'ama', 'probably, maybe', 2, { exact: ['아마', '아마도'] }, [
      ['아마 내일 올 거예요.', "They'll probably come tomorrow."],
      ['아마 맞을 거야.', "It's probably right."],
    ]),
    word('제일', 'adverb', 'jeil', 'the most; number one', 2, { exact: ['제일'] }, [
      ['이게 제일 좋아요.', 'I like this one the most.'],
      ['제일 친한 친구예요.', "She's my best friend."],
    ]),
    word('나중에', 'adverb', 'najunge', 'later', 2, { exact: ['나중에'] }, [
      ['나중에 전화할게요.', "I'll call you later."],
      ['나중에 봐요!', 'See you later!'],
    ]),
    word('꼭', 'adverb', 'kkok', 'surely, without fail', 2, { exact: ['꼭'] }, [
      ['꼭 다시 올게요.', "I'll definitely come again."],
      ['꼭 가 보세요.', 'You should definitely go.'],
    ]),
    word('완전', 'adverb', 'wanjeon', 'totally (casual)', 3, { exact: ['완전', '완전히'] }, [
      ['완전 좋아!', 'I totally love it!'],
      ['완전히 잊어버렸어요.', 'I completely forgot.'],
    ]),
    word('엄청', 'adverb', 'eomcheong', 'extremely, super', 3, { exact: ['엄청'] }, [
      ['엄청 추워요.', "It's super cold."],
      ['사람이 엄청 많아요.', 'There are so many people.'],
    ]),
    word('솔직히', 'adverb', 'soljiki', 'honestly', 2, { exact: ['솔직히'] }, [
      ['솔직히 잘 모르겠어요.', "Honestly, I'm not sure."],
      ['솔직히 말하면 좀 무서웠어.', 'To be honest, I was a bit scared.'],
    ]),
    // --- 하다 verbs / adjectives ---
    word('생각하다', 'verb', 'saenggakada', 'to think; thought', 1, { hada: '생각', noun: true }, [
      ['어떻게 생각해요?', 'What do you think?'],
      ['좋은 생각이에요!', "That's a good idea!"],
    ]),
    word('공부하다', 'verb', 'gongbuhada', 'to study', 1, { hada: '공부', noun: true }, [
      ['도서관에서 공부해요.', 'I study at the library.'],
      ['한국어 공부는 재미있어요.', 'Studying Korean is fun.'],
    ]),
    word('좋아하다', 'verb', 'joahada', 'to like', 1, { hada: '좋아' }, [
      ['저는 커피를 좋아해요.', 'I like coffee.'],
      ['무슨 음악을 좋아해요?', 'What music do you like?'],
    ]),
    word('싫어하다', 'verb', 'sireohada', 'to dislike, hate', 2, { hada: '싫어' }, [
      ['저는 벌레를 싫어해요.', 'I hate bugs.'],
      ['고양이는 물을 싫어해요.', 'Cats dislike water.'],
    ]),
    word('시작하다', 'verb', 'sijakada', 'to start, begin', 1, { hada: '시작', noun: true }, [
      ['수업은 9시에 시작해요.', 'Class starts at nine.'],
      ['이제 시작해 볼까요?', 'Shall we get started?'],
    ]),
    word('걱정하다', 'verb', 'geokjeonghada', 'to worry; worry', 2, { hada: '걱정', noun: true }, [
      ['걱정하지 마세요.', "Don't worry."],
      ['걱정이 많아요.', 'I have a lot of worries.'],
    ]),
    word('준비하다', 'verb', 'junbihada', 'to prepare, get ready', 2, { hada: '준비', noun: true }, [
      ['저녁을 준비하고 있어요.', "I'm preparing dinner."],
      ['준비됐어요?', 'Are you ready?'],
    ]),
    word('연습하다', 'verb', 'yeonseupada', 'to practice', 2, { hada: '연습', noun: true }, [
      ['매일 피아노를 연습해요.', 'I practice piano every day.'],
      ['연습이 필요해요.', 'It needs practice.'],
    ]),
    word('결혼하다', 'verb', 'gyeolhonhada', 'to get married', 2, { hada: '결혼', noun: true }, [
      ['언니가 다음 달에 결혼해요.', 'My older sister is getting married next month.'],
      ['결혼 축하해요!', 'Congratulations on your wedding!'],
    ]),
    word('사랑하다', 'verb', 'saranghada', 'to love; love', 1, { hada: '사랑', noun: true }, [
      ['사랑해요.', 'I love you.'],
      ['첫사랑을 아직 기억해요.', 'I still remember my first love.'],
    ]),
    word('약속하다', 'verb', 'yaksokada', 'to promise; plans', 2, { hada: '약속', noun: true }, [
      ['오늘 저녁에 약속이 있어요.', 'I have plans this evening.'],
      ['다시는 안 늦겠다고 약속해요.', 'I promise I won’t be late again.'],
    ]),
    word('이야기하다', 'verb', 'iyagihada', 'to talk; story', 1, { hada: '이야기', noun: true, extraNouns: ['얘기'] }, [
      ['나중에 이야기해요.', "Let's talk later."],
      ['재미있는 얘기 해 줘.', 'Tell me a fun story.'],
    ]),
    word('기억하다', 'verb', 'gieokada', 'to remember; memory', 2, { hada: '기억', noun: true }, [
      ['제 이름 기억해요?', 'Do you remember my name?'],
      ['좋은 기억이 많아요.', 'I have many good memories.'],
    ]),
    word('여행하다', 'verb', 'yeohaenghada', 'to travel; trip', 1, { hada: '여행', noun: true }, [
      ['혼자 여행하는 걸 좋아해요.', 'I like traveling alone.'],
      ['여행 어땠어요?', 'How was your trip?'],
    ]),
    word('운동하다', 'verb', 'undonghada', 'to exercise', 1, { hada: '운동', noun: true }, [
      ['매일 아침 운동해요.', 'I exercise every morning.'],
      ['운동이 건강에 좋아요.', 'Exercise is good for your health.'],
    ]),
    word('노력하다', 'verb', 'noryeokada', 'to make an effort', 2, { hada: '노력', noun: true }, [
      ['더 노력할게요.', "I'll try harder."],
      ['노력하면 할 수 있어요.', 'If you try, you can do it.'],
    ]),
    word('이해하다', 'verb', 'ihaehada', 'to understand', 2, { hada: '이해', noun: true }, [
      ['이해했어요?', 'Did you understand?'],
      ['네 마음 이해해.', 'I understand how you feel.'],
    ]),
    word('설명하다', 'verb', 'seolmyeonghada', 'to explain', 2, { hada: '설명', noun: true }, [
      ['다시 설명해 주세요.', 'Please explain it again.'],
      ['설명이 너무 길어요.', 'The explanation is too long.'],
    ]),
    word('실수하다', 'verb', 'silsuhada', 'to make a mistake', 2, { hada: '실수', noun: true }, [
      ['괜찮아요, 누구나 실수해요.', "It's okay, everyone makes mistakes."],
      ['제 실수예요.', 'It’s my mistake.'],
    ]),
    word('포기하다', 'verb', 'pogihada', 'to give up', 3, { hada: '포기', noun: true }, [
      ['포기하지 마!', "Don't give up!"],
      ['결국 포기했어요.', 'In the end I gave up.'],
    ]),
    word('후회하다', 'verb', 'huhoehada', 'to regret', 3, { hada: '후회', noun: true }, [
      ['후회하지 않아요.', "I don't regret it."],
      ['나중에 후회할 거야.', "You'll regret it later."],
    ]),
    word('고민하다', 'verb', 'gominhada', 'to agonize over; a concern', 3, { hada: '고민', noun: true }, [
      ['뭘 먹을지 고민하고 있어요.', "I'm trying to decide what to eat."],
      ['요즘 고민이 있어요.', "I've had something on my mind lately."],
    ]),
    word('행복하다', 'adjective', 'haengbokada', 'to be happy; happiness', 2, { hada: '행복', noun: true }, [
      ['지금 정말 행복해요.', "I'm really happy right now."],
      ['행복은 가까이에 있어요.', 'Happiness is close by.'],
    ]),
    word('피곤하다', 'adjective', 'pigonhada', 'to be tired', 1, { hada: '피곤' }, [
      ['오늘 너무 피곤해요.', "I'm so tired today."],
      ['피곤하면 일찍 자.', "If you're tired, go to bed early."],
    ]),
    word('중요하다', 'adjective', 'jungyohada', 'to be important', 2, { hada: '중요' }, [
      ['건강이 제일 중요해요.', 'Health is the most important thing.'],
      ['중요한 회의가 있어요.', 'I have an important meeting.'],
    ]),
    word('필요하다', 'adjective', 'piryohada', 'to be needed, need', 2, { hada: '필요', noun: true }, [
      ['도움이 필요해요.', 'I need help.'],
      ['필요한 거 있으면 말해.', 'Tell me if you need anything.'],
    ]),
    word('미안하다', 'adjective', 'mianhada', 'to be sorry', 1, { hada: '미안' }, [
      ['늦어서 미안해요.', "I'm sorry I'm late."],
      ['정말 미안해.', "I'm really sorry."],
    ]),
    word('궁금하다', 'adjective', 'gunggeumhada', 'to be curious, wonder', 2, { hada: '궁금' }, [
      ['결과가 궁금해요.', "I'm curious about the result."],
      ['궁금한 거 있어요?', 'Do you have any questions?'],
    ]),
    word('신기하다', 'adjective', 'singihada', 'to be amazing, fascinating', 3, { hada: '신기' }, [
      ['와, 진짜 신기하다!', 'Wow, that’s amazing!'],
      ['신기한 경험이었어요.', 'It was a fascinating experience.'],
    ]),
    word('대단하다', 'adjective', 'daedanhada', 'to be impressive, great', 2, { hada: '대단' }, [
      ['정말 대단해요!', "That's really impressive!"],
      ['대단한 사람이에요.', "He's an amazing person."],
    ]),
    word('유명하다', 'adjective', 'yumyeonghada', 'to be famous', 2, { hada: '유명' }, [
      ['이 식당은 유명해요.', 'This restaurant is famous.'],
      ['유명한 가수예요.', "She's a famous singer."],
    ]),
    word('조용하다', 'adjective', 'joyonghada', 'to be quiet', 2, { hada: '조용' }, [
      ['도서관은 조용해요.', 'The library is quiet.'],
      ['조용히 해 주세요.', 'Please be quiet.'],
    ]),
    word('깨끗하다', 'adjective', 'kkaekkeutada', 'to be clean', 2, { hada: '깨끗' }, [
      ['방이 깨끗해요.', 'The room is clean.'],
      ['손을 깨끗하게 씻으세요.', 'Wash your hands clean.'],
    ]),
    // --- other verbs / adjectives ---
    word('먹다', 'verb', 'meokda', 'to eat', 1, { prefix: ['먹'] }, [
      ['밥 먹었어요?', 'Have you eaten?'],
      ['매운 음식을 잘 먹어요.', 'I can eat spicy food well.'],
    ]),
    word('읽다', 'verb', 'ikda', 'to read', 1, { prefix: ['읽'] }, [
      ['책 읽는 걸 좋아해요.', 'I like reading books.'],
      ['이거 읽어 봤어요?', 'Have you read this?'],
    ]),
    word('찾다', 'verb', 'chatda', 'to find, look for', 1, { prefix: ['찾'] }, [
      ['열쇠를 찾고 있어요.', "I'm looking for my keys."],
      ['드디어 찾았다!', 'Finally found it!'],
    ]),
    word('웃다', 'verb', 'utda', 'to laugh, smile', 1, { prefix: ['웃'] }, [
      ['아기가 웃어요.', 'The baby is smiling.'],
      ['너무 웃겨서 많이 웃었어요.', 'It was so funny that I laughed a lot.'],
    ]),
    word('잊다', 'verb', 'itda', 'to forget', 2, { prefix: ['잊'] }, [
      ['약속을 잊어버렸어요.', 'I forgot about our plans.'],
      ['절대 안 잊을게요.', "I'll never forget."],
    ]),
    word('기다리다', 'verb', 'gidarida', 'to wait', 1, { prefix: ['기다리', '기다려', '기다렸', '기다릴', '기다린'] }, [
      ['여기서 기다릴게요.', "I'll wait here."],
      ['오래 기다렸어요?', 'Did you wait long?'],
    ]),
    word('만나다', 'verb', 'mannada', 'to meet', 1, { prefix: ['만나', '만났', '만날', '만난'] }, [
      ['만나서 반가워요.', 'Nice to meet you.'],
      ['내일 어디서 만날까요?', 'Where shall we meet tomorrow?'],
    ]),
    word('배우다', 'verb', 'baeuda', 'to learn', 1, { prefix: ['배우', '배워', '배웠', '배울', '배운'] }, [
      ['요즘 기타를 배워요.', "I'm learning guitar these days."],
      ['어디서 한국어를 배웠어요?', 'Where did you learn Korean?'],
    ]),
    word('가르치다', 'verb', 'gareuchida', 'to teach', 1, { prefix: ['가르치', '가르쳐', '가르쳤', '가르칠', '가르친'] }, [
      ['영어를 가르쳐요.', 'I teach English.'],
      ['방법 좀 가르쳐 주세요.', 'Please teach me how.'],
    ]),
    word('마시다', 'verb', 'masida', 'to drink', 1, { prefix: ['마시', '마셔', '마셨', '마실', '마신'] }, [
      ['물 좀 마셔요.', 'Drink some water.'],
      ['커피 마실래요?', 'Would you like some coffee?'],
    ]),
    word('일어나다', 'verb', 'ireonada', 'to get up, wake up; happen', 1, { prefix: ['일어나', '일어났', '일어날', '일어난'] }, [
      ['몇 시에 일어나요?', 'What time do you get up?'],
      ['무슨 일이 일어났어요?', 'What happened?'],
    ]),
    word('끝나다', 'verb', 'kkeunnada', 'to end, be over', 2, { prefix: ['끝나', '끝났', '끝날', '끝난'] }, [
      ['수업이 끝났어요.', 'Class is over.'],
      ['언제 끝나요?', 'When does it end?'],
    ]),
    word('모르다', 'verb', 'moreuda', 'to not know', 1, { prefix: ['모르', '몰라', '몰랐', '모를', '모른'] }, [
      ['잘 모르겠어요.', "I'm not sure."],
      ['그건 몰랐어요.', "I didn't know that."],
    ]),
    word('알다', 'verb', 'alda', 'to know', 1, { prefix: ['알아', '알았', '알고', '알면', '안다', '압니', '알지', '알겠'] }, [
      ['그 사람 알아요?', 'Do you know that person?'],
      ['알겠습니다.', 'Understood.'],
    ]),
    word('듣다', 'verb', 'deutda', 'to listen, hear', 1, { prefix: ['듣', '들었', '들어요', '들을', '들으'] }, [
      ['음악을 들어요.', "I'm listening to music."],
      ['그 소식 들었어요?', 'Did you hear the news?'],
    ]),
    word('울다', 'verb', 'ulda', 'to cry', 1, { prefix: ['울어', '울었', '울고', '울지', '우는', '운다', '울면'] }, [
      ['영화 보고 울었어요.', 'I cried watching the movie.'],
      ['울지 마세요.', "Please don't cry."],
    ]),
    word('살다', 'verb', 'salda', 'to live', 1, { prefix: ['살아', '살았', '살고', '산다', '살면', '삽니'] }, [
      ['서울에 살아요.', 'I live in Seoul.'],
      ['어디 살아요?', 'Where do you live?'],
    ]),
    word('돕다', 'verb', 'dopda', 'to help', 2, { prefix: ['돕', '도와', '도왔', '도울', '도운'] }, [
      ['제가 도와 드릴게요.', 'Let me help you.'],
      ['도와줘서 고마워.', 'Thanks for helping me.'],
    ]),
    word('힘들다', 'adjective', 'himdeulda', 'to be hard, tough, tiring', 2, { prefix: ['힘들', '힘든', '힘드'] }, [
      ['요즘 일이 힘들어요.', 'Work is tough these days.'],
      ['힘들면 말해.', "Tell me if it's too hard."],
    ]),
    word('재미있다', 'adjective', 'jaemiitda', 'to be fun, interesting', 1, { prefix: ['재미있', '재밌'] }, [
      ['이 드라마 재미있어요.', 'This drama is fun.'],
      ['재밌게 놀아!', 'Have fun!'],
    ]),
    word('맛있다', 'adjective', 'masitda', 'to be delicious', 1, { prefix: ['맛있'] }, [
      ['진짜 맛있어요!', "It's really delicious!"],
      ['맛있게 드세요.', 'Enjoy your meal.'],
    ]),
    word('괜찮다', 'adjective', 'gwaenchanta', 'to be okay, fine', 1, { prefix: ['괜찮'] }, [
      ['괜찮아요?', 'Are you okay?'],
      ['저는 괜찮아요.', "I'm fine."],
    ]),
    word('바쁘다', 'adjective', 'bappeuda', 'to be busy', 1, { prefix: ['바쁘', '바빠', '바빴', '바쁜'] }, [
      ['요즘 너무 바빠요.', "I'm so busy these days."],
      ['바쁜데 와 줘서 고마워요.', 'Thanks for coming even though you’re busy.'],
    ]),
    word('예쁘다', 'adjective', 'yeppeuda', 'to be pretty', 1, { prefix: ['예쁘', '예뻐', '예뻤', '예쁜'] }, [
      ['꽃이 예뻐요.', 'The flowers are pretty.'],
      ['예쁜 옷이네요.', "That's a pretty outfit."],
    ]),
    word('아프다', 'adjective', 'apeuda', 'to be sick, hurt', 1, { prefix: ['아프', '아파', '아팠', '아픈'] }, [
      ['머리가 아파요.', 'I have a headache.'],
      ['어디 아파요?', 'Where does it hurt?'],
    ]),
    word('슬프다', 'adjective', 'seulpeuda', 'to be sad', 2, { prefix: ['슬프', '슬퍼', '슬펐', '슬픈'] }, [
      ['그 영화는 너무 슬퍼요.', 'That movie is so sad.'],
      ['슬픈 노래를 좋아해요.', 'I like sad songs.'],
    ]),
    word('기쁘다', 'adjective', 'gippeuda', 'to be glad, happy', 2, { prefix: ['기쁘', '기뻐', '기뻤', '기쁜'] }, [
      ['만나서 정말 기뻐요.', "I'm so glad to meet you."],
      ['기쁜 소식이 있어요.', 'I have good news.'],
    ]),
    word('배고프다', 'adjective', 'baegopeuda', 'to be hungry', 1, { prefix: ['배고프', '배고파', '배고팠', '배고픈'] }, [
      ['배고파요. 밥 먹어요!', "I'm hungry. Let's eat!"],
      ['배고프면 이거 먹어.', "If you're hungry, eat this."],
    ]),
    word('어렵다', 'adjective', 'eoryeopda', 'to be difficult', 1, { prefix: ['어렵', '어려워', '어려웠', '어려운'] }, [
      ['발음이 어려워요.', 'The pronunciation is difficult.'],
      ['어려운 질문이네요.', "That's a difficult question."],
    ]),
    word('쉽다', 'adjective', 'swipda', 'to be easy', 1, { prefix: ['쉽', '쉬워', '쉬웠', '쉬운'] }, [
      ['생각보다 쉬워요.', "It's easier than I thought."],
      ['쉬운 방법이 있어요.', "There's an easy way."],
    ]),
    word('무섭다', 'adjective', 'museopda', 'to be scary; be scared', 2, { prefix: ['무섭', '무서워', '무서웠', '무서운'] }, [
      ['공포 영화는 무서워요.', 'Horror movies are scary.'],
      ['무서운 꿈을 꿨어요.', 'I had a scary dream.'],
    ]),
    word('귀엽다', 'adjective', 'gwiyeopda', 'to be cute', 2, { prefix: ['귀엽', '귀여워', '귀여웠', '귀여운'] }, [
      ['강아지가 너무 귀여워요!', 'The puppy is so cute!'],
      ['귀여운 가방이네요.', "That's a cute bag."],
    ]),
    word('부럽다', 'adjective', 'bureopda', 'to be envious', 3, { prefix: ['부럽', '부러워', '부러웠', '부러운'] }, [
      ['정말 부러워요.', "I'm really jealous."],
      ['네가 부럽다.', 'I envy you.'],
    ]),
    word('어울리다', 'verb', 'eoullida', 'to suit; get along with', 3, { prefix: ['어울리', '어울려', '어울렸', '어울릴'] }, [
      ['그 옷 잘 어울려요.', 'That outfit suits you well.'],
      ['친구들과 잘 어울려요.', 'He gets along well with his friends.'],
    ]),
  ]

  LEATCH.dictionaries = { ...LEATCH.dictionaries, ko: { meaningLang: 'en', grammar: GRAMMAR, words: WORDS } }
})()
