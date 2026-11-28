import { FIELD_LIMITS } from '../data/cacheConfig';
import {
  EMPTY_CHURCH_INFO,
  normalizeMinistryCategory,
  type AnnouncementItem,
  type ChurchInfo,
  type MinistryRosterItem,
  type PulpitCoworker,
  type WeekdayMinistry,
} from '../data/churchData';
import { normalizeSiteTheme } from '../data/themes';
import { DATA_IMAGE_URI_REGEX } from '../lib/mediaStorage';
import {
  filterSafeImageSrc,
  SAFE_HTTP_OR_ROOT_RELATIVE_REGEX,
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
  const isSafeDataUri = DATA_IMAGE_URI_REGEX.test(trimmed);
  if (!isSafeUrlOrPath && !isSafeDataUri) {
    throw new Error('图片地址格式无效：请上传 JPG/PNG/WebP 原图，或填写以 https:// 或 / 开头的有效路径。');
  }
  if (trimmed.length > maxLen) {
    throw new Error('图片地址长度超出单字段限制，请重新上传或填写外链图片地址。');
  }
  return trimmed;
}

export function normalizeChurchInfo(raw: Partial<ChurchInfo> | undefined): ChurchInfo {
  const L = FIELD_LIMITS.churchInfo;
  const base = raw ? { ...EMPTY_CHURCH_INFO, ...raw } : { ...EMPTY_CHURCH_INFO };
  let themeVerseRef = clampStr(base.themeVerseRef, L.themeVerseRef);
  if (themeVerseRef.includes('伯特利教会年度主题经文')) {
    themeVerseRef = themeVerseRef.replace(/·?\s*伯特利教会年度主题经文/g, '').trim();
  }
  const introParagraphs = Array.isArray(base.introParagraphs)
    ? base.introParagraphs
        .slice(0, L.introParagraphMaxCount)
        .map((s) => clampStr(typeof s === 'string' ? s : '', L.introParagraphLen))
        .filter(Boolean)
    : [];
  const coreValues = Array.isArray(base.coreValues)
    ? base.coreValues.slice(0, L.coreValuesMaxCount).map((cv, idx) => ({
        index: clampStr(cv?.index || String(idx + 1).padStart(2, '0'), L.coreValueIndex),
        title: clampStr(cv?.title, L.coreValueTitle),
        description: clampStr(cv?.description, L.coreValueDescription),
      }))
    : [];
  return {
    name: clampStr(base.name, L.name),
    founded: clampStr(base.founded, L.founded),
    scriptureQuote: clampStr(base.scriptureQuote, L.scriptureQuote),
    scriptureRef: clampStr(base.scriptureRef, L.scriptureRef),
    heroSubtitle: clampStr(base.heroSubtitle, L.heroSubtitle),
    heroImage: filterSafeImageSrc(base.heroImage, ''),
    fellowshipImage: filterSafeImageSrc(base.fellowshipImage, ''),
    churchTeamImage: filterSafeImageSrc(base.churchTeamImage, ''),
    address: clampStr(base.address, L.address),
    shortAddress: clampStr(base.shortAddress, L.shortAddress),
    pastoralPhone: clampStr(base.pastoralPhone, L.pastoralPhone),
    themeVerse: clampStr(base.themeVerse, L.themeVerse),
    themeVerseRef,
    thisWeekLabel: clampStr(base.thisWeekLabel, L.thisWeekLabel),
    nextWeekLabel: clampStr(base.nextWeekLabel, L.nextWeekLabel),
    siteTheme: normalizeSiteTheme(base.siteTheme),
    introParagraphs,
    coreValues,
  };
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
  return list.map((item, idx) => {
    const safeImg = filterSafeImageSrc(item.image, '');
    return {
      id: String(item.id || `moment-${idx + 1}`),
      category: normalizeMinistryCategory(item.category),
      title: clampStr(item.title, L.title),
      image: safeImg,
      schedule: clampStr(item.schedule, L.schedule),
      description: clampStr(item.description, L.description),
      sortOrder: clampSortOrder(item.sortOrder, idx + 1),
    };
  });
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

export function normalizeWeekdayMinistries(list: Partial<WeekdayMinistry>[]): WeekdayMinistry[] {
  return [...list]
    .map((item, idx) => cleanWeekdayMinistry(item, idx + 1))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function buildChurchInfoFields(info: ChurchInfo): ChurchInfo {
  const L = FIELD_LIMITS.churchInfo;
  let themeVerseRef = clampStr(info.themeVerseRef, L.themeVerseRef);
  if (themeVerseRef.includes('伯特利教会年度主题经文')) {
    themeVerseRef = themeVerseRef.replace(/·?\s*伯特利教会年度主题经文/g, '').trim();
  }
  return {
    name: clampStr(info.name, L.name),
    founded: clampStr(info.founded, L.founded),
    scriptureQuote: clampStr(info.scriptureQuote, L.scriptureQuote),
    scriptureRef: clampStr(info.scriptureRef, L.scriptureRef),
    heroSubtitle: clampStr(info.heroSubtitle, L.heroSubtitle),
    heroImage: sanitizeImageRef(info.heroImage, L.heroImage),
    fellowshipImage: sanitizeImageRef(info.fellowshipImage, L.fellowshipImage),
    churchTeamImage: sanitizeImageRef(info.churchTeamImage, L.churchTeamImage),
    address: clampStr(info.address, L.address),
    shortAddress: clampStr(info.shortAddress, L.shortAddress),
    pastoralPhone: clampStr(info.pastoralPhone, L.pastoralPhone),
    themeVerse: clampStr(info.themeVerse, L.themeVerse),
    themeVerseRef,
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

export function normalizeAnnouncementCategory(raw: unknown): AnnouncementItem['category'] {
  if (raw === '家事注意' || raw === '社区关怀') {
    return '家事注意';
  }
  return '特别聚会';
}

export function normalizeAnnouncements(list: Partial<AnnouncementItem>[]): AnnouncementItem[] {
  const L = FIELD_LIMITS.announcement;
  return list.map((item, idx) => {
    const id = String(item.id || `ann-${idx + 1}`);
    const category = normalizeAnnouncementCategory(item.category);
    const rawImage = typeof item.image === 'string' ? filterSafeImageSrc(item.image, '') : '';
    const details = Array.isArray(item.details)
      ? item.details
          .slice(0, L.detailsMaxCount)
          .map((d) => clampStr(typeof d === 'string' ? d : '', L.detailLen))
          .filter(Boolean)
      : [];

    const cleanDate = clampStr(item.date, L.date);
    const cleanTime = clampStr(item.time, L.time);
    const cleanLocation = clampStr(item.location, L.location);
    const cleanContact = clampStr(item.contact, L.contact);

    return {
      id,
      category,
      ...(cleanDate ? { date: cleanDate } : {}),
      title: clampStr(item.title, L.title),
      summary: clampStr(item.summary, L.summary),
      ...(cleanTime ? { time: cleanTime } : {}),
      ...(cleanLocation ? { location: cleanLocation } : {}),
      ...(cleanContact ? { contact: cleanContact } : {}),
      ...(rawImage ? { image: rawImage } : {}),
      isFeatured: Boolean(item.isFeatured),
      details,
      sortOrder: clampSortOrder(item.sortOrder, idx + 1),
    };
  });
}
