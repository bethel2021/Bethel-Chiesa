import type { SiteThemeId } from './themes';

export interface CoreValueItem {
  index: string;
  title: string;
  description: string;
}

export interface ChurchInfo {
  name: string;
  founded: string;
  scriptureQuote: string;
  scriptureRef: string;
  heroSubtitle: string;
  heroImage: string;
  fellowshipImage: string;
  address: string;
  shortAddress: string;
  pastoralPhone: string;
  themeVerse: string;
  themeVerseRef: string;
  thisWeekLabel: string;
  nextWeekLabel: string;
  siteTheme?: SiteThemeId;
  introParagraphs: string[];
  coreValues: CoreValueItem[];
}

export interface PastorProfile {
  id: string;
  name: string;
  role: string;
  tenure: string;
  image: string;
  education: string;
  ministryFocus: string;
  bio: string;
  sortOrder: number;
}

export interface PulpitCoworker {
  id: string;
  name: string;
  title: string;
  image?: string;
  sortOrder: number;
}

export interface WorshipTimeSlot {
  id: string;
  time: string;
  title: string;
  place: string;
  desc: string;
  sortOrder: number;
}

export interface LiturgyStep {
  id: string;
  liturgyType: 'standard' | 'communion';
  time: string;
  step: string;
  scriptureOrHymn: string;
  leader: string;
  note: string;
  sortOrder: number;
}

export interface WorshipSong {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeUrl2?: string;
  sortOrder: number;
}

export type MinistryRosterCategory =
  | 'worship'
  | 'sunday-school-fellowship'
  | 'prayer-bible'
  | 'media-tech'
  | 'hospitality-logistics'
  | 'outreach';

export const MINISTRY_CATEGORY_OPTIONS: { id: MinistryRosterCategory; label: string }[] = [
  { id: 'worship', label: '讲台与敬拜' },
  { id: 'prayer-bible', label: '祷告与读经' },
  { id: 'media-tech', label: '音画影音技术' },
  { id: 'hospitality-logistics', label: '接待与后勤' },
  { id: 'sunday-school-fellowship', label: '主日学与团契' },
  { id: 'outreach', label: '外派事工' },
];

export const MINISTRY_CATEGORY_ORDER: Record<MinistryRosterCategory, number> = {
  worship: 0,
  'prayer-bible': 1,
  'media-tech': 2,
  'hospitality-logistics': 3,
  'sunday-school-fellowship': 4,
  outreach: 5,
};

export const MINISTRY_CATEGORY_LABELS: Record<MinistryRosterCategory, string> = {
  worship: '讲台与敬拜',
  'prayer-bible': '祷告与读经',
  'media-tech': '音画影音技术',
  'hospitality-logistics': '接待与后勤',
  'sunday-school-fellowship': '主日学与团契',
  outreach: '外派事工',
};

export function normalizeMinistryCategory(category: unknown): MinistryRosterCategory {
  switch (category) {
    case 'worship':
    case 'sunday-school-fellowship':
    case 'prayer-bible':
    case 'media-tech':
    case 'hospitality-logistics':
    case 'outreach':
      return category;
    case 'sunday-school':
    case 'fellowship':
      return 'sunday-school-fellowship';
    default:
      return 'worship';
  }
}

export interface MinistryRosterItem {
  id: string;
  category: MinistryRosterCategory;
  role: string;
  thisWeek: string;
  nextWeek: string;
  sortOrder: number;
}

export interface WeekdayMinistry {
  id: string;
  day: string;
  time: string;
  title: string;
  location: string;
  leader: string;
  description: string;
  sortOrder: number;
}

export interface AnnouncementItem {
  id: string;
  category: '特别聚会' | '洗礼与课程' | '社区关怀' | '诗班与事奉';
  date: string;
  title: string;
  summary: string;
  time: string;
  location: string;
  contact: string;
  isFeatured: boolean;
  details: string[];
  sortOrder: number;
}

export interface VisitorRequestItem {
  id: string;
  name: string;
  contact: string;
  intent: string;
  message: string;
  status: 'pending' | 'contacted' | 'archived';
  adminNote?: string;
  createdAt?: unknown;
}

export interface AdminUserItem {
  uid: string;
  email: string;
  displayName: string;
  addedAt?: unknown;
}

