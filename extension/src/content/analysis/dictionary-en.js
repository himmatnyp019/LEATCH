/**
 * Offline starter dictionary for learners of English (meanings in Korean).
 * Phrases are matched with regexes (allowing inflection and a short object in between);
 * single words match their common inflected forms.
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})

  const ex = (pairs) => pairs.map(([text, translation]) => ({ text, translation }))

  const phrase = (lemma, reading, meaning, level, pattern, examples) => ({
    lemma, type: 'vocab', pos: 'expression', reading, meaning, level, pattern, examples: ex(examples),
  })
  const word = (lemma, pos, reading, meaning, level, examples, forms) => ({
    lemma, type: 'vocab', pos, reading, meaning, level, forms, examples: ex(examples),
  })
  const grammar = (lemma, meaning, level, pattern, examples) => ({
    lemma, type: 'grammar', pos: 'pattern', reading: '', meaning, level, pattern, examples: ex(examples),
  })

  // An optional short object between a verb and its particle: "figure (it) out".
  const OBJ = String.raw`(?:\s+\w+)?`

  const PHRASES = [
    phrase('figure out', '/ˈfɪɡjər aʊt/', '알아내다, 이해하다, 해결하다', 3, new RegExp(String.raw`\bfigur(?:e|es|ed|ing)\b${OBJ}\s+out\b`, 'i'), [
      ["I can't figure out this problem.", '이 문제를 못 풀겠어요.'],
      ["We'll figure it out together.", '우리 같이 해결해 봐요.'],
    ]),
    phrase('give up', '/ɡɪv ʌp/', '포기하다, 그만두다', 2, new RegExp(String.raw`\bg(?:ive|ives|ave|iven|iving)\b${OBJ}\s+up\b`, 'i'), [
      ["Don't give up on your dream.", '꿈을 포기하지 마세요.'],
      ['He gave up smoking last year.', '그는 작년에 담배를 끊었어요.'],
    ]),
    phrase('come up with', '/kʌm ʌp wɪð/', '(생각을) 떠올리다, 생각해 내다', 3, /\bc(?:ome|omes|ame|oming)\s+up\s+with\b/i, [
      ['She came up with a great idea.', '그녀가 좋은 아이디어를 생각해 냈어요.'],
      ['I need to come up with a plan.', '계획을 세워야 해요.'],
    ]),
    phrase('look forward to', '/lʊk ˈfɔːrwərd tuː/', '~을 기대하다, 고대하다', 2, /\blook(?:s|ed|ing)?\s+forward\s+to\b/i, [
      ["I'm looking forward to the weekend.", '주말이 기대돼요.'],
      ['We look forward to seeing you.', '뵙기를 고대하고 있어요.'],
    ]),
    phrase('get used to', '/ɡet juːst tuː/', '~에 익숙해지다', 2, /\b(?:get|gets|got|gotten|getting)\s+used\s+to\b/i, [
      ["You'll get used to it soon.", '곧 익숙해질 거예요.'],
      ["I'm getting used to the cold weather.", '추운 날씨에 익숙해지고 있어요.'],
    ]),
    phrase('end up', '/end ʌp/', '결국 ~하게 되다', 3, /\bend(?:s|ed|ing)?\s+up\b/i, [
      ['We ended up staying home.', '결국 집에 있게 됐어요.'],
      ["You'll end up loving it.", '결국 좋아하게 될 거예요.'],
    ]),
    phrase('make sense', '/meɪk sens/', '말이 되다, 이해가 되다', 2, /\bma(?:ke|kes|de|king)\s+sense\b/i, [
      ['That makes sense.', '그거 말이 되네요.'],
      ["His story doesn't make sense.", '그의 이야기는 말이 안 돼요.'],
    ]),
    phrase('find out', '/faɪnd aʊt/', '알아내다, 알게 되다', 2, new RegExp(String.raw`\bf(?:ind|inds|ound|inding)\b${OBJ}\s+out\b`, 'i'), [
      ['I found out the truth yesterday.', '어제 진실을 알게 됐어요.'],
      ["Let's find out what happened.", '무슨 일이 있었는지 알아봐요.'],
    ]),
    phrase('turn out', '/tɜːrn aʊt/', '(결과가) ~로 드러나다, 판명되다', 3, /\bturn(?:s|ed|ing)?\s+out\b/i, [
      ['It turned out to be a good idea.', '알고 보니 좋은 생각이었어요.'],
      ['Everything turned out fine.', '모든 게 잘 됐어요.'],
    ]),
    phrase('hang out', '/hæŋ aʊt/', '(친구와) 놀다, 어울리다', 2, /\bh(?:ang|angs|ung|anging)\s+out\b/i, [
      ['Do you want to hang out tonight?', '오늘 밤에 같이 놀래요?'],
      ['We hung out at the cafe.', '우리는 카페에서 시간을 보냈어요.'],
    ]),
    phrase('take care of', '/teɪk ker əv/', '~을 돌보다; 처리하다', 2, /\bt(?:ake|akes|ook|aken|aking)\s+care\s+of\b/i, [
      ['I take care of my little brother.', '저는 남동생을 돌봐요.'],
      ["I'll take care of it.", '제가 처리할게요.'],
    ]),
    phrase('deal with', '/diːl wɪð/', '처리하다, 대처하다', 2, /\bdeal(?:s|t|ing)?\s+with\b/i, [
      ['I can deal with it.', '제가 처리할 수 있어요.'],
      ['How do you deal with stress?', '스트레스를 어떻게 해소해요?'],
    ]),
    phrase('get along', '/ɡet əˈlɔːŋ/', '잘 지내다, 사이좋게 지내다', 2, /\b(?:get|gets|got|getting)\s+along\b/i, [
      ['I get along well with my sister.', '저는 여동생이랑 잘 지내요.'],
      ["They don't get along.", '그들은 사이가 안 좋아요.'],
    ]),
    phrase('show up', '/ʃoʊ ʌp/', '나타나다, (모임에) 오다', 2, /\bshow(?:s|ed|n|ing)?\s+up\b/i, [
      ["He didn't show up to the party.", '그는 파티에 안 왔어요.'],
      ['She always shows up late.', '그녀는 항상 늦게 나타나요.'],
    ]),
    phrase('point out', '/pɔɪnt aʊt/', '지적하다, 짚어 주다', 3, new RegExp(String.raw`\bpoint(?:s|ed|ing)?\b${OBJ}\s+out\b`, 'i'), [
      ['Thanks for pointing that out.', '그걸 짚어 줘서 고마워요.'],
      ['He pointed out my mistake.', '그가 내 실수를 지적했어요.'],
    ]),
    phrase('work out', '/wɜːrk aʊt/', '운동하다; (일이) 잘 풀리다', 2, /\bwork(?:s|ed|ing)?\s+out\b/i, [
      ['I work out every morning.', '저는 매일 아침 운동해요.'],
      ['I hope everything works out.', '모든 게 잘 풀리길 바라요.'],
    ]),
    phrase('run out of', '/rʌn aʊt əv/', '~이 다 떨어지다, 바닥나다', 3, /\b(?:run|runs|ran|running)\s+out\s+of\b/i, [
      ['We ran out of milk.', '우유가 다 떨어졌어요.'],
      ["I'm running out of time.", '시간이 얼마 안 남았어요.'],
    ]),
    phrase('pick up', '/pɪk ʌp/', '집어 들다; (차로) 데리러 가다', 2, new RegExp(String.raw`\bpick(?:s|ed|ing)?\b${OBJ}\s+up\b`, 'i'), [
      ['Can you pick me up at the station?', '역으로 데리러 와 줄 수 있어요?'],
      ['Please pick up your clothes.', '옷 좀 주워 줘.'],
    ]),
    phrase('set up', '/set ʌp/', '설치하다, 마련하다, 준비하다', 2, new RegExp(String.raw`\bset(?:s|ting)?\b${OBJ}\s+up\b`, 'i'), [
      ["Let's set up the tent here.", '여기에 텐트를 치자.'],
      ['I set up a new account.', '새 계정을 만들었어요.'],
    ]),
    phrase('by the way', '/baɪ ðə weɪ/', '그런데, 그나저나', 2, /\bby\s+the\s+way\b/i, [
      ['By the way, where are you from?', '그런데 어디서 왔어요?'],
      ['By the way, I saw your brother.', '그나저나 네 동생 봤어.'],
    ]),
    phrase('kind of', '/kaɪnd əv/', '약간, 좀, 어느 정도', 2, /\bkind\s+of\b|\bkinda\b/i, [
      ["I'm kind of tired.", '좀 피곤해요.'],
      ["It's kind of strange.", '약간 이상해요.'],
    ]),
    phrase('at least', '/æt liːst/', '적어도, 최소한', 2, /\bat\s+least\b/i, [
      ['At least we tried.', '적어도 우리는 시도했어요.'],
      ['Drink at least two liters of water.', '물을 적어도 2리터 마시세요.'],
    ]),
    phrase('on purpose', '/ɑːn ˈpɜːrpəs/', '일부러, 고의로', 3, /\bon\s+purpose\b/i, [
      ["I didn't do it on purpose.", '일부러 그런 거 아니에요.'],
      ['Did you leave it there on purpose?', '그거 일부러 거기 둔 거예요?'],
    ]),
  ]

  const GRAMMAR = [
    grammar('used to', '(예전에) ~하곤 했다', 2, /(?<!\b(?:get|gets|got|gotten|getting|be|am|is|are|was|were|been|being)\s)\bused\s+to\b/i, [
      ['I used to live in Seoul.', '예전에 서울에 살았어요.'],
      ['We used to play here as kids.', '어렸을 때 여기서 놀곤 했어요.'],
    ]),
    grammar('be supposed to', '~하기로 되어 있다, ~해야 한다', 2, /\bsupposed\s+to\b/i, [
      ["We're supposed to meet at six.", '우리 6시에 만나기로 했어요.'],
      ["You're not supposed to park here.", '여기에 주차하면 안 돼요.'],
    ]),
    grammar('even though', '비록 ~이지만', 2, /\beven\s+though\b/i, [
      ['Even though it rained, we had fun.', '비가 왔지만 재미있었어요.'],
      ['She smiled even though she was tired.', '그녀는 피곤했지만 웃었어요.'],
    ]),
    grammar('as long as', '~하는 한, ~하기만 하면', 3, /\bas\s+long\s+as\b/i, [
      ['You can stay as long as you want.', '원하는 만큼 있어도 돼요.'],
      ["It's fine as long as you're happy.", '네가 행복하기만 하면 괜찮아.'],
    ]),
    grammar('no matter + wh-', '아무리 ~해도, ~와 상관없이', 3, /\bno\s+matter\s+(?:what|how|who|where|when|which)\b/i, [
      ["No matter what happens, I'm with you.", '무슨 일이 있어도 난 네 편이야.'],
      ['No matter how hard it is, keep going.', '아무리 힘들어도 계속해.'],
    ]),
    grammar('have/has + p.p. (present perfect)', '~한 적이 있다; ~해 왔다', 2, /\b(?:have|has|'ve|'s)\s+(?:never\s+|ever\s+|just\s+|already\s+)?(?:been|done|seen|gone|had|made|eaten|tried|heard|known|lived|worked|finished|met|visited)\b/i, [
      ['I have never been to Busan.', '저는 부산에 가 본 적이 없어요.'],
      ["She's lived here for ten years.", '그녀는 여기서 10년 동안 살았어요.'],
    ]),
    grammar("be going to", '~할 것이다 (예정)', 1, /\b(?:am|is|are|'m|'re|'s|was|were)\s+going\s+to\b|\bgonna\b/i, [
      ["I'm going to visit my parents.", '부모님 댁에 갈 거예요.'],
      ["It's going to rain soon.", '곧 비가 올 거예요.'],
    ]),
    grammar('I wish …', '~라면 좋을 텐데 (아쉬움)', 3, /\bI\s+wish\b/i, [
      ['I wish I could speak Korean fluently.', '한국어를 유창하게 할 수 있으면 좋겠어요.'],
      ['I wish you were here.', '네가 여기 있으면 좋을 텐데.'],
    ]),
  ]

  const WORDS = [
    word('actually', 'adverb', '/ˈæktʃuəli/', '사실은, 실제로', 2, [
      ["Actually, I've never been there.", '사실 저는 거기 가 본 적이 없어요.'],
      ['Is it actually true?', '그게 정말 사실이에요?'],
    ]),
    word('probably', 'adverb', '/ˈprɑːbəbli/', '아마', 2, [
      ["It'll probably rain tomorrow.", '내일 아마 비가 올 거예요.'],
      ["He's probably at home.", '그는 아마 집에 있을 거예요.'],
    ]),
    word('definitely', 'adverb', '/ˈdefɪnətli/', '확실히, 분명히, 꼭', 2, [
      ["I'll definitely come.", '꼭 갈게요.'],
      ['This is definitely the best.', '이게 확실히 최고예요.'],
    ]),
    word('especially', 'adverb', '/ɪˈspeʃəli/', '특히', 2, [
      ['I love fruit, especially apples.', '과일을 좋아하는데, 특히 사과를 좋아해요.'],
      ["It's cold, especially at night.", '추워요, 특히 밤에요.'],
    ]),
    word('honestly', 'adverb', '/ˈɑːnɪstli/', '솔직히', 2, [
      ["Honestly, I don't know.", '솔직히 잘 모르겠어요.'],
      ['Tell me honestly.', '솔직하게 말해 줘.'],
    ]),
    word('eventually', 'adverb', '/ɪˈventʃuəli/', '결국, 마침내', 3, [
      ['Eventually, she found a job.', '결국 그녀는 일자리를 구했어요.'],
      ["You'll understand eventually.", '언젠가는 이해하게 될 거예요.'],
    ]),
    word('literally', 'adverb', '/ˈlɪtərəli/', '말 그대로, 진짜로', 3, [
      ['I literally just woke up.', '저 진짜 방금 일어났어요.'],
      ['It was literally the best day.', '말 그대로 최고의 날이었어요.'],
    ]),
    word('anyway', 'adverb', '/ˈeniweɪ/', '어쨌든, 아무튼', 2, [
      ["Anyway, let's get started.", '아무튼 시작해 봅시다.'],
      ['Thanks anyway.', '어쨌든 고마워요.'],
    ], ['anyway', 'anyways']),
    word('opportunity', 'noun', '/ˌɑːpərˈtuːnəti/', '기회', 3, [
      ['This is a great opportunity.', '이건 좋은 기회예요.'],
      ['I had the opportunity to study abroad.', '유학할 기회가 있었어요.'],
    ], ['opportunity', 'opportunities']),
    word('experience', 'noun', '/ɪkˈspɪriəns/', '경험; 경험하다', 2, [
      ['It was an amazing experience.', '정말 멋진 경험이었어요.'],
      ['Do you have any work experience?', '일한 경험이 있어요?'],
    ]),
    word('decision', 'noun', '/dɪˈsɪʒn/', '결정', 2, [
      ['It was a hard decision.', '어려운 결정이었어요.'],
      ['You made the right decision.', '올바른 결정을 했어요.'],
    ]),
    word('relationship', 'noun', '/rɪˈleɪʃnʃɪp/', '관계', 2, [
      ['They have a good relationship.', '그들은 관계가 좋아요.'],
      ["How's your relationship with your boss?", '상사와의 관계는 어때요?'],
    ]),
    word('comfortable', 'adjective', '/ˈkʌmftəbl/', '편안한, 편한', 2, [
      ['This chair is really comfortable.', '이 의자 정말 편해요.'],
      ['Make yourself comfortable.', '편하게 계세요.'],
    ], ['comfortable', 'uncomfortable']),
    word('embarrassed', 'adjective', '/ɪmˈbærəst/', '창피한, 당황한', 3, [
      ['I was so embarrassed.', '너무 창피했어요.'],
      ["Don't be embarrassed.", '부끄러워하지 마세요.'],
    ], ['embarrassed', 'embarrassing']),
    word('awkward', 'adjective', '/ˈɔːkwərd/', '어색한, 곤란한', 3, [
      ['There was an awkward silence.', '어색한 침묵이 흘렀어요.'],
      ['It feels a bit awkward.', '조금 어색하네요.'],
    ], ['awkward']),
    word('curious', 'adjective', '/ˈkjʊriəs/', '궁금한, 호기심 많은', 2, [
      ["I'm curious about Korean culture.", '한국 문화가 궁금해요.'],
      ['Kids are naturally curious.', '아이들은 원래 호기심이 많아요.'],
    ], ['curious']),
    word('nervous', 'adjective', '/ˈnɜːrvəs/', '긴장한, 불안한', 2, [
      ["I'm nervous about the interview.", '면접 때문에 긴장돼요.'],
      ["Don't be nervous.", '긴장하지 마세요.'],
    ], ['nervous']),
    word('exhausted', 'adjective', '/ɪɡˈzɔːstɪd/', '몹시 지친, 기진맥진한', 3, [
      ["I'm exhausted after work.", '일 끝나고 완전히 지쳤어요.'],
      ['She looked exhausted.', '그녀는 매우 지쳐 보였어요.'],
    ], ['exhausted', 'exhausting']),
    word('ridiculous', 'adjective', '/rɪˈdɪkjələs/', '말도 안 되는, 터무니없는', 3, [
      ["That's ridiculous!", '말도 안 돼!'],
      ['The price is ridiculous.', '가격이 터무니없어요.'],
    ], ['ridiculous']),
    word('worth', 'adjective', '/wɜːrθ/', '~할 가치가 있는', 3, [
      ['This movie is worth watching.', '이 영화는 볼 만해요.'],
      ["It's not worth it.", '그럴 가치가 없어요.'],
    ], ['worth']),
    word('realize', 'verb', '/ˈriːəlaɪz/', '깨닫다, 알아차리다', 2, [
      ["I didn't realize it was so late.", '이렇게 늦은 줄 몰랐어요.'],
      ['She realized her mistake.', '그녀는 자신의 실수를 깨달았어요.'],
    ], ['realize', 'realizes', 'realized', 'realizing', 'realise', 'realised', 'realising']),
    word('improve', 'verb', '/ɪmˈpruːv/', '나아지다, 향상시키다', 2, [
      ['My Korean is improving.', '제 한국어 실력이 늘고 있어요.'],
      ['How can I improve my writing?', '글쓰기 실력을 어떻게 늘릴 수 있을까요?'],
    ]),
    word('recommend', 'verb', '/ˌrekəˈmend/', '추천하다', 2, [
      ['Can you recommend a good restaurant?', '좋은 식당 추천해 줄 수 있어요?'],
      ['I highly recommend this book.', '이 책 강력 추천해요.'],
    ]),
    word('afford', 'verb', '/əˈfɔːrd/', '(~할) 여유가 있다', 3, [
      ["I can't afford a new car.", '새 차를 살 여유가 없어요.'],
      ["We can't afford to wait.", '기다릴 여유가 없어요.'],
    ]),
    word('appreciate', 'verb', '/əˈpriːʃieɪt/', '감사하다; 진가를 알다', 3, [
      ['I really appreciate your help.', '도와주셔서 정말 감사해요.'],
      ['I appreciate good music.', '좋은 음악의 가치를 알아요.'],
    ]),
    word('avoid', 'verb', '/əˈvɔɪd/', '피하다', 2, [
      ['Try to avoid sugar.', '설탕을 피하도록 하세요.'],
      ["He's avoiding me.", '그가 나를 피하고 있어요.'],
    ]),
    word('pretend', 'verb', '/prɪˈtend/', '~인 척하다', 3, [
      ["Don't pretend you didn't see me.", '나 못 본 척하지 마.'],
      ['He pretended to be asleep.', '그는 자는 척했어요.'],
    ]),
    word('struggle', 'verb', '/ˈstrʌɡl/', '애쓰다, 고생하다', 3, [
      ['I struggled with math in school.', '학교 다닐 때 수학 때문에 고생했어요.'],
      ["She's struggling to find a job.", '그녀는 일자리를 구하느라 애쓰고 있어요.'],
    ]),
  ]

  LEATCH.dictionaries = { ...LEATCH.dictionaries, en: { meaningLang: 'ko', grammar: GRAMMAR, phrases: PHRASES, words: WORDS } }
})()
