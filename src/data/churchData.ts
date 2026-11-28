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
  churchTeamImage: string;
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
  scriptureOrHymn?: string;
  leader: string;
  note: string;
  sortOrder: number;
}

export type MinistryRosterCategory =
  | 'choir'
  | 'small-group'
  | 'youth'
  | 'sunday-school';

export const MINISTRY_CATEGORY_OPTIONS: { id: MinistryRosterCategory; label: string }[] = [
  { id: 'choir', label: '敬拜诗班' },
  { id: 'small-group', label: '幸福小组' },
  { id: 'youth', label: '青年团契' },
  { id: 'sunday-school', label: '主日学' },
];

export const MINISTRY_CATEGORY_ORDER: Record<MinistryRosterCategory, number> = {
  choir: 0,
  'small-group': 1,
  youth: 2,
  'sunday-school': 3,
};

export const MINISTRY_CATEGORY_LABELS: Record<MinistryRosterCategory, string> = {
  choir: '敬拜诗班',
  'small-group': '幸福小组',
  youth: '青年团契',
  'sunday-school': '主日学',
};

export function normalizeMinistryCategory(category: unknown): MinistryRosterCategory {
  switch (category) {
    case 'choir':
    case 'small-group':
    case 'youth':
    case 'sunday-school':
      return category;
    case 'fellowship':
    case 'care':
      return 'small-group';
    default:
      return 'choir';
  }
}

export interface MinistryRosterItem {
  id: string;
  category: MinistryRosterCategory;
  title: string;
  image: string;
  galleryImages?: string[];
  schedule: string;
  description: string;
  sortOrder: number;
}

export interface WeekdayMinistry {
  id: string;
  day: string;
  time: string;
  title: string;
  location?: string;
  leader?: string;
  description?: string;
  sortOrder: number;
}

export interface AnnouncementItem {
  id: string;
  category: '特别聚会' | '家事注意';
  date?: string;
  title: string;
  summary: string;
  time?: string;
  location?: string;
  contact?: string;
  image?: string;
  isFeatured: boolean;
  details: string[];
  sortOrder: number;
}

export interface VisitorRequestItem {
  id: string;
  name: string;
  contact: string;
  intent?: string;
  message: string;
  status: 'pending' | 'contacted' | 'archived';
  adminNote?: string;
  createdAt?: unknown;
}

export interface AdminUserItem {
  uid: string;
  email: string;
  displayName: string;
  canViewVisitorStats?: boolean;
  addedAt?: unknown;
}

export interface VisitorStatsSummary {
  totalVisitors: number;
  lastVisitorId: string;
  updatedAt?: unknown;
}

export interface VisitorIpRecord {
  id: string;
  country?: string;
  region?: string;
  countedAt?: unknown;
}

export const EMPTY_CHURCH_INFO: ChurchInfo = {
  name: '',
  founded: '',
  scriptureQuote: '',
  scriptureRef: '',
  heroSubtitle: '',
  heroImage: '',
  fellowshipImage: '',
  churchTeamImage: '',
  address: '',
  shortAddress: '',
  pastoralPhone: '',
  themeVerse: '',
  themeVerseRef: '',
  thisWeekLabel: '',
  nextWeekLabel: '',
  siteTheme: 'classic',
  introParagraphs: [],
  coreValues: [],
};