export const CHURCH_IMAGES = {
  heroSanctuary: '/src/assets/images/bethel_sanctuary_hero_1794817207275.jpg',
  fellowshipIntro: '/src/assets/images/bethel_fellowship_intro_1794817208327.jpg',
  pastorLin: '/src/assets/images/pastor_lin_1794817209153.jpg',
  pastorChen: '/src/assets/images/pastor_chen_1794817209275.jpg',
  ministerZhao: '/src/assets/images/minister_zhao_1794817210642.jpg',
} as const;

export const CHURCH_INFO: ChurchInfo = {
  name: '伯特利教会',
  founded: '始建于 1998 年',
  scriptureQuote: '「这地方何等可畏！这不是别的，乃是神的殿，也是天的门。」',
  scriptureRef: '创世记 28:17',
  heroSubtitle: '每周主日 09:30 主堂崇拜 · 诚挚欢迎每一位寻求真理、渴望在基督里得享安息的朋友',
  heroImage: CHURCH_IMAGES.heroSanctuary,
  fellowshipImage: CHURCH_IMAGES.fellowshipIntro,
  address: 'VIA ANTONIO STRADIVARI 19, PRATO',
  shortAddress: 'VIA ANTONIO STRADIVARI 19, PRATO',
  pastoralPhone: '021-6438-2819',
  themeVerse: '「你们要彼此相爱，像我爱你们一样，这就是我的命令。」',
  themeVerseRef: '约翰福音 15:12 · 伯特利教会年度主题经文',
  thisWeekLabel: '本周主日 · 11月15日',
  nextWeekLabel: '下周主日 · 11月22日',
  siteTheme: 'classic',
  introParagraphs: [
    '伯特利教会设立于 1998 年秋，是一间秉承使徒信经与宗教改革纯正信仰传统的基督教地方教会。「伯特利」（Bethel）意为「神的殿」，正如雅各在旷野梦中见天梯而发出的赞叹，我们盼望这间教会成为城市中人遇见神、得蒙赦罪与更新的生命驿站。',
    '二十余年来，教会始终坚持「以圣道为根基、以敬拜为核心、以团契为纽带、以宣教为使命」的牧养方向。无论你是初涉信仰的慕道朋友，或是多年同行主路的肢体，都能在真理的教导与弟兄姊妹真诚的守望中，经历从神而来的平安与力量。',
  ],
  coreValues: [
    {
      index: '01',
      title: '扎根圣道',
      description: '忠心按正意分解圣经真理，坚持每周逐卷释经讲道与系统主日学门徒栽培。',
    },
    {
      index: '02',
      title: '圣洁敬拜',
      description: '融合历代教会经典圣诗与诚实心灵的颂赞，让主日崇拜归荣耀予三一真神。',
    },
    {
      index: '03',
      title: '团契相爱',
      description: '借着儿童主日学、家庭小组与爱筵交通，在日常光阴中彼此扶持、担代重担。',
    },
    {
      index: '04',
      title: '邻舍关怀',
      description: '走入社区探访孤寡长者、服事新市民家庭，以基督的怜悯见证福音的大能。',
    },
  ],
};

export const PASTORS_TEAM: PastorProfile[] = [
  {
    id: 'pastor-lin',
    name: '林恩典 牧师',
    role: '主任牧师 · 讲台总负责',
    tenure: '事奉 18 年',
    image: CHURCH_IMAGES.pastorLin,
    education: '道学硕士（M.Div）· 圣经释经学教牧博士',
    ministryFocus: '主日释经讲道 · 教会治理 · 传道人培育',
    bio: '自 2008 年受按立牧职并在伯特利教会全职服事至今。讲道风格沉稳清晰、深植圣经上下文与历史神学脉络，近年致力于带领全教会研读新约书信与旧约先知书，看重信徒在职场与家庭中的信仰践行。',
    sortOrder: 1,
  },
  {
    id: 'pastor-chen',
    name: '陈雅惠 牧师',
    role: '副牧师 · 牧养与主日学事工',
    tenure: '事奉 12 年',
    image: CHURCH_IMAGES.pastorChen,
    education: '基督教教育硕士 · 教牧辅导专科进修',
    ministryFocus: '慕道造就 · 家庭婚姻辅导 · 姊妹与儿童事工',
    bio: '主责教会主日学课程体系、新朋友迎新跟进及婚姻家庭辅导。陈牧师以温柔而坚定的牧养心肠陪伴许多家庭度过人生低谷，并带领同工团队建立完善的分龄儿童与青少年信仰教育机制。',
    sortOrder: 2,
  },
  {
    id: 'minister-zhao',
    name: '赵信义 长老',
    role: '讲台同工 · 青年与敬拜事工长老',
    tenure: '事奉 10 年',
    image: CHURCH_IMAGES.ministerZhao,
    education: '圣经研究文凭 · 教会圣乐事奉研习',
    ministryFocus: '主日讲台轮值 · 青年团契 · 圣乐敬拜编排',
    bio: '曾任高校人文讲师，后蒙召全心委身教会讲台与青年牧养。协助主任牧师承担主日及周间查经讲台服事，并统筹诗班与敬拜赞美团队，推动圣诗神学与当代会众敬拜的深度结合。',
    sortOrder: 3,
  },
];

