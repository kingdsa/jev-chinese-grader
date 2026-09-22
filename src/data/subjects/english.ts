import type { ExamQuestion } from '../../types/exam'

/**
 * 英语题库（只看作文）：10 道写作题，贴近中高考真题风格。
 * 配比：6 应用文（邀请、建议、申请、通知、道歉、投稿）+ 3 读后续写 + 1 议论文写作。
 * id 用 `english-q1 … english-q10`。
 *
 * - `standardAnswer` 用中文列出内容要点、语言与词数要求，并附英语参考表达；
 * - `rubric` 是得分点（weight 即该点分值，最终按权重占比折算到 maxScore）；
 * - `levels` 给 Jev Score 原语用的整体档位描述（5~6 档，从低到高，写「情形」而不是「程度」）；
 * - 满分可以在界面上逐题自定义（defaultMaxScore 只是初始值）。
 */
export const ENGLISH_QUESTIONS: ExamQuestion[] = [
  {
    id: 'english-q1',
    no: 1,
    kindLabel: '应用文·邀请信',
    stem:
      'You are Li Hua. Your school will hold a Campus Culture Festival next Friday. Write an email to invite your foreign teacher Mr. Smith to attend it. Your email should include:\n' +
      '1. the time and place of the festival;\n' +
      '2. the main activities (traditional Chinese performances, calligraphy experience, etc.);\n' +
      '3. your welcome and your expectation for his reply.\n' +
      'Notes:\n' +
      '1. about 100 words (no less than 80 words);\n' +
      '2. you may add details to make the writing coherent;\n' +
      '3. the beginning and the ending are given and are not counted in the word limit.\n' +
      '（本题为英语应用文写作，请用英文作答。）',
    standardAnswer:
      '内容要点：① 开头点明写信目的——邀请外教 Mr. Smith 参加下周五的校园文化节；② 说明活动的时间与地点（如 next Friday, in the school hall）；③ 介绍活动内容（至少两项，如中国传统表演、书法体验、包饺子等）；④ 表达欢迎并期待对方回复。\n' +
      '语言与词数：词数 100 左右（不少于 80 词）；使用书信体格式（称呼、正文、结尾、落款 Li Hua）；时态以一般将来时为主，介绍活动安排可用一般现在时；恰当使用衔接词使行文连贯。\n' +
      '参考表达：I am writing to invite you to... / The festival will be held in... from... to... / A variety of activities will be arranged, such as... / We would be delighted if you could join us.',
    gradingNotes:
      '应用文按「内容要点 + 语言篇章 + 词数」分项给分：要点齐全、语言准确得体、行文连贯者可给满分；要点齐全但语言错误较多者酌情扣 1~3 分；词数明显不足（少于 60 词）、抄写题干或只堆砌模板套话而无实际内容者降档。',
    defaultMaxScore: 15,
    rubric: [
      {
        id: 'english-q1-r1',
        label: '开头点明写作目的：邀请外教参加校园文化节',
        detail: '写出邀请意图（invite / would like to invite）即可得分；只问候而不点明目的不得分',
        weight: 3,
      },
      {
        id: 'english-q1-r2',
        label: '说明活动的时间与地点',
        detail: '时间（如 next Friday）与地点（如 in the school hall）写出其一得一半分，两处齐全得分',
        weight: 3,
      },
      {
        id: 'english-q1-r3',
        label: '介绍至少两项活动内容，如中国传统表演、书法体验等',
        detail: '写出两项具体活动得满分，只写一项得一半分，笼统写 many activities 不得分',
        weight: 3.5,
      },
      {
        id: 'english-q1-r4',
        label: '表达欢迎与期待对方回复',
        detail: '有 welcome / look forward to your reply 等表达即可得分',
        weight: 2,
      },
      {
        id: 'english-q1-r5',
        label: '词数 100 左右（不少于 80 词）',
        detail: '少于 80 词扣分，少于 60 词不得分；明显超出较多不额外加分',
        weight: 1.5,
      },
      {
        id: 'english-q1-r6',
        label: '书信格式规范，语言准确得体，行文连贯',
        detail: '称呼、正文、结尾、落款齐全；语法与用词基本正确，有适当的连接词',
        weight: 2,
      },
    ],
    levels: [
      '只写出一两个英文单词或照抄题干，没有完成任何写作任务',
      '只写出一两个要点，语言错误多，词数严重不足（少于 40 词）',
      '写出部分要点，遗漏邀请目的或活动内容，语言错误较多但大致可读，词数约 50~70 词',
      '覆盖大部分要点，个别要点表述不清，语言有少量错误，行文基本连贯，词数接近 80 词',
      '覆盖全部要点，语言基本准确得体，衔接较自然，偶有个别小错，词数 90~110 词',
      '要点齐全，语言准确得体，衔接自然，格式规范，词数在 100 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'Dear Mr. Smith,\n\n' +
          'I am writing to invite you to our Campus Culture Festival, which will be held in the school hall next Friday afternoon, from 2:00 to 5:00.\n\n' +
          'A variety of activities will be arranged. To begin with, students will put on traditional Chinese performances, such as folk dances and Peking Opera. Besides, there will be a calligraphy corner where you can try writing Chinese characters with a brush. Some of us will also make dumplings on the spot.\n\n' +
          'We would be delighted if you could join us. Looking forward to your reply.\n\n' +
          'Yours,\nLi Hua',
      },
      {
        label: '中等示例',
        content:
          'Dear Mr. Smith,\n\n' +
          'I want to invite you to come our school culture festival. It will be in next Friday. There have many activities. We will sing and dance, and you can write calligraphy. I think it is very interesting and you will like it. Please come and have a look. I hope you can reply me soon.\n\n' +
          'Li Hua',
      },
      {
        label: '零分示例',
        content: 'Dear Mr. Smith, I am Li Hua. I want to invite you to our school. （只写出一句，时间、地点、活动内容均未展开，词数不足 30 词）',
      },
    ],
  },
  {
    id: 'english-q2',
    no: 2,
    kindLabel: '应用文·建议信',
    stem:
      'Your pen pal Peter is learning Chinese and finds it hard to remember Chinese characters and tones. Write a letter to give him some advice. Your letter should include:\n' +
      '1. your understanding of his difficulty;\n' +
      '2. at least two pieces of advice on learning Chinese (such as listening to Chinese songs, watching Chinese films, finding a language partner);\n' +
      '3. your encouragement.\n' +
      'Notes:\n' +
      '1. about 100 words (no less than 80 words);\n' +
      '2. you may add details to make the writing coherent.\n' +
      '（本题为英语应用文写作，请用英文作答。）',
    standardAnswer:
      '内容要点：① 表达对笔友困难的理解（学汉语不容易，但不必着急，这是许多学习者的共同经历）；② 提出第一条具体建议并说明理由（如多听中文歌、看中文影视，在真实语境中记字音）；③ 提出第二条具体建议并说明理由（如找语伴、每天坚持读写练习、用卡片记字等）；④ 表达鼓励与祝愿。\n' +
      '语言与词数：词数 100 左右（不少于 80 词）；使用书信体格式；以一般现在时为主，提建议可用 should / why not / it would be a good idea to 等句式；注意建议之间的衔接。\n' +
      '参考表达：I understand how you feel when... / It is never easy to learn a language, so don\'t be too hard on yourself. / Why not listen to Chinese songs? / It would be a good idea to find a language partner. / Keep practising and you will make progress little by little.',
    gradingNotes:
      '建议信按「内容要点 + 语言篇章 + 词数」分项给分：所提建议须具体可操作，只喊「study hard」这类空话不算有效建议；两条建议缺一则相应扣分；抄题或只有套话者降档。',
    defaultMaxScore: 15,
    rubric: [
      {
        id: 'english-q2-r1',
        label: '表达对笔友困难的理解与共情',
        detail: '如写出学汉语不容易、他的感受可以理解等，只要有一句共情即可得分',
        weight: 2,
      },
      {
        id: 'english-q2-r2',
        label: '提出第一条具体建议并说明理由，如多听中文歌、看中文影视',
        detail: '建议须具体（如 listen to Chinese songs / watch Chinese films），并带有理由或作用说明；只写 study hard 不得分',
        weight: 3.5,
      },
      {
        id: 'english-q2-r3',
        label: '提出第二条具体建议并说明理由，如找语伴、每天坚持练习',
        detail: '两条建议不能重复；有具体做法即可得分，附带理由更佳',
        weight: 3.5,
      },
      {
        id: 'english-q2-r4',
        label: '表达鼓励与祝愿',
        detail: '如 keep practising / you will make progress / I am always here to help 等',
        weight: 2.5,
      },
      {
        id: 'english-q2-r5',
        label: '词数 100 左右（不少于 80 词）',
        detail: '少于 80 词扣分，少于 60 词不得分',
        weight: 1.5,
      },
      {
        id: 'english-q2-r6',
        label: '书信格式规范，语言准确，行文连贯',
        detail: '称呼、正文、结尾、落款齐全；提建议句式使用得当，连接词使用恰当',
        weight: 2,
      },
    ],
    levels: [
      '只写出一两个英文单词或照抄题干，没有任何建议内容',
      '只有一两句空泛鼓励，没有具体建议，语言错误多，词数不足 40 词',
      '写出一条建议，或两条建议都很笼统，语言错误较多，词数约 50~70 词',
      '写出两条建议，但理由不足或表述不清，语言有少量错误，行文基本连贯，词数接近 80 词',
      '两条建议具体可行并附理由，有共情与鼓励，语言基本准确，词数 90~110 词',
      '建议具体、理由充分、语气真诚得体，共情与鼓励自然，语言准确连贯，词数在 100 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'Dear Peter,\n\n' +
          'I am sorry to hear that you have trouble remembering Chinese characters and tones. Learning a language is never easy, so please don\'t be too hard on yourself.\n\n' +
          'Here are some suggestions. First, why not listen to Chinese songs and watch Chinese films? They make learning fun and help you get used to the sounds. Second, it would be a good idea to find a language partner and chat with him in Chinese every day; he can correct your tones patiently.\n\n' +
          'Keep practising, and you will make progress little by little. I am always here if you need help.\n\n' +
          'Yours,\nLi Hua',
      },
      {
        label: '中等示例',
        content:
          'Dear Peter,\n\n' +
          'I know learn Chinese is very difficult for you. I think you can listen more Chinese songs. You can also watch Chinese film. It can help you remember the words. Don\'t worry, you will success. I hope you are happy every day.\n\n' +
          'Li Hua',
      },
      {
        label: '零分示例',
        content: 'Dear Peter, I am happy to hear that you are learning Chinese. Chinese is very useful. （只写了两句，没有提出任何建议，词数不足 30 词）',
      },
    ],
  },
  {
    id: 'english-q3',
    no: 3,
    kindLabel: '应用文·申请信',
    stem:
      'You are Li Hua. The International Summer Camp for Children needs student volunteers to look after kids from different countries. Write an application letter to Mr. Brown. Your letter should include:\n' +
      '1. the position you are applying for;\n' +
      '2. your advantages (English level, volunteer experience, personality);\n' +
      '3. your determination and your hope for a reply.\n' +
      'Notes:\n' +
      '1. about 100 words (no less than 80 words);\n' +
      '2. you may add details to make the writing convincing.\n' +
      '（本题为英语应用文写作，请用英文作答。）',
    standardAnswer:
      '内容要点：① 开头点明申请职位（国际夏令营志愿者）与写信目的；② 说明语言优势或沟通能力（如英语口语流利，能与外国孩子交流）；③ 说明相关经历或性格优势（如做过志愿者、有耐心、善于照顾孩子、性格开朗）；④ 表达决心并期待回复。\n' +
      '语言与词数：词数 100 左右（不少于 80 词）；使用申请信格式；以一般现在时为主，介绍过去经历用一般过去时；语气自信而得体，注意优势之间的衔接。\n' +
      '参考表达：I am writing to apply for the position of... / I believe I am qualified for the job. / I do well in English and I can communicate with foreign children. / I once worked as a volunteer in... / I would appreciate it if you could give me a chance.',
    gradingNotes:
      '申请信按「内容要点 + 语言篇章 + 词数」分项给分：职位、优势（语言 + 经历/性格）、决心三者缺一扣分；只说「I want to be a volunteer」而不说明优势者降档；抄题或模板堆砌不得分。',
    defaultMaxScore: 15,
    rubric: [
      {
        id: 'english-q3-r1',
        label: '点明申请职位与写信目的',
        detail: '写出 apply for the position of a volunteer / I want to be a volunteer 等即可得分',
        weight: 3,
      },
      {
        id: 'english-q3-r2',
        label: '说明语言或沟通方面的优势',
        detail: '如英语水平好、口语流利、能与外国孩子交流；只写 I am a student 不得分',
        weight: 3.5,
      },
      {
        id: 'english-q3-r3',
        label: '说明相关经历或性格优势，如做过志愿者、有耐心、开朗',
        detail: '经历与性格写出其一得一半分，两者齐全得分',
        weight: 3.5,
      },
      {
        id: 'english-q3-r4',
        label: '表达决心并期待回复',
        detail: '如 I will try my best / I would appreciate it if you could reply 等',
        weight: 1.5,
      },
      {
        id: 'english-q3-r5',
        label: '词数 100 左右（不少于 80 词）',
        detail: '少于 80 词扣分，少于 60 词不得分',
        weight: 1.5,
      },
      {
        id: 'english-q3-r6',
        label: '申请信格式规范，语言得体，行文连贯',
        detail: '称呼、正文、结尾、落款齐全；语气自信有礼，连接词使用恰当',
        weight: 2,
      },
    ],
    levels: [
      '只写出一两个英文单词或照抄题干，没有说明申请职位',
      '只写出申请意愿，没有任何优势说明，语言错误多，词数不足 40 词',
      '写出申请职位和一点优势，经历与性格缺失，语言错误较多，词数约 50~70 词',
      '职位、优势、决心基本写到，但优势较笼统，语言有少量错误，词数接近 80 词',
      '职位明确，语言与经历（或性格）优势具体，决心表达得当，语言基本准确，词数 90~110 词',
      '职位明确，优势具体有力，语气自信得体，结构完整，语言准确连贯，词数在 100 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'Dear Mr. Brown,\n\n' +
          'I am writing to apply for the position of a volunteer at the International Summer Camp for Children.\n\n' +
          'I believe I am qualified for the job. First, I do well in English and I can talk with foreign children freely. Besides, I worked as a volunteer in our community last summer, where I helped children with their homework and organized games for them. I am also patient and outgoing, so I get along well with kids.\n\n' +
          'If I am given the chance, I will try my best to do the job well. I would appreciate it if you could reply at your convenience.\n\n' +
          'Yours,\nLi Hua',
      },
      {
        label: '中等示例',
        content:
          'Dear Mr. Brown,\n\n' +
          'I want to be a volunteer in the summer camp. I am a student in Grade Two. My English is good and I like children. I have many time in summer. I think I can do this job good. Please let me join you. Thank you very much.\n\n' +
          'Li Hua',
      },
      {
        label: '零分示例',
        content: 'Dear Mr. Brown, I am Li Hua. I want to be a volunteer. （只有两句，未说明职位与个人优势，词数不足 30 词）',
      },
    ],
  },
  {
    id: 'english-q4',
    no: 4,
    kindLabel: '应用文·通知',
    stem:
      'You are Li Hua, chairman of the Students\' Union. Write a notice in English about the school English Speech Contest. Your notice should include:\n' +
      '1. the theme and purpose of the contest;\n' +
      '2. the time and place;\n' +
      '3. how to sign up and the deadline;\n' +
      '4. a welcome to all students.\n' +
      'Notes:\n' +
      '1. about 100 words (no less than 80 words);\n' +
      '2. you may add details to make the notice clear.\n' +
      '（本题为英语应用文写作，请用英文作答。）',
    standardAnswer:
      '内容要点：① 写明比赛的主题与目的（如主题为 My Dream，目的是提高英语口语、增强自信）；② 写明比赛时间与地点；③ 写明报名方式与截止日期（如到学生会办公室报名、截止到某月某日）；④ 欢迎同学参加。\n' +
      '语言与词数：词数 100 左右（不少于 80 词）；使用通知格式（标题 NOTICE，落款 Students\' Union 与日期）；以一般将来时为主；语气正式，信息清楚。\n' +
      '参考表达：In order to improve our spoken English, the Students\' Union is going to hold... / The contest will take place in the school hall at... on... / The theme of the contest is... / Those who are interested are welcome to sign up at... before...',
    gradingNotes:
      '通知按「信息要点 + 格式语言 + 词数」分项给分：时间、地点、报名方式与截止日期是核心信息，缺一扣分；没有 NOTICE 标题或落款要酌情扣分；抄题者降档。',
    defaultMaxScore: 15,
    rubric: [
      {
        id: 'english-q4-r1',
        label: '写明比赛主题与目的',
        detail: '主题（如 My Dream）与目的（如提高口语、增强自信）各占一半分',
        weight: 3,
      },
      {
        id: 'english-q4-r2',
        label: '写明比赛的时间与地点',
        detail: '时间与地点写出其一得一半分，两处齐全得分',
        weight: 3,
      },
      {
        id: 'english-q4-r3',
        label: '写明报名方式与截止日期',
        detail: '如 sign up at the Students\' Union office before May 20th；两项缺一扣分',
        weight: 3.5,
      },
      {
        id: 'english-q4-r4',
        label: '欢迎同学参加，语气正式得体',
        detail: '有 welcome / come and join us 等表达即可得分',
        weight: 2,
      },
      {
        id: 'english-q4-r5',
        label: '词数 100 左右（不少于 80 词）',
        detail: '少于 80 词扣分，少于 60 词不得分',
        weight: 1.5,
      },
      {
        id: 'english-q4-r6',
        label: '通知格式规范，语言准确清楚',
        detail: '有 NOTICE 标题与落款（Students\' Union、日期）；时态以一般将来时为主，信息陈述条理清楚',
        weight: 2,
      },
    ],
    levels: [
      '只写出一两个英文单词或照抄题干，没有通知的任何信息',
      '只有一两句笼统的话，时间、地点、报名方式均缺失，语言错误多，词数不足 40 词',
      '写出比赛和部分信息，缺报名方式或截止日期，语言错误较多，词数约 50~70 词',
      '四项信息基本写到，但个别信息不清（如没有具体时间或地点），语言有少量错误，词数接近 80 词',
      '信息完整清楚，格式正确，语言基本准确，词数 90~110 词',
      '信息完整准确，格式规范，语气正式得体，条理清楚，语言准确，词数在 100 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'NOTICE\n\n' +
          'In order to improve our spoken English and build up our confidence, the Students\' Union is going to hold an English Speech Contest. The contest will take place in the school hall at 3:00 p.m. on May 26th.\n\n' +
          'The theme of the contest is "My Dream". Each speaker will have five minutes to share his or her story. Those who are interested are welcome to sign up at the Students\' Union office before May 20th. Please leave your name, class and topic when you sign up.\n\n' +
          'Come and show yourself! We are looking forward to your participation.\n\n' +
          'The Students\' Union\nMay 12th',
      },
      {
        label: '中等示例',
        content:
          'NOTICE\n\n' +
          'We will have a English speech contest. It is in the school hall on May 26th. Everyone can take part in. The theme is "My Dream". If you want to join it, please come to the office and tell us. Don\'t miss it.\n\n' +
          'Students\' Union',
      },
      {
        label: '零分示例',
        content: 'NOTICE There will be an English speech contest. Welcome to join us. （只有两句，时间、地点、报名方式均缺失，词数不足 30 词）',
      },
    ],
  },
  {
    id: 'english-q5',
    no: 5,
    kindLabel: '应用文·道歉信',
    stem:
      'You are Li Hua. You had promised to meet your foreign teacher Mr. Green this Saturday afternoon to discuss your speech, but now you cannot keep the appointment. Write a letter to him. Your letter should include:\n' +
      '1. an apology for not being able to keep the appointment;\n' +
      '2. the reason;\n' +
      '3. your suggestion for making it up (a new time and place);\n' +
      '4. a second apology.\n' +
      'Notes:\n' +
      '1. about 100 words (no less than 80 words);\n' +
      '2. you may add details to make the writing sincere.\n' +
      '（本题为英语应用文写作，请用英文作答。）',
    standardAnswer:
      '内容要点：① 开头就未能赴约表示歉意；② 说明不能赴约的具体原因（如家人生病需要照顾、临时参加重要比赛等，理由须具体）；③ 提出补救办法（另约时间地点，或改用邮件、视频等方式）；④ 再次致歉并表达感谢或期待回复。\n' +
      '语言与词数：词数 100 左右（不少于 80 词）；使用书信体格式；时态以一般现在时和一般将来时为主，说明原因可用一般过去时；语气诚恳，注意致歉与解释之间的衔接。\n' +
      '参考表达：I am terribly sorry that I cannot keep our appointment. / Please accept my sincere apology. / The reason is that... / Would it be possible for us to meet next Monday afternoon at your office? / I do hope you can forgive me.',
    gradingNotes:
      '道歉信按「内容要点 + 语气语言 + 词数」分项给分：道歉、原因、补救、再次致歉缺一扣分；原因空泛（如 I am busy）或没有补救安排者降档；抄题者按最低档处理。',
    defaultMaxScore: 15,
    rubric: [
      {
        id: 'english-q5-r1',
        label: '开头就未能赴约表示歉意',
        detail: '有 sorry / apology for not keeping the appointment 等表达即可得分',
        weight: 3,
      },
      {
        id: 'english-q5-r2',
        label: '说明不能赴约的具体原因',
        detail: '原因须具体（如家人生病需要照顾、临时有事无法离开）；只写 I am busy 不得分',
        weight: 3.5,
      },
      {
        id: 'english-q5-r3',
        label: '提出补救办法，如另约时间地点或改用其他方式',
        detail: '有明确的新安排（时间或方式）得满分，只说 I will tell you later 只得一半分',
        weight: 3.5,
      },
      {
        id: 'english-q5-r4',
        label: '再次致歉并表达感谢或期待回复',
        detail: '如 I do hope you can forgive me / thank you for your understanding 等',
        weight: 2,
      },
      {
        id: 'english-q5-r5',
        label: '词数 100 左右（不少于 80 词）',
        detail: '少于 80 词扣分，少于 60 词不得分',
        weight: 1.5,
      },
      {
        id: 'english-q5-r6',
        label: '书信格式规范，语气诚恳得体，行文连贯',
        detail: '称呼、正文、结尾、落款齐全；致歉与解释衔接自然',
        weight: 1.5,
      },
    ],
    levels: [
      '只写出一两个英文单词或照抄题干，没有道歉的意思',
      '只有一句 sorry，未说明原因与补救办法，语言错误多，词数不足 40 词',
      '写了道歉和原因，但原因空泛，没有补救安排，语言错误较多，词数约 50~70 词',
      '道歉、原因、补救基本写到，但原因或新安排不够具体，语言有少量错误，词数接近 80 词',
      '四项要点齐全，语气诚恳，语言基本准确，词数 90~110 词',
      '要点齐全，原因具体、补救周到，语气诚恳得体，语言准确连贯，词数在 100 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'Dear Mr. Green,\n\n' +
          'I am terribly sorry that I cannot keep our appointment this Saturday afternoon. Please accept my sincere apology.\n\n' +
          'The reason is that my grandmother fell ill and I have to take care of her in the hospital that day. My parents are both on a business trip, so no one else can go there. I feel very bad about it, because you have been so kind to help me with my speech.\n\n' +
          'Would it be possible for us to meet next Monday afternoon at your office? I do hope you can forgive me. Thank you for your understanding.\n\n' +
          'Yours,\nLi Hua',
      },
      {
        label: '中等示例',
        content:
          'Dear Mr. Green,\n\n' +
          'I am sorry I can\'t go to see you this Saturday. Because my grandmother is ill, I must look after her. So I can\'t discuss my speech with you. I am very sorry for this. What about meet next Monday? I hope you can agree.\n\n' +
          'Li Hua',
      },
      {
        label: '零分示例',
        content: 'Dear Mr. Green, I am sorry. I can\'t come on Saturday. （只有两句，未说明原因与补救办法，词数不足 30 词）',
      },
    ],
  },
  {
    id: 'english-q6',
    no: 6,
    kindLabel: '应用文·投稿介绍',
    stem:
      'You are Li Hua. Your school English newspaper is collecting articles about Chinese traditional festivals. Write an article to introduce a festival activity you took part in. Your article should include:\n' +
      '1. which festival it was and when it took place;\n' +
      '2. what activities you did (for example, making dumplings, watching dragon boat races, admiring the full moon);\n' +
      '3. your feelings and what the festival means to you.\n' +
      'Notes:\n' +
      '1. about 100 words (no less than 80 words);\n' +
      '2. you may add details to make the writing vivid.\n' +
      '（本题为英语应用文写作，请用英文作答。）',
    standardAnswer:
      '内容要点：① 点明所介绍的节日与活动时间；② 具体描写活动内容（至少两项，如包饺子、贴春联、赏月、看龙舟比赛等）；③ 写出个人感受与节日的意义（如团圆的温暖、传统文化的自豪）。\n' +
      '语言与词数：词数 100 左右（不少于 80 词）；介绍节日用一般现在时，叙述自己的经历用一般过去时；描写要具体生动，注意时间顺序与句间衔接。\n' +
      '参考表达：Traditional festivals are the warmest part of Chinese life. / It fell on... this year. / We made dumplings with our own hands. / Looking at the bright moon, I felt the happiness of being together with my family. / Every traditional festival reminds me of who I am.',
    gradingNotes:
      '投稿按「内容要点 + 描写语言 + 词数」分项给分：节日名称、活动内容、个人感受三者缺一扣分；只罗列活动而无感受者难以得高分；抄题或套话堆砌者降档。',
    defaultMaxScore: 15,
    rubric: [
      {
        id: 'english-q6-r1',
        label: '点明所介绍的节日与活动时间',
        detail: '节日名称与时间（如 the Mid-Autumn Festival, on September 21st）写出其一得一半分，两处齐全得分',
        weight: 3,
      },
      {
        id: 'english-q6-r2',
        label: '具体描写至少两项活动内容',
        detail: '如包饺子、贴春联、赏月、看龙舟比赛；只写 had a good time 不得分',
        weight: 4,
      },
      {
        id: 'english-q6-r3',
        label: '写出个人感受与节日的意义',
        detail: '如家人团圆的温暖、对传统文化的自豪等，情感真实具体',
        weight: 3.5,
      },
      {
        id: 'english-q6-r4',
        label: '语言准确，描写生动，时态与衔接自然',
        detail: '叙述经历用一般过去时、介绍节日用一般现在时；有细节描写，句间衔接自然',
        weight: 3,
      },
      {
        id: 'english-q6-r5',
        label: '词数 100 左右（不少于 80 词）',
        detail: '少于 80 词扣分，少于 60 词不得分',
        weight: 1.5,
      },
    ],
    levels: [
      '只写出一两个英文单词或照抄题干，没有介绍任何节日活动',
      '只提到节日名称，没有活动与感受，语言错误多，词数不足 40 词',
      '写了节日和一项活动，缺少感受，语言错误较多，词数约 50~70 词',
      '节日、活动、感受基本写到，但描写笼统，语言有少量错误，词数接近 80 词',
      '活动描写具体生动，感受真实，语言基本准确，时态与衔接自然，词数 90~110 词',
      '要点齐全，描写具体生动，感受真切，节日意义表达自然，语言准确流畅，词数在 100 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'Traditional festivals are the warmest part of Chinese life, and I would like to share my Mid-Autumn Festival with you.\n\n' +
          'This year it fell on September 21st. That evening my whole family got together at my grandparents\' home. We made mooncakes with our own hands, and my mother told us the old story of Chang\'e. After dinner we sat in the yard, eating the mooncakes and admiring the full moon.\n\n' +
          'Looking at the bright moon, I felt the happiness of being together with my family. Every traditional festival reminds me of who I am and where my heart belongs.',
      },
      {
        label: '中等示例',
        content:
          'I want to introduce the Spring Festival. It is in January or February. In that day, my family clean the house and make dumplings. I help my mother with the dumplings. In the evening we have a big dinner and watch TV. I am very happy. I think the Spring Festival is important for Chinese people.',
      },
      {
        label: '零分示例',
        content: 'I like the Spring Festival. It is a very good festival and Chinese people all like it. （只有两句套话，没有活动内容与感受，词数不足 30 词）',
      },
    ],
  },
  {
    id: 'english-q7',
    no: 7,
    kindLabel: '读后续写',
    stem:
      '阅读下面材料，根据其内容和所给段落开头语续写两段，使之构成一个完整的故事。\n' +
      'Read the passage below and continue the story in two paragraphs. Your continuation should be consistent with the given text and the characters.\n' +
      'Paragraph 1: Jack helped the old man onto his bike and walked slowly beside him.\n' +
      'Paragraph 2: When Jack finally got home, it was nearly nine o\'clock.\n' +
      'Notes:\n' +
      '1. about 150 words in total for the two paragraphs;\n' +
      '2. use as many different sentence patterns as possible;\n' +
      '3. try not to copy the original sentences.\n' +
      '（本题为英语读后续写，续写两段，使之构成一个完整的故事。请用英文作答。）',
    material:
      'On a cold December evening, Jack was riding his bike home from the library when he noticed an old man sitting by the roadside, holding his knee and shaking in the wind. The man\'s coat was thin, and a broken walking stick lay beside him. Jack slowed down. He had promised his mother that he would be home before seven, and it was already half past six. The road was quiet and the sky was turning dark. For a second he wanted to ride on, but the old man\'s painful face made him stop. He got off his bike and walked over.\n\n' +
      '"What\'s wrong, sir? Can I help you?" Jack asked. The old man looked up and said in a weak voice that he had slipped on the icy path, hurt his knee and could not stand up, and that he lived alone in a small house two streets away. He added that his daughter was working in another city and he had no one to call. Jack took off his scarf and wrapped it around the old man\'s knee. Then he helped him onto the back of his bike and began to push it slowly along the dark, slippery road.',
    standardAnswer:
      '内容要点：① 第一段写 Jack 送老人回家的具体行动：推车、搀扶、处理伤口、联系老人的女儿等，情节与原文「老人摔伤、独居」的设定吻合；② 第二段写 Jack 到家后的情形：向母亲解释晚归原因，母亲由担心转为理解与赞许，以及 Jack 自己的感受。\n' +
      '语言与词数：两段共 150 词左右；以一般过去时为主，描写可用过去进行时；适当使用动作、心理与细节描写，注意与所给开头语的衔接；句式力求有变化。\n' +
      '参考表达：Having helped the old man onto his bike, Jack pushed it slowly... / It took them almost half an hour to reach the small house. / The moment he opened the door, he saw his mother waiting anxiously. / A warm feeling rose in his heart. / That evening Jack understood the real meaning of kindness.',
    gradingNotes:
      '读后续写按「情节衔接 + 内容充实 + 语言表达 + 篇章连贯 + 词数」分项给分。情节与原文矛盾、人物性格错位、两段之间衔接生硬者降档；只抄材料或只写一两句应付者按最低档处理。',
    defaultMaxScore: 25,
    rubric: [
      {
        id: 'english-q7-r1',
        label: '第一段情节与原文衔接自然：Jack 送老人回家或处理伤口，行为符合其善良、有责任感的性格',
        detail: '能接住开头语、继续写帮助老人的具体行动；情节与原文矛盾或另起故事不得分',
        weight: 5,
      },
      {
        id: 'english-q7-r2',
        label: '第一段有具体的动作、语言或心理描写，内容充实',
        detail: '如搀扶、推车、包扎、打电话等细节；只有概述没有细节最多得一半分',
        weight: 4,
      },
      {
        id: 'english-q7-r3',
        label: '第二段情节完整：Jack 到家后向母亲说明晚归原因，母亲的反应合理，事件得到收束',
        detail: '母亲的反应可担心、可赞许，只要与「Jack 助人而晚归」一致即可得分',
        weight: 5,
      },
      {
        id: 'english-q7-r4',
        label: '第二段有情感或主题的自然升华，如理解善良的意义、家人间的理解',
        detail: '主题须从情节中自然引出；空喊口号式的结尾只得一半分',
        weight: 3,
      },
      {
        id: 'english-q7-r5',
        label: '语言表达：语法、词汇准确，句式有变化，描写生动',
        detail: '时态准确（以一般过去时为主），动词与句式丰富；语法错误较多者相应扣分',
        weight: 5,
      },
      {
        id: 'english-q7-r6',
        label: '篇章连贯：与所给开头语衔接自然，段内逻辑清楚，连词与指代使用得当；词数 150 左右',
        detail: '词数不足 100 词扣分，不足 60 词不得分；两段之间要有时间或情节上的推进',
        weight: 3,
      },
    ],
    levels: [
      '只抄写原文或只写出一两个简单句，与所给开头语无法衔接，词数严重不足',
      '情节与原文关系不大或前后矛盾，语言错误多，靠套话堆砌，词数不足 60 词',
      '情节基本合理但较简单，动作与心理描写少，语言错误较多，两段衔接生硬，词数约 70~100 词',
      '情节与原文基本一致，两段内容完整，有一定描写，语言错误不影响理解，词数约 100~130 词',
      '情节合理连贯，描写较具体，语言基本准确，句式有一定变化，词数 150 词左右',
      '情节与原文高度融洽，两段浑然一体，人物性格一致，描写生动，语言准确丰富，情感真挚，词数 150 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'Paragraph 1: Jack helped the old man onto his bike and walked slowly beside him. The icy road was slippery, so Jack held the handlebar with one hand and supported the old man with the other. Half an hour later, they reached the small house. Inside, Jack helped him sit down and cleaned the wound with warm water. He also called the old man\'s daughter and told her not to worry.\n\n' +
          'Paragraph 2: When Jack finally got home, it was nearly nine o\'clock. His mother was waiting at the door, her face full of worry. Jack explained everything, and her worry turned into a proud smile. "You did the right thing," she said softly, handing him a bowl of hot soup. That night Jack felt warmer than ever: a small act of kindness had lit up both the old man\'s evening and his own heart.',
      },
      {
        label: '中等示例',
        content:
          'Paragraph 1: Jack helped the old man onto his bike and walked slowly beside him. They go to the old man house. Jack help him sit down and clean his knee. The old man say thank you to Jack. Then Jack go home.\n\n' +
          'Paragraph 2: When Jack finally got home, it was nearly nine o\'clock. His mother ask him why he is so late. Jack tell her the whole story. His mother say he is a good boy. Jack is very happy and he think he should help more people.',
      },
      {
        label: '零分示例',
        content: 'Paragraph 1: Jack helped the old man. Then he went home. Paragraph 2: When Jack got home, his mother was angry. （只写了两三句，没有情节、描写与衔接，词数不足 40 词）',
      },
    ],
  },
  {
    id: 'english-q8',
    no: 8,
    kindLabel: '读后续写',
    stem:
      '阅读下面材料，根据其内容和所给段落开头语续写两段，使之构成一个完整的故事。\n' +
      'Read the passage below and continue the story in two paragraphs. Keep the characters and the plot consistent with the given text.\n' +
      'Paragraph 1: Emma stood still, not knowing what to say.\n' +
      'Paragraph 2: That evening, Emma sat beside her mother and showed her the painting.\n' +
      'Notes:\n' +
      '1. about 150 words in total for the two paragraphs;\n' +
      '2. use as many different sentence patterns as possible;\n' +
      '3. try not to copy the original sentences.\n' +
      '（本题为英语读后续写，续写两段，使之构成一个完整的故事。请用英文作答。）',
    material:
      'Emma had been looking forward to the school art show for months, and her painting "My Mother\'s Kitchen" was chosen to be displayed at the entrance of the hall. On the morning of the show, she could not find her painting anywhere. She searched her room, the living room and even the garage. Then she saw her mother hurrying out with a large paper bag. "Mom took it away!" Emma thought, her face turning red. Without asking a single question, she rushed out of the house and ran all the way to school, tears in her eyes.\n\n' +
      'At school, Emma stood at the empty place where her painting should have been, telling her best friend Lucy that her mother had never cared about her art. Lucy listened quietly and then pointed at the school gate. Emma turned around and saw her mother running towards the hall, holding the painting in her arms, with a broken frame in the paper bag and dust on her coat. It turned out that the frame had fallen off the wall in the early morning, and her mother had spent the whole morning looking for a shop to repair it.',
    standardAnswer:
      '内容要点：① 第一段写 Emma 面对抱着画赶来的母亲时的反应：惊讶、惭愧，听母亲解释修画框的经过，向母亲道歉，误会开始化解；② 第二段写当晚母女相处：Emma 讲这幅画的构思与心意，母亲的理解与感动，误会在交流中彻底消除。\n' +
      '语言与词数：两段共 150 词左右；以一般过去时为主；多用心理、动作与对话描写，情感变化要自然（生气—惭愧—感动—亲近）；注意与所给开头语的衔接。\n' +
      '参考表达：The moment Emma saw the dust on her mother\'s coat, her anger disappeared. / "I\'m sorry, Mom. I should have asked you first," Emma said in a low voice. / Her mother listened, her eyes slowly filling with tears. / It was then that Emma realised how much her mother loved her.',
    gradingNotes:
      '读后续写按「情节衔接 + 内容充实 + 语言表达 + 篇章连贯 + 词数」分项给分。把母亲写成反面人物（与原文「修画框」的真相矛盾）、只写对话而无情节推进者降档；只抄材料或一两句应付者按最低档处理。',
    defaultMaxScore: 25,
    rubric: [
      {
        id: 'english-q8-r1',
        label: '第一段写 Emma 的反应与道歉：由生气转为惭愧，误会开始化解，与原文真相吻合',
        detail: '须接住开头语，写 Emma 面对母亲时的心理变化与言语行动；把母亲写成故意为难女儿不得分',
        weight: 5,
      },
      {
        id: 'english-q8-r2',
        label: '第一段有心理、动作或对话描写，情感变化写得具体',
        detail: '如看见母亲手上的灰、听见母亲的解释后的沉默与道歉；只有概述最多得一半分',
        weight: 4,
      },
      {
        id: 'english-q8-r3',
        label: '第二段写母女当晚的交流与和解：Emma 讲画的构思，母亲的理解与感动，误会消除',
        detail: '交流内容须与画作「母亲的厨房」相关；只写她们和好了没有过程只得一半分',
        weight: 5,
      },
      {
        id: 'english-q8-r4',
        label: '第二段有情感升华，如理解与沟通的重要、亲情的可贵',
        detail: '主题须从情节中自然引出；空喊口号式的结尾只得一半分',
        weight: 3,
      },
      {
        id: 'english-q8-r5',
        label: '语言表达：语法、词汇准确，句式有变化，对话或细节描写生动',
        detail: '时态准确，用词与句式丰富；语法错误较多者相应扣分',
        weight: 5,
      },
      {
        id: 'english-q8-r6',
        label: '篇章连贯：与开头语衔接自然，两段逻辑顺畅，指代与连词得当；词数 150 左右',
        detail: '词数不足 100 词扣分，不足 60 词不得分；两段之间要有时间或情感上的推进',
        weight: 3,
      },
    ],
    levels: [
      '只抄写原文或只写一两句，与所给开头语无法衔接，误会没有任何推进，词数严重不足',
      '情节与原文矛盾（如把母亲写成为难女儿的人），语言错误多，词数不足 60 词',
      '写了一点和解的内容，但情感变化突兀，缺少描写，语言错误较多，两段衔接生硬，词数约 70~100 词',
      '情节与原文基本吻合，两段完整，情感变化基本自然，语言错误不影响理解，词数约 100~130 词',
      '情节连贯，心理与对话描写较具体，情感转变自然，语言基本准确，词数 150 词左右',
      '情节与原文高度融洽，母女情感变化细腻真实，描写生动，语言准确丰富，主题自然升华，词数 150 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'Paragraph 1: Emma stood still, not knowing what to say. Her mother came up, out of breath, and put the painting in her hands. "The frame fell this morning, and I knew how much it meant to you, so I ran out to get it fixed," she explained, wiping the dust from her coat. Looking at her red hands, Emma\'s anger disappeared. "I\'m sorry, Mom. I should have asked you first," she said in a low voice.\n\n' +
          'Paragraph 2: That evening, Emma sat beside her mother and showed her the painting. She explained how she had chosen every colour: the warm yellow of the soup and the orange light above the table. Her mother listened, her eyes slowly filling with tears. "I never knew I was in your picture," she whispered. Emma leaned against her shoulder, and they sat quietly in the warm kitchen light, closer than ever.',
      },
      {
        label: '中等示例',
        content:
          'Paragraph 1: Emma stood still, not knowing what to say. Her mother give her the painting and say the frame is broken. She go out to fix it this morning. Emma feel very sorry and say sorry to her mother.\n\n' +
          'Paragraph 2: That evening, Emma sat beside her mother and showed her the painting. She tell her mother why she draw this picture. Her mother is very happy and they hug each other. Emma love her mother more now.',
      },
      {
        label: '零分示例',
        content: 'Paragraph 1: Emma stood still. Her mother came to her. Paragraph 2: That evening, Emma and her mother were happy. （只有几句，没有情节推进与描写，词数不足 40 词）',
      },
    ],
  },
  {
    id: 'english-q9',
    no: 9,
    kindLabel: '读后续写',
    stem:
      '阅读下面材料，根据其内容和所给段落开头语续写两段，使之构成一个完整的故事。\n' +
      'Read the passage below and continue the story in two paragraphs. Keep the characters and the plot consistent with the given text.\n' +
      'Paragraph 1: With only thirty seconds left, Ben got the ball and two players in white rushed towards him.\n' +
      'Paragraph 2: After the game, our coach gathered us around him and said nothing about the score.\n' +
      'Notes:\n' +
      '1. about 150 words in total for the two paragraphs;\n' +
      '2. use as many different sentence patterns as possible;\n' +
      '3. try not to copy the original sentences.\n' +
      '（本题为英语读后续写，续写两段，使之构成一个完整的故事。请用英文作答。）',
    material:
      'Our class basketball team had reached the final of the school tournament, and everyone believed that Ben, our best player, would lead us to victory. But in the first half, Ben kept the ball to himself, took every shot and missed most of them. By half time we were ten points behind, and our coach looked serious. In the locker room nobody spoke. Ben sat alone in the corner, staring at the floor, while the rest of us exchanged glances. Then our captain Tom stood up and walked towards him.\n\n' +
      '"Ben, you are our best shooter, but we are a team," Tom said quietly. "Pass the ball, and we will pass it back to you. Trust us." Ben was silent for a moment, then he nodded and held out his hand. In the second half, everything changed. He began to look for his teammates, and suddenly our small forward Peter was free under the basket. The ball moved quickly from hand to hand, and the score began to climb. With two minutes left, we were only one point behind.',
    standardAnswer:
      '内容要点：① 第一段接续比赛最后时刻：Ben 面对防守做出选择（传球给队友或果断投篮），队友配合，比赛以合理方式结束（胜负不限）；② 第二段写赛后：教练或队长的言行、队员之间的交流，Ben 与队友彼此理解，团队意识得到成长；③ 情节须与原文一致：Ben 由「单打独斗」转为「信任队友」，主题落在团队合作与成长上。\n' +
      '语言与词数：两段共 150 词左右；以一般过去时为主；比赛场面宜用短句，动作描写有节奏感；赛后部分要有心理刻画与点题句。\n' +
      '参考表达：Without hesitation, he passed the ball to Peter, who jumped and scored. / The whole gym exploded with cheers. / "We fought as a team tonight," the coach said with a smile. / Winning matters, but trusting each other matters more.',
    gradingNotes:
      '读后续写按「情节衔接 + 内容充实 + 语言表达 + 篇章连贯 + 词数」分项给分。Ben 又回到单打独斗、队友反目等与原文主题矛盾的情节降档；只抄材料或只写一两句者按最低档处理。',
    defaultMaxScore: 25,
    rubric: [
      {
        id: 'english-q9-r1',
        label: '第一段写清最后时刻 Ben 的选择与队友的配合，比赛以合理方式结束',
        detail: '接住开头语，写传球或投篮的选择与结果；比赛没有结局或突然跳到赛后不得分',
        weight: 5,
      },
      {
        id: 'english-q9-r2',
        label: '第一段有比赛场面的动作描写，节奏感强，与原文情节衔接自然',
        detail: '如传球、起跳、投篮、欢呼等连续动作；只有概述没有场面描写最多得一半分',
        weight: 4,
      },
      {
        id: 'english-q9-r3',
        label: '第二段写赛后教练或队友的言行，Ben 与队友互相理解，情节收束合理',
        detail: '教练的话、Ben 的道歉或感谢、队友的回应等，写出其一即可得分，内容单薄酌情扣分',
        weight: 5,
      },
      {
        id: 'english-q9-r4',
        label: '第二段点明成长与团队意识的主题，情感真实，不生硬说教',
        detail: '主题须从赛后情节中自然引出；空喊团结口号只得一半分',
        weight: 3,
      },
      {
        id: 'english-q9-r5',
        label: '语言表达：时态准确，动词与句式丰富，比赛描写生动',
        detail: '以一般过去时为主；动作动词准确、句式有变化；语法错误较多者相应扣分',
        weight: 5,
      },
      {
        id: 'english-q9-r6',
        label: '篇章连贯：与开头语衔接自然，两段逻辑清楚；词数 150 左右',
        detail: '词数不足 100 词扣分，不足 60 词不得分；两段之间要有时间上的推进',
        weight: 3,
      },
    ],
    levels: [
      '只抄写原文或只写一两句，比赛没有结局，与开头语无法衔接，词数严重不足',
      '情节与原文矛盾（如 Ben 依旧单打独斗、队友互相埋怨），语言错误多，词数不足 60 词',
      '写完了比赛与赛后，但情节简单，缺少场面描写，语言错误较多，两段衔接生硬，词数约 70~100 词',
      '情节与原文基本一致，两段完整，有一定场面与心理描写，语言错误不影响理解，词数约 100~130 词',
      '情节连贯，比赛描写有节奏感，成长主题表达较自然，语言基本准确，词数 150 词左右',
      '情节与原文高度融洽，场面描写生动、节奏分明，团队成长的主题自然升华，语言准确丰富，词数 150 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'Paragraph 1: With only thirty seconds left, Ben got the ball and two players in white rushed towards him. For a moment the old habit came back and he lifted the ball to shoot. But then he saw Peter, who was standing alone under the basket, waving his hand. Without hesitation, Ben threw a quick pass. Peter jumped, the ball dropped softly through the net, and the whole gym exploded with cheers. Our bench rushed onto the court, shouting and laughing together.\n\n' +
          'Paragraph 2: After the game, our coach gathered us around him and said nothing about the score. "You fought as a team tonight," he said at last, looking at Ben. Ben smiled and put his arm around Peter\'s shoulder. On our way back to the classroom, he told me that he had finally understood something: one star can light a corner, but only a team can light the whole sky.',
      },
      {
        label: '中等示例',
        content:
          'Paragraph 1: With only thirty seconds left, Ben got the ball and two players in white rushed towards him. He pass the ball to Peter. Peter shoot and get two points. We are all very happy and jump.\n\n' +
          'Paragraph 2: After the game, our coach gather us and say we are a team. Ben say sorry to us. We say it is OK. We learn that we must work together.',
      },
      {
        label: '零分示例',
        content: 'Paragraph 1: With only thirty seconds left, Ben got the ball. He was very nervous. Paragraph 2: After the game, we were very tired. （只有几句，比赛没有结局，主题缺失，词数不足 40 词）',
      },
    ],
  },
  {
    id: 'english-q10',
    no: 10,
    kindLabel: '议论文写作',
    stem:
      'Your school English newspaper is collecting articles on the topic "Smartphones and Teenagers". Write a short essay in English. Your essay should include:\n' +
      '1. the convenience smartphones bring to teenagers;\n' +
      '2. the problems caused by overusing smartphones;\n' +
      '3. your own opinion or suggestions.\n' +
      'Notes:\n' +
      '1. about 120 words;\n' +
      '2. state your opinion clearly and support it with reasons or examples;\n' +
      '3. do not use your real name or the name of your school.\n' +
      '（本题为英语议论文写作，请用英文作答。）',
    standardAnswer:
      '内容要点：① 指出智能手机给青少年带来的便利（如查资料、在线学习、与家人朋友联系、便捷支付等）；② 分析过度使用带来的问题（如影响视力与睡眠、分散学习注意力、沉迷游戏与短视频、减少面对面交流）；③ 给出自己的观点或建议（如合理安排使用时间、用手机辅助学习、多参加线下活动）。\n' +
      '语言与词数：词数 120 左右；以一般现在时为主；有主题句与衔接词（First of all, However, In my opinion, Therefore 等），论证清楚、逻辑连贯。\n' +
      '参考表达：Smartphones have become part of our daily life. / On the one hand,... On the other hand,... / However, spending too much time on them does harm to our health and study. / In my opinion, the key is how we use them. / Only in this way can technology really serve us.',
    gradingNotes:
      '议论文按「观点 + 论证 + 结构语言 + 词数」分项给分。只罗列现象而无明确观点、只喊口号或大量套话者降档；能辩证看待利弊并给出可行建议者给高分。',
    defaultMaxScore: 25,
    rubric: [
      {
        id: 'english-q10-r1',
        label: '明确写出智能手机给青少年带来的便利，至少一点',
        detail: '如查资料、在线学习、与亲友联系；只写 students like phones 不得分',
        weight: 5,
      },
      {
        id: 'english-q10-r2',
        label: '明确写出过度使用智能手机造成的问题，至少一点',
        detail: '如影响视力与睡眠、分散注意力、沉迷游戏、减少交流；须说明影响，只写 bad for us 不得分',
        weight: 5,
      },
      {
        id: 'english-q10-r3',
        label: '给出自己的观点或建议，态度明确',
        detail: '如合理控制使用时间、用手机辅助学习、多参加线下活动；有明确的 I think / In my opinion 等立场表达',
        weight: 6,
      },
      {
        id: 'english-q10-r4',
        label: '论证充分，有理由、事例或对比支撑，不是只罗列现象',
        detail: '至少一条理由或一个事例支撑观点；只有现象罗列最多得一半分',
        weight: 4,
      },
      {
        id: 'english-q10-r5',
        label: '结构完整，有主题句与衔接词，段落层次清楚',
        detail: '如 On the one hand... On the other hand... / However / In my opinion 等，段落分明',
        weight: 3,
      },
      {
        id: 'english-q10-r6',
        label: '词数 120 左右',
        detail: '少于 80 词扣分，少于 60 词不得分；明显超出较多不额外加分',
        weight: 2,
      },
    ],
    levels: [
      '只有一两句英文或照抄题目，没有观点与论证，词数严重不足',
      '提到手机，但只罗列现象或口号式表达，没有明确观点，语言错误多，词数不足 60 词',
      '有简单观点，利弊中只写出一方面，论证薄弱，语言错误较多，结构不完整，词数约 70~90 词',
      '观点基本明确，利弊两方面都写到，论证较简单，语言错误不影响理解，词数约 90~110 词',
      '观点明确，利弊分析较充分，有理由或事例支撑，结构完整，语言基本准确，词数 120 词左右',
      '观点鲜明且有深度，利弊分析辩证全面，论据充实，衔接自然，语言准确流畅，词数 120 词左右',
    ],
    demoAnswers: [
      {
        label: '满分示例',
        content:
          'Smartphones have become part of our daily life, and for teenagers they are a double-edged sword.\n\n' +
          'On the one hand, smartphones make our life much easier. We can look up new words in a second, take online courses at home and keep in touch with our parents and friends anytime. On the other hand, spending too much time on them does harm. Many students stay up late playing games or watching short videos, so they feel sleepy in class and their eyesight gets worse. Some even talk less with others.\n\n' +
          'In my opinion, the key is how we use them. We should set a time limit for entertainment and use the phone mainly as a learning tool. Only then can technology really serve us instead of controlling us.',
      },
      {
        label: '中等示例',
        content:
          'Nowadays almost every student have a smartphone. It is very useful. We can search some information and learn English on it. But it also have many problems. Some students play games all the time and don\'t want to study. Their eyes is bad and they can\'t finish homework. I think we should not use phone too much. We must study hard.',
      },
      {
        label: '零分示例',
        content: 'I think smartphone is very useful. Many students like it very much. （只有两句，没有观点与论证，词数不足 30 词）',
      },
    ],
  },
]