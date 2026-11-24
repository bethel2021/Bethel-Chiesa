import { serverTimestamp } from 'firebase/firestore';
import { FIELD_LIMITS } from '../data/cacheConfig';
import {
  ANNOUNCEMENTS,
  CHURCH_INFO,
  normalizeMinistryCategory,
  normalizeWeekdayMinistries,
  PASTORS_TEAM,
  type AnnouncementItem,
  type ChurchInfo,
  type MinistryRosterItem,
  type PastorProfile,
  type PulpitCoworker,
  type WeekdayMinistry,
  type WorshipSong,
} from '../data/churchData';
import { normalizeSiteTheme } from '../data/themes';
import { DATA_IMAGE_URI_REGEX, isMediaUri } from '../lib/mediaStorage';
import {
  filterSafeImageSrc,
  filterSafeYoutubeUrl,
  SAFE_HTTP_OR_ROOT_RELATIVE_REGEX,
  YOUTUBE_HTTPS_URL_REGEX,
} from './urlSafety';

export function clampStr(val: string | undefined, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

export function clampSortOrder(val: unknown, fallback = 0): number {
  const parsed = Number(val);
  return Number.isFinite(parsed) ? Math.min(1000, Math.max(0, parsed)) : fallback;
}

export function makeDocId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

export function upsertSorted<T extends { id: string; sortOrder: number }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  const next = idx >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
  return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

export function sanitizeImageRef(val: string | undefined, maxLen: number): string {
  const trimmed = String(val ?? '').trim();
  if (!trimmed) return '';
  const isSafeUrlOrPath = SAFE_HTTP_OR_ROOT_RELATIVE_REGEX.test(trimmed);
  const isSafeMediaRef = isMediaUri(trimmed);
  const isSafeDataUri = DATA_IMAGE_URI_REGEX.test(trimmed);
  if (!isSafeUrlOrPath && !isSafeMediaRef && !isSafeDataUri) {
    throw new Error('图片地址格式无效：请上传 JPG/PNG/WebP 原图，或填写以 https:// 或 / 开头的有效路径。');
  }
  if (trimmed.length > maxLen) {
    throw new Error('图片地址长度超出单字段限制，请重新上传或填写外链图片地址。');
  }
  return trimmed;
}

export function sanitizeYoutubeUrl(val: string | undefined): string {
  let trimmed = String(val ?? '').trim();
  if (!trimmed) return '';
  if (/^http:\/\//i.test(trimmed)) {
    trimmed = trimmed.replace(/^http:\/\//i, 'https://');
  } else if (/^([a-zA-Z0-9-]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  if (trimmed.length > FIELD_LIMITS.worshipSong.youtubeUrl || !YOUTUBE_HTTPS_URL_REGEX.test(trimmed)) {
    throw new Error(
      '请输入有效的 YouTube 视频链接（例如 https://www.youtube.com/watch?v=... 或 https://youtu.be/...），或留空。'
    );
  }
  return trimmed;
}

export function normalizeChurchInfo(raw: Partial<ChurchInfo> | undefined): ChurchInfo {
  const base = raw ? { ...CHURCH_INFO, ...raw } : { ...CHURCH_INFO };
  return {
    ...base,
    heroImage: filterSafeImageSrc(base.heroImage, CHURCH_INFO.heroImage),
    fellowshipImage: filterSafeImageSrc(base.fellowshipImage, CHURCH_INFO.fellowshipImage),
    siteTheme: normalizeSiteTheme(base.siteTheme),
  };
}

export function normalizePastors(list: Partial<PastorProfile>[]): PastorProfile[] {
  const L = FIELD_LIMITS.pastor;
  return list.map((p, idx) => ({
    id: String(p.id || `pastor-${idx + 1}`),
    name: clampStr(p.name, L.name),
    role: clampStr(p.role, L.role),
    tenure: clampStr(p.tenure, L.tenure),
    image: filterSafeImageSrc(p.image, PASTORS_TEAM[0]?.image || ''),
    education: clampStr(p.education, L.education),
    ministryFocus: clampStr(p.ministryFocus, L.ministryFocus),
    bio: clampStr(p.bio, L.bio),
    sortOrder: clampSortOrder(p.sortOrder, idx + 1),
  }));
}

export function normalizeWorshipSongs(list: Partial<WorshipSong>[]): WorshipSong[] {
  const L = FIELD_LIMITS.worshipSong;
  return list.map((song, idx) => ({
    id: String(song.id || `song-${idx + 1}`),
    title: clampStr(song.title, L.title),
    youtubeUrl: filterSafeYoutubeUrl(song.youtubeUrl),
    youtubeUrl2: filterSafeYoutubeUrl(song.youtubeUrl2),
    sortOrder: clampSortOrder(song.sortOrder, idx + 1),
  }));
}

export function normalizeCoworkers(list: Partial<PulpitCoworker>[]): PulpitCoworker[] {
  const L = FIELD_LIMITS.coworker;
  return list.map((cw, idx) => {
    const safeImg = filterSafeImageSrc(cw.image);
    return {
      id: String(cw.id || `cw-${idx + 1}`),
      name: clampStr(cw.name, L.name),
      title: clampStr(cw.title, L.title),
      ...(safeImg ? { image: safeImg } : {}),
      sortOrder: clampSortOrder(cw.sortOrder, idx + 1),
    };
  });
}

export function normalizeMinistryRoster(list: Partial<MinistryRosterItem>[]): MinistryRosterItem[] {
  const L = FIELD_LIMITS.ministryRoster;
  return list.map((item, idx) => ({
    id: String(item.id || `roster-${idx + 1}`),
    category: normalizeMinistryCategory(item.category),
    role: clampStr(item.role, L.role),
    thisWeek: clampStr(item.thisWeek, L.thisWeek),
    nextWeek: clampStr(item.nextWeek, L.nextWeek),
    sortOrder: clampSortOrder(item.sortOrder, idx + 1),
  }));
}

export function cleanWeekdayMinistry(
  item: Partial<WeekdayMinistry>,
  fallbackSort = 0
): WeekdayMinistry {
  const L = FIELD_LIMITS.weekdayMinistry;
  const location = clampStr(item.location, L.location);
  const leader = clampStr(item.leader, L.leader);
  const description = clampStr(item.description, L.description);

  return {
    id: String(item.id || makeDocId('wm')),
    day: clampStr(item.day, L.day),
    time: clampStr(item.time, L.time),
    title: clampStr(item.title, L.title),
    ...(location ? { location } : {}),
    ...(leader ? { leader } : {}),
    ...(description ? { description } : {}),
    sortOrder: clampSortOrder(item.sortOrder, fallbackSort),
  };
}

export function toWeekdayFirestoreBody(item: WeekdayMinistry): Record<string, unknown> {
  const { id: _ignored, location, leader, description, ...required } = item;
  return {
    ...required,
    ...(location ? { location } : {}),
    ...(leader ? { leader } : {}),
    ...(description ? { description } : {}),
    updatedAt: serverTimestamp(),
  };
}

export function buildChurchInfoFields(info: ChurchInfo): ChurchInfo {
  const L = FIELD_LIMITS.churchInfo;
  return {
    name: clampStr(info.name, L.name),
    founded: clampStr(info.founded, L.founded),
    scriptureQuote: clampStr(info.scriptureQuote, L.scriptureQuote),
    scriptureRef: clampStr(info.scriptureRef, L.scriptureRef),
    heroSubtitle: clampStr(info.heroSubtitle, L.heroSubtitle),
    heroImage: sanitizeImageRef(info.heroImage, L.heroImage) || CHURCH_INFO.heroImage,
    fellowshipImage:
      sanitizeImageRef(info.fellowshipImage, L.fellowshipImage) || CHURCH_INFO.fellowshipImage,
    address: clampStr(info.address, L.address),
    shortAddress: clampStr(info.shortAddress, L.shortAddress),
    pastoralPhone: clampStr(info.pastoralPhone, L.pastoralPhone),
    themeVerse: clampStr(info.themeVerse, L.themeVerse),
    themeVerseRef: clampStr(info.themeVerseRef, L.themeVerseRef),
    thisWeekLabel: clampStr(info.thisWeekLabel, L.thisWeekLabel),
    nextWeekLabel: clampStr(info.nextWeekLabel, L.nextWeekLabel),
    siteTheme: normalizeSiteTheme(info.siteTheme),
    introParagraphs: info.introParagraphs
      .slice(0, L.introParagraphMaxCount)
      .map((s) => clampStr(s, L.introParagraphLen))
      .filter(Boolean),
    coreValues: info.coreValues.slice(0, L.coreValuesMaxCount).map((cv, idx) => ({
      index: clampStr(cv.index || String(idx + 1).padStart(2, '0'), L.coreValueIndex),
      title: clampStr(cv.title, L.coreValueTitle),
      description: clampStr(cv.description, L.coreValueDescription),
    })),
  };
}

const ANNOUNCEMENT_CATEGORIES: ReadonlySet<AnnouncementItem['category']> = new Set([
  '特别聚会',
  '洗礼与课程',
  '社区关怀',
  '诗班与事奉',
]);

const DEFAULT_ANNOUNCEMENT_IMAGE_MAP: Record<string, string> = Object.fromEntries(
  ANNOUNCEMENTS.filter((item) => item.image).map((item) => [item.id, item.image as string])
);

export function normalizeAnnouncements(list: Partial<AnnouncementItem>[]): AnnouncementItem[] {
  const L = FIELD_LIMITS.announcement;
  return list.map((item, idx) => {
    const id = String(item.id || `ann-${idx + 1}`);
    const category = ANNOUNCEMENT_CATEGORIES.has(item.category as AnnouncementItem['category'])
      ? (item.category as AnnouncementItem['category'])
      : '特别聚会';
    const rawImage =
      typeof item.image === 'string'
        ? filterSafeImageSrc(item.image)
        : DEFAULT_ANNOUNCEMENT_IMAGE_MAP[id] || '';
    const details = Array.isArray(item.details)
      ? item.details
          .slice(0, L.detailsMaxCount)
          .map((d) => clampStr(typeof d === 'string' ? d : '', L.detailLen))
          .filter(Boolean)
      : [];

    return {
      id,
      category,
      date: clampStr(item.date, L.date),
      title: clampStr(item.title, L.title),
      summary: clampStr(item.summary, L.summary),
      time: clampStr(item.time, L.time),
      location: clampStr(item.location, L.location),
      contact: clampStr(item.contact, L.contact),
      ...(typeof item.image === 'string' || rawImage ? { image: rawImage } : {}),
      isFeatured: Boolean(item.isFeatured),
      details,
      sortOrder: clampSortOrder(item.sortOrder, idx + 1),
    };
  });
}

export { normalizeWeekdayMinistries };