export const PULPIT_COWORKERS: PulpitCoworker[] = [
  {
    id: 'cw-zhou',
    name: '周以撒 传道',
    title: '全职传道 · 青年与校园事工',
    sortOrder: 1,
  },
  {
    id: 'cw-xu',
    name: '许保罗 长老',
    title: '教会长老 · 宣教与探访事工',
    sortOrder: 2,
  },
  {
    id: 'cw-zhang',
    name: '张书亚 弟兄',
    title: '讲台见习传道 · 成人主日学教师',
    sortOrder: 3,
  },
  {
    id: 'cw-su',
    name: '苏米利暗 姊妹',
    title: '圣乐执事 · 诗班指挥',
    sortOrder: 4,
  },
];

export const SUNDAY_WORSHIP_TIMES: WorshipTimeSlot[] = [
  {
    id: 'wt-1',
    time: '08:45 – 09:15',
    title: '主日晨更祷告会',
    place: '二楼副堂祈祷室',
    desc: '为当日讲台、会众心灵与城市灵魂守望代祷',
    sortOrder: 1,
  },
  {
    id: 'wt-2',
    time: '09:30 – 11:15',
    title: '主日圣道崇拜（同步儿童看顾）',
    place: '一楼大堂',
    desc: '敬拜赞美、公祷读经、牧师证道与奉献回应',
    sortOrder: 2,
  },
  {
    id: 'wt-3',
    time: '11:25 – 12:30',
    title: '新朋友茶叙与弟兄姊妹爱筵',
    place: '一楼交谊厅与餐厅',
    desc: '欢迎初次来访朋友与牧者同工共进简餐交通',
    sortOrder: 3,
  },
  {
    id: 'wt-4',
    time: '13:00 – 14:15',
    title: '儿童主日学与下午团契',
    place: '二、三楼各教室',
    desc: '成人研经、慕道班、青少年及儿童分龄课程',
    sortOrder: 4,
  },
];

