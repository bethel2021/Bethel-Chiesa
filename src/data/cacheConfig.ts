export const PUBLIC_CACHE_KEY = 'bethel_church_public_bundle_v3';
export const PUBLIC_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes local cache TTL
export const BOOTSTRAPPED_ADMIN_EMAIL = 'chinarenzhian@gmail.com';

export const SUNDAY_SUMMARY_SCHEDULE = [
  { label: '主日崇拜', time: '每周日14:30-16:30' },
  { label: '儿童主日学', time: '每周日14:30-16:30' },
] as const;

export const FIELD_LIMITS = {
  churchInfo: {
    name: 100,
    founded: 100,
    scriptureQuote: 400,
    scriptureRef: 100,
    heroSubtitle: 400,
    heroImage: 480_000,
    fellowshipImage: 240_000,
    address: 300,
    shortAddress: 100,
    pastoralPhone: 100,
    themeVerse: 300,
    themeVerseRef: 100,
    thisWeekLabel: 60,
    nextWeekLabel: 60,
    introParagraphMaxCount: 10,
    introParagraphLen: 1000,
    coreValuesMaxCount: 10,
    coreValueIndex: 10,
    coreValueTitle: 60,
    coreValueDescription: 300,
  },
  pastor: {
    name: 80,
    role: 120,
    tenure: 60,
    image: 120_000,
    education: 200,
    ministryFocus: 200,
    bio: 1200,
  },
  coworker: {
    name: 80,
    title: 120,
    image: 60_000,
  },
  worshipTime: {
    time: 60,
    title: 120,
    place: 120,
    desc: 300,
  },
  liturgyStep: {
    time: 40,
    step: 120,
    scriptureOrHymn: 200,
    leader: 100,
    note: 500,
  },
  worshipSong: {
    title: 140,
    youtubeUrl: 500,
  },
  ministryRoster: {
    role: 140,
    thisWeek: 200,
    nextWeek: 200,
  },
  weekdayMinistry: {
    day: 20,
    time: 60,
    title: 120,
    location: 160,
    leader: 120,
    description: 400,
  },
  announcement: {
    date: 80,
    title: 160,
    summary: 400,
    time: 100,
    location: 160,
    contact: 120,
    image: 80_000,
    detailsMaxCount: 20,
    detailLen: 800,
  },
  visitorRequest: {
    name: 80,
    contact: 140,
    intent: 100,
    message: 1000,
    adminNote: 500,
  },
  adminUser: {
    uid: 128,
    email: 160,
    displayName: 80,
  },
} as const;
