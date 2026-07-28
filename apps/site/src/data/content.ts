/**
 * Marketing copy, in one place so the home page and /features cannot disagree.
 *
 * Every claim here is deliberately checked against what the app actually does.
 * The pronunciation check, in particular, is described as advisory because it
 * uses the browser's speech recognition and does not verify tones — overstating
 * it would be the fastest way to earn a refund request.
 */

export interface Feature {
  title: string
  body: string
  /** Decorative only; the surrounding text carries the meaning. */
  icon: string
}

export const CONTENT_STATS = [
  { value: '10,969', label: 'vocabulary entries' },
  { value: 'HSK 1–9', label: 'complete learning path' },
  { value: '9', label: 'graded readers' },
  { value: '33', label: 'reader chapters' },
] as const

export const FEATURES: Feature[] = [
  {
    title: 'Spaced repetition that tracks two skills',
    body: 'Each word carries separate intervals for recognising the meaning and recalling the pronunciation. Knowing what 朋友 means but blanking on péngyou schedules them differently, so you drill the half you actually missed.',
    icon: '◷',
  },
  {
    title: 'HSK 1–9 vocabulary, ready to study',
    body: 'More than 10,900 HSK 3.0 entries with pinyin, traditional forms and English definitions, organised from HSK 1 through the combined HSK 7–9 advanced band. Start a session for one band or let the scheduler decide what is due.',
    icon: '级',
  },
  {
    title: 'Graded readers that reinforce as you go',
    body: 'Nine stories and 33 short chapters written around the words you are learning. Each chapter introduces 10–20 new words and repeats them enough to stick. Tap any word for its meaning, toggle pinyin when you are stuck, and finish a chapter to move its new words into your dictionary.',
    icon: '書',
  },
  {
    title: 'A dictionary of everything you have met',
    body: 'Every word you have studied or read, with how well you know it, when you last saw it and which level it came from. Search in English, pinyin or characters — pengyou, péngyou and 朋友 all find the same entry.',
    icon: '⌕',
  },
  {
    title: 'Say it out loud',
    body: 'Speak a word and see what the browser heard against the characters on the card. It is a quick sanity check on your pronunciation, not a tone grader, and it never affects your review schedule.',
    icon: '◍',
  },
  {
    title: 'Progress worth looking at',
    body: 'Study streak, accuracy split by meaning versus pronunciation, a two-week forecast of what is coming due, and the words that keep tripping you up. The dashboard tells you what to do next rather than just what you did.',
    icon: '▦',
  },
]

export interface Step {
  title: string
  body: string
}

export const STEPS: Step[] = [
  {
    title: 'Sign in with Google',
    body: 'No password to invent, no email to confirm. Your progress syncs to your account, so the phone on the bus and the laptop at home stay in step.',
  },
  {
    title: 'Study what is due',
    body: 'The scheduler picks the cards, you grade each one twice — did you know how to say it, did you know what it meant. A session is however long you have.',
  },
  {
    title: 'Read something real',
    body: 'When the vocabulary starts to hold, open a reader. Words you have not met are highlighted, and finishing a chapter files them into your dictionary.',
  },
]

export interface Faq {
  q: string
  a: string
}

export const FAQS: Faq[] = [
  {
    q: 'Is there a free version?',
    a: 'Yes. The first half of HSK 1 is free with no card and no time limit, which is enough to tell whether the review loop suits you. Pro unlocks every HSK 1–9 vocabulary band and all graded readers.',
  },
  {
    q: 'What does it cost?',
    a: '€25 for a year. One price, everything included, and it does not renew into a surprise — you will know when it lapses because the app tells you before it does.',
  },
  {
    q: 'Does it check my tones?',
    a: 'No, and nothing that runs in a browser honestly can yet. The pronunciation check tells you which word the browser recognised, which catches whole-syllable mistakes but not a second tone read as a third. Treat it as a spot check, not a grader.',
  },
  {
    q: 'Can I bring vocabulary I already have?',
    a: 'Yes. There is a CSV import that reads Hack Chinese exports, including the review state, so an existing collection arrives already scheduled rather than starting from zero.',
  },
  {
    q: 'Does it work on a phone?',
    a: 'It is built mobile-first and runs in the browser, so there is no app to install and nothing to update. It works on a desktop too, and uses the extra room rather than stretching a phone layout across it.',
  },
  {
    q: 'What happens to my words if I stop paying?',
    a: 'Nothing is deleted, and anything you have already studied stays available. A lapsed subscription stops new material; it does not take your progress away.',
  },
  {
    q: 'Simplified or traditional characters?',
    a: 'Study is simplified-first, which matches HSK. Traditional forms are shown alongside where a word has one, so you can read them without switching mode.',
  },
]