export const LITURGY_STANDARD: LiturgyStep[] = [
  {
    id: 'ls-std-1',
    liturgyType: 'standard',
    time: '09:30',
    step: '序乐与静默预备',
    scriptureOrHymn: '钢琴序奏《主在圣殿中》',
    leader: '司琴 · 会众静默',
    note: '请会众提前入座，将手机调至静音，在祷告中预备心灵朝见主面。',
    sortOrder: 1,
  },
  {
    id: 'ls-std-2',
    liturgyType: 'standard',
    time: '09:35',
    step: '宣召与启应经文',
    scriptureOrHymn: '诗篇 100:1–5',
    leader: '主日司会',
    note: '司会诵读宣召经文，会众起立同声朗诵启应经文并献上开会祷告。',
    sortOrder: 2,
  },
  {
    id: 'ls-std-3',
    liturgyType: 'standard',
    time: '09:42',
    step: '会众敬拜赞美',
    scriptureOrHymn: '《圣哉三一》《奇异恩典》《耶稣恩友》',
    leader: '敬拜领诗团队',
    note: '藉着古典圣诗与敬拜诗歌，数算主恩，高举基督十架的救赎。',
    sortOrder: 3,
  },
  {
    id: 'ls-std-4',
    liturgyType: 'standard',
    time: '10:05',
    step: '牧祷与认信',
    scriptureOrHymn: '同诵《使徒信经》· 教会公祷',
    leader: '牧者或长老',
    note: '为国家社会平安、教会宣教事工及软弱肢体的需要同心代祷。',
    sortOrder: 4,
  },
  {
    id: 'ls-std-5',
    liturgyType: 'standard',
    time: '10:15',
    step: '读经与证道',
    scriptureOrHymn: '罗马书 8:18–25 · 讲题：《受造之物切望等候》',
    leader: '林恩典 牧师',
    note: '约 45 分钟释经讲道，配有讲道大纲单张及大堂屏幕经文对照。',
    sortOrder: 5,
  },
  {
    id: 'ls-std-6',
    liturgyType: 'standard',
    time: '11:00',
    step: '回应诗歌与奉献',
    scriptureOrHymn: '《愿主赐福看顾你》· 什一及感恩奉献',
    leader: '司会 · 招待同工',
    note: '新朋友无需勉强奉献；基督徒凭感恩与甘心乐意的心向主献上礼物。',
    sortOrder: 6,
  },
  {
    id: 'ls-std-7',
    liturgyType: 'standard',
    time: '11:10',
    step: '欢迎新朋友、报告与祝福',
    scriptureOrHymn: '《三一颂》· 牧师祝福祷告',
    leader: '牧师 · 司会',
    note: '宣布本周聚会事项，领受差遣与祝福后移步交谊厅享用爱筵茶叙。',
    sortOrder: 7,
  },
];

export const LITURGY_COMMUNION: LiturgyStep[] = [
  {
    id: 'ls-com-1',
    liturgyType: 'communion',
    time: '09:30',
    step: '序乐、宣召与敬拜赞美',
    scriptureOrHymn: '诗篇 24 篇 · 敬拜诗歌三首',
    leader: '司会 · 诗班',
    note: '每月第一主日为圣餐主日，全堂进入庄严感恩的圣餐预备氛围。',
    sortOrder: 1,
  },
  {
    id: 'ls-com-2',
    liturgyType: 'communion',
    time: '10:00',
    step: '省察认罪与赦免宣告',
    scriptureOrHymn: '约翰一书 1:8–9 · 默祷省察',
    leader: '主持牧师',
    note: '会众在主前静默省察己罪，领受神因基督宝血而赐下的赦免确据。',
    sortOrder: 2,
  },
  {
    id: 'ls-com-3',
    liturgyType: 'communion',
    time: '10:10',
    step: '证道：真道宣讲',
    scriptureOrHymn: '哥林多前书 11:23–29',
    leader: '林恩典 牧师',
    note: '约 35 分钟主题短讲，阐明主设立圣餐之立约意义与肢体合一。',
    sortOrder: 3,
  },
  {
    id: 'ls-com-4',
    liturgyType: 'communion',
    time: '10:45',
    step: '祝谢擘饼与分领圣餐',
    scriptureOrHymn: '回应圣诗《古旧十架》',
    leader: '主礼牧师 · 长老襄礼',
    note: '已受洗且与众教会相通之信徒可同领饼杯；未受洗朋友请静默观礼代祷。',
    sortOrder: 4,
  },
  {
    id: 'ls-com-5',
    liturgyType: 'communion',
    time: '11:05',
    step: '感恩奉献、家事报告与祝福',
    scriptureOrHymn: '《三一颂》· 差遣祝福',
    leader: '牧师 · 司会',
    note: '崇拜结束后欢迎至一楼交谊厅参与圣餐主日爱筵。',
    sortOrder: 5,
  },
];

export const WORSHIP_SONGS: WorshipSong[] = [
  {
    id: 'song-1',
    title: '《圣哉三一》（Holy, Holy, Holy）',
    youtubeUrl: 'https://www.youtube.com/results?search_query=Holy+Holy+Holy+%E5%9C%A3%E5%93%89%E4%B8%89%E4%B8%80+%E8%B5%9E%E7%BE%8E%E8%AF%97',
    youtubeUrl2: '',
    sortOrder: 1,
  },
  {
    id: 'song-2',
    title: '《奇异恩典》（Amazing Grace）',
    youtubeUrl: 'https://www.youtube.com/results?search_query=Amazing+Grace+%E5%A5%87%E5%BC%82%E6%81%A9%E5%85%B8+%E8%B5%9E%E7%BE%8E%E8%AF%97',
    youtubeUrl2: '',
    sortOrder: 2,
  },
  {
    id: 'song-3',
    title: '《耶稣恩友》（What a Friend We Have in Jesus）',
    youtubeUrl: 'https://www.youtube.com/results?search_query=What+a+Friend+We+Have+in+Jesus+%E8%80%B6%E7%A8%A3%E6%81%A9%E5%8F%8B',
    youtubeUrl2: '',
    sortOrder: 3,
  },
  {
    id: 'song-4',
    title: '《愿主赐福看顾你》（The Lord Bless You and Keep You）',
    youtubeUrl: 'https://www.youtube.com/results?search_query=The+Lord+Bless+You+and+Keep+You+%E6%84%BF%E4%B8%BB%E8%B5%90%E7%A6%8F%E7%9C%8B%E9%A1%BE%E4%BD%A0',
    youtubeUrl2: '',
    sortOrder: 4,
  },
];

export const SUNDAY_MINISTRY_ROSTER: MinistryRosterItem[] = [
  {
    id: 'w1',
    category: 'worship',
    role: '讲台证道',
    thisWeek: '林恩典 牧师',
    nextWeek: '赵信义 长老',
    sortOrder: 1,
  },
  {
    id: 'w2',
    category: 'worship',
    role: '主日司会 / 领祷',
    thisWeek: '周以撒 传道',
    nextWeek: '许保罗 长老',
    sortOrder: 2,
  },
  {
    id: 'w3',
    category: 'worship',
    role: '敬拜领诗与赞美小组',
    thisWeek: '苏米利暗 姊妹（领诗）· 诗班一组',
    nextWeek: '李约拿 弟兄（领诗）· 敬拜二组',
    sortOrder: 3,
  },
  {
    id: 'w4',
    category: 'worship',
    role: '司琴与乐队配搭',
    thisWeek: '钢琴：王路得 · 大提琴：陈约瑟',
    nextWeek: '钢琴：吴以斯帖 · 吉他：郑马可',
    sortOrder: 4,
  },
  {
    id: 'p1',
    category: 'prayer-bible',
    role: '主日晨更祷告与代祷守望',
    thisWeek: '陈雅惠 牧师 · 李约拿 弟兄',
    nextWeek: '许保罗 长老 · 苏米利暗 姊妹',
    sortOrder: 5,
  },
  {
    id: 'p2',
    category: 'prayer-bible',
    role: '会众读经与启应经文领读',
    thisWeek: '张书亚 弟兄',
    nextWeek: '王路得 姊妹',
    sortOrder: 6,
  },
  {
    id: 'w5',
    category: 'media-tech',
    role: '音控、字幕与直播同工',
    thisWeek: '音控：刘巴拿巴 · 投影：沈马利亚',
    nextWeek: '音控：郭提摩太 · 投影：林百基拉',
    sortOrder: 7,
  },
  {
    id: 'w6',
    category: 'hospitality-logistics',
    role: '迎新招待与奉献统计',
    thisWeek: '高亚居拉 夫妇 · 孙马大 姊妹',
    nextWeek: '杨腓力 弟兄 · 蔡吕底亚 姊妹',
    sortOrder: 8,
  },
  {
    id: 'w7',
    category: 'hospitality-logistics',
    role: '主日爱筵膳食预备',
    thisWeek: '迦南一组（负责人：何司提反）',
    nextWeek: '恩慈小组（负责人：徐多加）',
    sortOrder: 9,
  },
  {
    id: 's1',
    category: 'sunday-school-fellowship',
    role: '成人主日学（《罗马书》研经班）',
    thisWeek: '张书亚 弟兄（第 7 课：圣灵里的生命）',
    nextWeek: '张书亚 弟兄（第 8 课：神的拣选与怜悯）',
    sortOrder: 10,
  },
  {
    id: 's2',
    category: 'sunday-school-fellowship',
    role: '新生命慕道班（福音初探）',
    thisWeek: '陈雅惠 牧师（第 3 课：认识耶稣是谁）',
    nextWeek: '陈雅惠 牧师（第 4 课：十字架与复活）',
    sortOrder: 11,
  },
  {
    id: 's3',
    category: 'sunday-school-fellowship',
    role: '青少年主日学（12–17 岁）',
    thisWeek: '周以撒 传道 · 助教：陆约书亚',
    nextWeek: '周以撒 传道 · 助教：方以琳',
    sortOrder: 12,
  },
  {
    id: 's4',
    category: 'sunday-school-fellowship',
    role: '儿童主日学（小羊班 7–11 岁 / 幼幼班 3–6 岁）',
    thisWeek: '小羊班：唐哈拿 · 幼幼班：袁拉结 / 潘撒母耳',
    nextWeek: '小羊班：钱以利沙伯 · 幼幼班：董底波拉 / 马提多',
    sortOrder: 13,
  },
  {
    id: 'f1',
    category: 'sunday-school-fellowship',
    role: '常青长辈团契（60 岁以上）',
    thisWeek: '领会：许保罗 长老（诗歌见证与代祷）',
    nextWeek: '领会：冯伯妮基 姊妹（冬季养生与属灵操练）',
    sortOrder: 14,
  },
  {
    id: 'f2',
    category: 'sunday-school-fellowship',
    role: '迦南夫妻家庭团契',
    thisWeek: '带领：林恩典 牧师夫妇（家庭祭坛实操）',
    nextWeek: '本月休会一次（各家庭回家探亲与亲子时光）',
    sortOrder: 15,
  },
  {
    id: 'f3',
    category: 'sunday-school-fellowship',
    role: '以勒青年与职场团契',
    thisWeek: '赵信义 长老（职场伦理：工作与召命）',
    nextWeek: '周以撒 传道（小组分享与户外徒步预告）',
    sortOrder: 16,
  },
  {
    id: 'o1',
    category: 'outreach',
    role: '外派证道与友会宣教配搭',
    thisWeek: '赵信义 长老（佛罗伦萨堂点证道）',
    nextWeek: '周以撒 传道（周边学生团契服事）',
    sortOrder: 17,
  },
];

export const WEEKDAY_MINISTRIES: WeekdayMinistry[] = [
  {
    id: 'wm-tue',
    day: '周二',
    time: '19:30 – 21:00',
    title: '全教会查经祷告会',
    location: '一楼大堂（同步开启线上会议）',
    leader: '林恩典 牧师 / 张书亚 弟兄',
    description: '目前查考《诗篇》卷三，查经后分小组为教会守望、肢体疾苦及普世宣教同心祷告。',
    sortOrder: 1,
  },
  {
    id: 'wm-wed',
    day: '周三',
    time: '19:30 – 21:00',
    title: '姊妹守望祷告会 · 弟兄读书会',
    location: '二楼 201 室 / 203 室',
    leader: '陈雅惠 牧师 / 许保罗 长老',
    description: '姊妹专心为家庭、儿女与教会复兴代求；弟兄共读《属灵领袖》并互相劝勉。',
    sortOrder: 2,
  },
  {
    id: 'wm-thu',
    day: '周四',
    time: '19:30 – 21:15',
    title: '伯特利圣诗班与敬拜团排练',
    location: '一楼大堂诗班席',
    leader: '苏米利暗 执事',
    description: '灵修祷告、视唱练耳及排练当月主日献诗与节期圣乐曲目，欢迎有音乐恩赐肢体加入试音。',
    sortOrder: 3,
  },
  {
    id: 'wm-fri',
    day: '周五',
    time: '19:00 – 21:00',
    title: '校园团契 & 社区家庭查经小组',
    location: '三楼青年厅及徐汇/静安各家庭聚会点',
    leader: '周以撒 传道及各小组长',
    description: '就近在社区家庭中分享晚餐、查考主日信息延伸问题，建立彼此照应的属灵家人关系。',
    sortOrder: 4,
  },
  {
    id: 'wm-sat',
    day: '周六',
    time: '09:30 – 12:00',
    title: '社区长者探访与慈惠关怀行动',
    location: '教会集合出发 · 周边街道社区',
    leader: '许保罗 长老 · 慈惠执事会',
    description: '每月一、三周周六探访独居高龄长者及患病肢体，送去生活关怀与圣经安慰祷告。',
    sortOrder: 5,
  },
];

export const ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann-thanksgiving',
    category: '特别聚会',
    date: '2026年11月22日（下主日）',
    title: '2026 年感恩节联合主日崇拜暨岁末爱筵',
    summary: '下主日上午 09:30 将举行一年一度感恩节联合崇拜，诗班献唱感恩组曲，会后全堂共享感恩爱筵。',
    time: '11月22日（主日）09:30 – 13:30',
    location: '伯特利堂一楼大堂及餐厅',
    contact: '林恩典 牧师 / 迎新招待台',
    isFeatured: true,
    details: [
      '本次感恩节崇拜主题为「以感谢为祭献与神」（诗篇 50:14），林恩典牧师主讲感恩信息，并设会众见证分享时段。',
      '欢迎弟兄姊妹邀请亲朋好友、邻舍同事同来数算神一年来的看顾与保守。',
      '若您愿意预备一道拿手家常菜参与感恩爱筵分享，请在周四前至一楼招待处或向所在小组长登记菜名，以便餐厅统一协调摆放。',
    ],
    sortOrder: 1,
  },
  {
    id: 'ann-baptism',
    category: '洗礼与课程',
    date: '即日起至 12月06日报名',
    title: '圣诞季洗礼暨坚信礼预备班招生通知',
    summary: '拟于圣诞节前夕举行下半年洗礼，凡清楚得救并稳定参加慕道班满三个月者均可报名面谈。',
    time: '12月06日起连续三个主日 13:00',
    location: '二楼教牧会议室 204 室',
    contact: '陈雅惠 牧师',
    isFeatured: false,
    details: [
      '洗礼预备班共设三堂核心课程：《救恩确据与基本教义》《洗礼与圣餐的意义》《教会生活与圣徒相通》。',
      '请有意在 2026 年圣诞季受洗归入基督名下的弟兄姊妹，于主日崇拜后至招待台领取《洗礼申请表》，填写后交由牧者安排一对一信仰谈话。',
    ],
    sortOrder: 2,
  },
  {
    id: 'ann-choir',
    category: '诗班与事奉',
    date: '2026年11月19日（周四）起',
    title: '圣诞夜烛光崇拜诗班招募与联合练唱',
    summary: '为预备 12 月 24 日平安夜圣乐崇拜，伯特利圣诗班现诚邀识简谱或五线谱的受洗信徒加入献唱。',
    time: '每周四晚 19:30 – 21:15',
    location: '一楼大堂诗班席',
    contact: '苏米利暗 执事',
    isFeatured: false,
    details: [
      '今年圣诞圣乐献唱将呈现韩德尔《弥赛亚》选段与传统平安夜圣诗组曲。',
      '参加圣诞特别诗班的肢体需确保周四晚间及主日早 08:20 的排练出勤，无需专业声乐背景，看重忠心与合一的心志。',
    ],
    sortOrder: 3,
  },
  {
    id: 'ann-care',
    category: '社区关怀',
    date: '2026年11月28日（周六）',
    title: '冬日暖阳·社区独居长者探访与物资募集',
    summary: '入冬降温之际，慈惠事工组拟于月底周六走访周边 18 户高龄独居长者家庭，现征集全新保暖围巾与探访志工。',
    time: '11月28日（周六）09:00 集合',
    location: '伯特利堂一楼门厅集合',
    contact: '许保罗 长老',
    isFeatured: false,
    details: [
      '募集物资仅限全新包装的羊毛围巾、保温杯或无糖营养燕麦片，请于 11 月 24 日前送至教会一楼办公室。',
      '同时招募 12 位有爱心的弟兄姊妹（具备基础沟通或医护背景优先）共同参与上门问候与简单家居安全检查。',
    ],
    sortOrder: 4,
  },
  {
    id: 'ann-seekers',
    category: '洗礼与课程',
    date: '每周主日 13:00 滚动开班',
    title: '《认识信仰的起点》慕道小组持续欢迎新朋友',
    summary: '对基督教信仰感到好奇或心中有疑问的朋友，欢迎参加每周日下午的开放式慕道对谈小组。',
    time: '每周主日 13:00 – 14:15',
    location: '二楼 203 室',
    contact: '陈雅惠 牧师',
    isFeatured: false,
    details: [
      '课程涵盖「宇宙与人生的意义」「圣经可靠吗」「苦难与神的爱」「耶稣基督是谁」等八个主题，气氛轻松真诚，欢迎自由提问探讨。',
    ],
    sortOrder: 5,
  },
];
