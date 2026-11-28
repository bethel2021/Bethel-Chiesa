import {
  ANNOUNCEMENTS,
  CHURCH_INFO,
  LITURGY_COMMUNION,
  LITURGY_STANDARD,
  PULPIT_COWORKERS,
  SUNDAY_MINISTRY_ROSTER,
  SUNDAY_WORSHIP_TIMES,
  WEEKDAY_MINISTRIES,
  type AdminUserItem,
  type AnnouncementItem,
  type ChurchInfo,
  type LiturgyStep,
  type MinistryRosterItem,
  type PulpitCoworker,
  type VisitorIpRecord,
  type VisitorRequestItem,
  type VisitorStatsSummary,
  type WeekdayMinistry,
  type WorshipTimeSlot,
} from '../data/churchData';
import {
  buildChurchInfoFields,
  cleanWeekdayMinistry,
  mergeLegacyPastorsIntoCoworkers,
  normalizeAnnouncements,
  normalizeChurchInfo,
  normalizeMinistryRoster,
  normalizeWeekdayMinistries,
  type LegacyPastorLike,
} from '../utils/churchNormalization';
import { DATA_IMAGE_URI_REGEX } from '../utils/urlSafety';
import {
  readCachedAdminUsers,
  readCachedVisitorCounter,
  readCachedVisitorRequests,
  readCachedVisitorStatsBundle,
} from './adminSessionCache';
import { firebaseApp, firebasePublicConfig, getCurrentAuthUid } from './firebase';
import {
  blobToDataUrl,
  dataUrlToBlobFast,
  isD1MediaUrl,
  isMediaUri,
  resolveLegacyMediaToBlob,
  uploadBlobToD1Media,
} from './mediaStorage';
import { readLocalBundleCache } from './publicBundleCache';

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

function decodeFirestoreValue(v: FirestoreValue | undefined): unknown {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) {
    return (v.arrayValue.values ?? []).map(decodeFirestoreValue);
  }
  if ('mapValue' in v) {
    return decodeFirestoreFields(v.mapValue.fields ?? {});
  }
  return null;
}

function decodeFirestoreFields(
  fields: Record<string, FirestoreValue> | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeFirestoreValue(v);
  }
  return out;
}

function extractDocId(docName: string | undefined): string {
  if (!docName) return '';
  const parts = docName.split('/');
  return parts[parts.length - 1] || '';
}

function getErrorCodeAndMsg(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return `${code} ${msg}`.toLowerCase();
}

function isQuotaExceededError(err: unknown): boolean {
  const combined = getErrorCodeAndMsg(err);
  return (
    combined.includes('429') ||
    combined.includes('resource_exhausted') ||
    combined.includes('resource-exhausted') ||
    combined.includes('quota')
  );
}

function isPermissionDeniedError(err: unknown): boolean {
  const combined = getErrorCodeAndMsg(err);
  return (
    combined.includes('http 403') ||
    combined.includes('http 401') ||
    combined.includes('permission_denied') ||
    combined.includes('permission-denied') ||
    combined.includes('insufficient permissions') ||
    combined.includes('unauthenticated')
  );
}

function normalizeSdkValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (
    typeof val === 'object' &&
    'toDate' in val &&
    typeof (val as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      return (val as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (Array.isArray(val)) {
    return val.map(normalizeSdkValue);
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = normalizeSdkValue(v);
    }
    return out;
  }
  return val;
}

async function getLegacyFirestoreInstance() {
  const { getFirestore } = await import('firebase/firestore');
  return firebasePublicConfig.firestoreDatabaseId
    ? getFirestore(firebaseApp, firebasePublicConfig.firestoreDatabaseId)
    : getFirestore(firebaseApp);
}

function firestoreRestBase(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebasePublicConfig.projectId
  )}/databases/${encodeURIComponent(firebasePublicConfig.firestoreDatabaseId)}/documents`;
}

function buildFirestoreRestUrl(pathOrCollection: string, query?: string): string {
  const params: string[] = [];
  if (query) params.push(query);
  if (firebasePublicConfig.apiKey) {
    params.push(`key=${encodeURIComponent(firebasePublicConfig.apiKey)}`);
  }
  const suffix = params.length > 0 ? `?${params.join('&')}` : '';
  return `${firestoreRestBase()}/${pathOrCollection}${suffix}`;
}

async function fetchFirestoreDoc(
  path: string,
  token: string | null,
  allowPublicRetry = false
): Promise<Record<string, unknown> | null> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(buildFirestoreRestUrl(path), { headers });
  if (res.status === 404) return null;
  if ((res.status === 401 || res.status === 403) && allowPublicRetry && token) {
    return await fetchFirestoreDoc(path, null, false);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`读取旧版 Firestore (${path}) 失败：HTTP ${res.status} ${text.slice(0, 120)}`);
  }
  const docJson = (await res.json()) as FirestoreDocument;
  return decodeFirestoreFields(docJson.fields);
}

async function fetchFirestoreCollection(
  colName: string,
  token: string | null,
  pageSize = 300,
  allowPublicRetry = false
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const out: Array<Record<string, unknown> & { id: string }> = [];
  let pageToken = '';

  for (let page = 0; page < 8; page += 1) {
    const query = `pageSize=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const url = buildFirestoreRestUrl(encodeURIComponent(colName), query);
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(url, { headers });
    if (res.status === 404) break;
    if ((res.status === 401 || res.status === 403) && allowPublicRetry && token && page === 0) {
      return await fetchFirestoreCollection(colName, null, pageSize, false);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `读取旧版 Firestore 集合 ${colName} 失败：HTTP ${res.status} ${text.slice(0, 120)}`
      );
    }
    const json = (await res.json()) as {
      documents?: FirestoreDocument[];
      nextPageToken?: string;
    };
    for (const d of json.documents ?? []) {
      out.push({
        ...decodeFirestoreFields(d.fields),
        id: extractDocId(d.name),
      });
    }
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }

  return out;
}

async function fetchDocPreferSdk(
  path: string,
  token: string | null,
  allowPublicRetry = false
): Promise<Record<string, unknown> | null> {
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2 && segments.length % 2 === 0) {
    try {
      const [{ doc, getDocFromServer }, db] = await Promise.all([
        import('firebase/firestore'),
        getLegacyFirestoreInstance(),
      ]);
      const snap = await getDocFromServer(doc(db, segments[0], ...segments.slice(1)));
      if (!snap.exists()) return null;
      return normalizeSdkValue(snap.data()) as Record<string, unknown>;
    } catch (sdkErr) {
      if (isQuotaExceededError(sdkErr)) throw sdkErr;
    }
  }
  return await fetchFirestoreDoc(path, token, allowPublicRetry);
}

async function fetchCollectionPreferSdk(
  colName: string,
  token: string | null,
  pageSize = 300,
  allowPublicRetry = false
): Promise<Array<Record<string, unknown> & { id: string }>> {
  try {
    const [{ collection, getDocsFromServer }, db] = await Promise.all([
      import('firebase/firestore'),
      getLegacyFirestoreInstance(),
    ]);
    const snap = await getDocsFromServer(collection(db, colName));
    return snap.docs.map((d) => ({
      ...(normalizeSdkValue(d.data()) as Record<string, unknown>),
      id: d.id,
    }));
  } catch (sdkErr) {
    if (isQuotaExceededError(sdkErr)) throw sdkErr;
  }
  return await fetchFirestoreCollection(colName, token, pageSize, allowPublicRetry);
}

async function migrateImageToD1(
  rawUrl: string | undefined,
  getToken: (forceRefresh?: boolean) => Promise<string | null>,
  uploadedCache: Map<string, string>,
  warnings: string[]
): Promise<string> {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return '';
  if (uploadedCache.has(trimmed)) {
    return uploadedCache.get(trimmed)!;
  }

  let migrated = trimmed;
  try {
    if (isMediaUri(trimmed)) {
      const blob = await resolveLegacyMediaToBlob(trimmed);
      migrated = await uploadBlobToD1Media(blob, getToken);
    } else if (DATA_IMAGE_URI_REGEX.test(trimmed)) {
      const blob = await dataUrlToBlobFast(trimmed);
      migrated = await uploadBlobToD1Media(blob, getToken);
    }
  } catch (err) {
    if (isQuotaExceededError(err) || isPermissionDeniedError(err)) {
      warnings.push('部分旧版图片因 Firestore 额度或权限限制暂未能拉取，已保留原链接。');
      migrated = trimmed;
    } else {
      throw err;
    }
  }

  uploadedCache.set(trimmed, migrated);
  return migrated;
}

async function inlineImageForBackup(
  rawUrl: string | undefined,
  cache: Map<string, string>
): Promise<string> {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return '';
  if (cache.has(trimmed)) return cache.get(trimmed)!;

  let result = trimmed;
  try {
    if (isMediaUri(trimmed)) {
      const blob = await resolveLegacyMediaToBlob(trimmed);
      result = await blobToDataUrl(blob);
    } else if (isD1MediaUrl(trimmed)) {
      const res = await fetch(trimmed);
      if (res.ok) {
        result = await blobToDataUrl(await res.blob());
      }
    }
  } catch {
    // Keep original reference if inline export fails
  }

  cache.set(trimmed, result);
  return result;
}

export interface LegacyImportSummary {
  migratedImages: number;
  importedAdmins: number;
  importedRequests: number;
  importedIps: number;
  usedLocalCacheFallback?: boolean;
  warnings: string[];
}

export interface BethelBackupPayload {
  format: 'bethel-church-backup-v1';
  exportedAt: string;
  content: {
    churchInfo: ChurchInfo;
    coworkers: PulpitCoworker[];
    worshipTimes: WorshipTimeSlot[];
    liturgySteps: LiturgyStep[];
    ministryRoster: MinistryRosterItem[];
    weekdayMinistries: WeekdayMinistry[];
    announcements: AnnouncementItem[];
  };
  admins?: AdminUserItem[];
  visitorRequests?: VisitorRequestItem[];
  visitorCounter?: VisitorStatsSummary | null;
  visitorIps?: VisitorIpRecord[];
}

export async function buildChurchBackupJson(params: {
  content: BethelBackupPayload['content'];
  admins: AdminUserItem[];
  visitorRequests: VisitorRequestItem[];
  visitorStats: VisitorStatsSummary | null;
  visitorIpRecords: VisitorIpRecord[];
}): Promise<string> {
  const inlineCache = new Map<string, string>();
  const { content } = params;

  const exportedChurchInfo = buildChurchInfoFields({
    ...content.churchInfo,
    heroImage: await inlineImageForBackup(content.churchInfo.heroImage, inlineCache),
    fellowshipImage: await inlineImageForBackup(content.churchInfo.fellowshipImage, inlineCache),
    churchTeamImage: await inlineImageForBackup(content.churchInfo.churchTeamImage, inlineCache),
  });

  const exportedCoworkers = await Promise.all(
    content.coworkers.map(async (cw) => ({
      ...cw,
      ...(cw.image ? { image: await inlineImageForBackup(cw.image, inlineCache) } : {}),
    }))
  );

  const exportedRoster = await Promise.all(
    content.ministryRoster.map(async (mr) => ({
      ...mr,
      image: await inlineImageForBackup(mr.image, inlineCache),
    }))
  );

  const exportedAnnouncements = await Promise.all(
    content.announcements.map(async (ann) => ({
      ...ann,
      ...(ann.image ? { image: await inlineImageForBackup(ann.image, inlineCache) } : {}),
    }))
  );

  const uid = getCurrentAuthUid();
  const payload: BethelBackupPayload = {
    format: 'bethel-church-backup-v1',
    exportedAt: new Date().toISOString(),
    content: {
      churchInfo: exportedChurchInfo,
      coworkers: exportedCoworkers,
      worshipTimes: content.worshipTimes,
      liturgySteps: content.liturgySteps,
      ministryRoster: exportedRoster,
      weekdayMinistries: content.weekdayMinistries,
      announcements: exportedAnnouncements,
    },
    admins: params.admins.length ? params.admins : readCachedAdminUsers(uid) ?? [],
    visitorRequests: params.visitorRequests.length
      ? params.visitorRequests
      : readCachedVisitorRequests(uid) ?? [],
    visitorCounter: params.visitorStats ?? readCachedVisitorCounter(uid) ?? null,
    visitorIps: params.visitorIpRecords.length
      ? params.visitorIpRecords
      : readCachedVisitorStatsBundle(uid)?.ipRecords ?? [],
  };

  return JSON.stringify(payload, null, 2);
}

async function uploadContentImagesAndSendToD1(params: {
  hasContent: boolean;
  churchInfo: ChurchInfo;
  coworkers: PulpitCoworker[];
  worshipTimes: WorshipTimeSlot[];
  liturgySteps: LiturgyStep[];
  ministryRoster: MinistryRosterItem[];
  weekdayMinistries: WeekdayMinistry[];
  announcements: AnnouncementItem[];
  admins: unknown[];
  visitorRequests: unknown[];
  visitorCounter: unknown;
  visitorIps: unknown[];
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  onProgress?: (step: string) => void;
  usedLocalCacheFallback?: boolean;
  warnings: string[];
}): Promise<LegacyImportSummary> {
  const token = await params.getToken();
  if (!token) {
    throw new Error('请先使用主管理员账号登录后再导入数据。');
  }

  let { churchInfo, coworkers, ministryRoster, announcements } = params;
  const uploadedCache = new Map<string, string>();

  if (params.hasContent) {
    params.onProgress?.('正在将图片转存至 Cloudflare D1 数据库…');
    churchInfo = buildChurchInfoFields({
      ...churchInfo,
      heroImage: await migrateImageToD1(churchInfo.heroImage, params.getToken, uploadedCache, params.warnings),
      fellowshipImage: await migrateImageToD1(
        churchInfo.fellowshipImage,
        params.getToken,
        uploadedCache,
        params.warnings
      ),
      churchTeamImage: await migrateImageToD1(
        churchInfo.churchTeamImage,
        params.getToken,
        uploadedCache,
        params.warnings
      ),
    });

    coworkers = await Promise.all(
      coworkers.map(async (cw) => ({
        ...cw,
        ...(cw.image
          ? { image: await migrateImageToD1(cw.image, params.getToken, uploadedCache, params.warnings) }
          : {}),
      }))
    );

    ministryRoster = await Promise.all(
      ministryRoster.map(async (mr) => ({
        ...mr,
        image: await migrateImageToD1(mr.image, params.getToken, uploadedCache, params.warnings),
      }))
    );

    announcements = await Promise.all(
      announcements.map(async (ann) => ({
        ...ann,
        ...(ann.image
          ? { image: await migrateImageToD1(ann.image, params.getToken, uploadedCache, params.warnings) }
          : {}),
      }))
    );
  }

  params.onProgress?.('正在写入 Cloudflare D1 数据库…');
  const res = await fetch('/api/admin/import-legacy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...(params.hasContent
        ? {
            content: {
              churchInfo,
              coworkers,
              worshipTimes: params.worshipTimes,
              liturgySteps: params.liturgySteps,
              ministryRoster,
              weekdayMinistries: params.weekdayMinistries,
              announcements,
            },
          }
        : {}),
      admins: params.admins,
      visitorRequests: params.visitorRequests,
      visitorCounter: params.visitorCounter,
      visitorIps: params.visitorIps,
    }),
  });

  const result = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    importedAdmins?: number;
    importedRequests?: number;
    importedIps?: number;
  };

  if (!res.ok || !result.ok) {
    throw new Error(result.error || `写入 D1 失败（HTTP ${res.status}）`);
  }

  return {
    migratedImages: Array.from(uploadedCache.entries()).filter(([k, v]) => k !== v).length,
    importedAdmins: result.importedAdmins ?? params.admins.length,
    importedRequests: result.importedRequests ?? params.visitorRequests.length,
    importedIps: result.importedIps ?? params.visitorIps.length,
    usedLocalCacheFallback: params.usedLocalCacheFallback,
    warnings: params.warnings,
  };
}

export async function importBackupJsonToD1(
  rawJsonText: string,
  getToken: (forceRefresh?: boolean) => Promise<string | null>,
  onProgress?: (step: string) => void
): Promise<LegacyImportSummary> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJsonText) as Record<string, unknown>;
  } catch {
    throw new Error('备份文件不是有效的 JSON 格式。');
  }

  const rawContent = (parsed.content && typeof parsed.content === 'object'
    ? parsed.content
    : parsed) as Record<string, unknown>;

  if (!rawContent || !rawContent.churchInfo || typeof rawContent.churchInfo !== 'object') {
    throw new Error('备份文件缺少 churchInfo 教会基础内容，无法导入。');
  }

  const churchInfo = normalizeChurchInfo(rawContent.churchInfo as Partial<ChurchInfo>);
  const coworkers = Array.isArray(rawContent.coworkers)
    ? mergeLegacyPastorsIntoCoworkers(rawContent.coworkers as Partial<PulpitCoworker>[])
    : PULPIT_COWORKERS;
  const worshipTimes = Array.isArray(rawContent.worshipTimes)
    ? (rawContent.worshipTimes as WorshipTimeSlot[])
    : SUNDAY_WORSHIP_TIMES;
  const liturgySteps = Array.isArray(rawContent.liturgySteps)
    ? (rawContent.liturgySteps as LiturgyStep[])
    : [...LITURGY_STANDARD, ...LITURGY_COMMUNION];
  const ministryRoster = Array.isArray(rawContent.ministryRoster)
    ? normalizeMinistryRoster(rawContent.ministryRoster as Partial<MinistryRosterItem>[])
    : SUNDAY_MINISTRY_ROSTER;
  const weekdayMinistries = Array.isArray(rawContent.weekdayMinistries)
    ? normalizeWeekdayMinistries(
        (rawContent.weekdayMinistries as Partial<WeekdayMinistry>[]).map((item, idx) =>
          cleanWeekdayMinistry(item, idx + 1)
        )
      )
    : WEEKDAY_MINISTRIES;
  const announcements = Array.isArray(rawContent.announcements)
    ? normalizeAnnouncements(rawContent.announcements as Partial<AnnouncementItem>[])
    : ANNOUNCEMENTS;

  return await uploadContentImagesAndSendToD1({
    hasContent: true,
    churchInfo,
    coworkers,
    worshipTimes,
    liturgySteps,
    ministryRoster,
    weekdayMinistries,
    announcements,
    admins: Array.isArray(parsed.admins) ? parsed.admins : [],
    visitorRequests: Array.isArray(parsed.visitorRequests) ? parsed.visitorRequests : [],
    visitorCounter:
      parsed.visitorCounter && typeof parsed.visitorCounter === 'object'
        ? parsed.visitorCounter
        : null,
    visitorIps: Array.isArray(parsed.visitorIps) ? parsed.visitorIps : [],
    getToken,
    onProgress,
    warnings: [],
  });
}

export async function runLegacyFirestoreMigration(
  getToken: (forceRefresh?: boolean) => Promise<string | null>,
  onProgress?: (step: string) => void
): Promise<LegacyImportSummary> {
  const token = await getToken(true);
  if (!token) {
    throw new Error('请先使用主管理员账号登录后再导入旧数据。');
  }

  const uid = getCurrentAuthUid();
  const warnings: string[] = [];
  let usedLocalCacheFallback = false;

  let churchInfo: ChurchInfo = CHURCH_INFO;
  let coworkers: PulpitCoworker[] = PULPIT_COWORKERS;
  let worshipTimes: WorshipTimeSlot[] = SUNDAY_WORSHIP_TIMES;
  let liturgySteps: LiturgyStep[] = [...LITURGY_STANDARD, ...LITURGY_COMMUNION];
  let ministryRoster: MinistryRosterItem[] = SUNDAY_MINISTRY_ROSTER;
  let weekdayMinistries: WeekdayMinistry[] = WEEKDAY_MINISTRIES;
  let announcements: AnnouncementItem[] = ANNOUNCEMENTS;
  let hasContent = false;

  onProgress?.('正在读取旧版 Firestore 公开内容…');
  let publicBundle: Record<string, unknown> | null = null;
  let hitContentQuota = false;
  let hitContentPermission = false;

  try {
    publicBundle = await fetchDocPreferSdk('church_sections/public_bundle', token, true);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      hitContentQuota = true;
    } else if (isPermissionDeniedError(err)) {
      hitContentPermission = true;
    } else {
      throw err;
    }
  }

  if (publicBundle && publicBundle.churchInfo) {
    hasContent = true;
    churchInfo = normalizeChurchInfo(publicBundle.churchInfo as Partial<ChurchInfo>);
    const legacyPastors = publicBundle.pastors as LegacyPastorLike[] | undefined;
    if (Array.isArray(publicBundle.coworkers) || Array.isArray(legacyPastors)) {
      coworkers = mergeLegacyPastorsIntoCoworkers(
        (publicBundle.coworkers as Partial<PulpitCoworker>[]) ?? [],
        legacyPastors
      );
    }
    if (Array.isArray(publicBundle.worshipTimes) && publicBundle.worshipTimes.length) {
      worshipTimes = publicBundle.worshipTimes as WorshipTimeSlot[];
    }
    if (Array.isArray(publicBundle.liturgySteps) && publicBundle.liturgySteps.length) {
      liturgySteps = publicBundle.liturgySteps as LiturgyStep[];
    }
    if (Array.isArray(publicBundle.ministryRoster) && publicBundle.ministryRoster.length) {
      ministryRoster = normalizeMinistryRoster(
        publicBundle.ministryRoster as Partial<MinistryRosterItem>[]
      );
    }
    if (Array.isArray(publicBundle.weekdayMinistries) && publicBundle.weekdayMinistries.length) {
      weekdayMinistries = normalizeWeekdayMinistries(
        (publicBundle.weekdayMinistries as Partial<WeekdayMinistry>[]).map((item, idx) =>
          cleanWeekdayMinistry(item, idx + 1)
        )
      );
    }
    if (Array.isArray(publicBundle.announcements) && publicBundle.announcements.length) {
      announcements = normalizeAnnouncements(
        publicBundle.announcements as Partial<AnnouncementItem>[]
      );
    }
  } else if (!hitContentQuota && !hitContentPermission) {
    try {
      const infoDoc = await fetchDocPreferSdk('church_sections/info', token, true);
      if (infoDoc) {
        hasContent = true;
        churchInfo = normalizeChurchInfo(infoDoc as Partial<ChurchInfo>);
        const [cw, lp, wt, ls, mr, wm, ann] = await Promise.all([
          fetchCollectionPreferSdk('coworkers', token, 300, true),
          fetchCollectionPreferSdk('pastors', token, 300, true),
          fetchCollectionPreferSdk('worship_times', token, 300, true),
          fetchCollectionPreferSdk('liturgy_steps', token, 300, true),
          fetchCollectionPreferSdk('ministry_roster', token, 300, true),
          fetchCollectionPreferSdk('weekday_ministries', token, 300, true),
          fetchCollectionPreferSdk('announcements', token, 300, true),
        ]);
        if (cw.length || lp.length) {
          coworkers = mergeLegacyPastorsIntoCoworkers(
            cw as unknown as Partial<PulpitCoworker>[],
            lp as unknown as LegacyPastorLike[]
          );
        }
        if (wt.length) worshipTimes = wt as unknown as WorshipTimeSlot[];
        if (ls.length) liturgySteps = ls as unknown as LiturgyStep[];
        if (mr.length) ministryRoster = normalizeMinistryRoster(mr as unknown as Partial<MinistryRosterItem>[]);
        if (wm.length) {
          weekdayMinistries = normalizeWeekdayMinistries(
            (wm as unknown as Partial<WeekdayMinistry>[]).map((item, idx) =>
              cleanWeekdayMinistry(item, idx + 1)
            )
          );
        }
        if (ann.length) announcements = normalizeAnnouncements(ann as unknown as Partial<AnnouncementItem>[]);
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        hitContentQuota = true;
      } else if (isPermissionDeniedError(err)) {
        hitContentPermission = true;
      } else {
        throw err;
      }
    }
  }

  if ((hitContentQuota || hitContentPermission) && !hasContent) {
    const cachedBundle = readLocalBundleCache();
    if (cachedBundle?.bundle?.churchInfo) {
      hasContent = true;
      usedLocalCacheFallback = true;
      churchInfo = cachedBundle.bundle.churchInfo;
      coworkers = cachedBundle.bundle.coworkers;
      worshipTimes = cachedBundle.bundle.worshipTimes;
      liturgySteps = cachedBundle.bundle.liturgySteps;
      ministryRoster = cachedBundle.bundle.ministryRoster;
      weekdayMinistries = cachedBundle.bundle.weekdayMinistries;
      announcements = cachedBundle.bundle.announcements;
      warnings.push(
        hitContentPermission
          ? '旧版 Firestore 公开内容读取被拒绝，已自动改用本浏览器本地缓存的旧版页面内容进行导入。'
          : 'Firestore 今日额度已满，已自动改用本浏览器本地缓存的旧版页面内容进行导入。'
      );
    } else if (hitContentQuota) {
      throw new Error(
        '旧版 Firestore 今日免费读取额度已达上限，且当前浏览器无本地缓存。您可以：1) 先点击「同步默认模板到 D1」立即启用新库；2) 打开之前访问过网站的旧浏览器页面导出 JSON 备份后再导入；3) 待明日（约意大利时间 09:00）Firestore 额度重置后再点击导入。'
      );
    } else {
      throw new Error(
        '旧版 Firestore 读取权限不足且当前浏览器无本地缓存，无法自动拉取内容。请使用之前访问过旧站点的浏览器导出 JSON 备份后导入，或确认旧版 Firestore 安全规则允许当前账号读取。'
      );
    }
  }

  onProgress?.('正在读取管理员名单、访客留言与访问统计…');
  const tryOptional = async <T>(fn: () => Promise<T>, label: string): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      if (isQuotaExceededError(err)) {
        warnings.push(`${label}因 Firestore 额度已满未拉取（已尝试使用缓存）`);
        return null;
      }
      if (isPermissionDeniedError(err)) {
        warnings.push(`${label}因 Firestore 权限不足（HTTP 403）未拉取，已跳过`);
        return null;
      }
      throw err;
    }
  };

  const [adminsRaw, requestsRaw, visitorCounterFetched, visitorIpsRaw] = await Promise.all([
    tryOptional(() => fetchCollectionPreferSdk('admins', token), '同工权限名单'),
    tryOptional(() => fetchCollectionPreferSdk('visitor_requests', token), '来访留言'),
    tryOptional(() => fetchDocPreferSdk('site_stats/visitor_counter', token, true), '总访客计数'),
    tryOptional(() => fetchCollectionPreferSdk('visitor_ips', token, 500), '访客归属地明细'),
  ]);

  const admins = adminsRaw
    ? adminsRaw.map((a) => ({
        uid: a.id,
        email: a.email,
        displayName: a.displayName,
        canViewVisitorStats: a.canViewVisitorStats === true,
        addedAt: a.addedAt,
      }))
    : readCachedAdminUsers(uid) ?? [];

  const visitorRequests = requestsRaw
    ? requestsRaw.map((r) => ({
        id: r.id,
        name: r.name,
        contact: r.contact,
        intent: r.intent,
        message: r.message,
        status: r.status,
        adminNote: r.adminNote,
        createdAt: r.createdAt,
      }))
    : readCachedVisitorRequests(uid) ?? [];

  const cachedStats = readCachedVisitorStatsBundle(uid);
  const visitorCounter = visitorCounterFetched ?? readCachedVisitorCounter(uid) ?? cachedStats?.stats ?? null;
  const visitorIps = visitorIpsRaw
    ? visitorIpsRaw.map((ip) => ({
        id: ip.id,
        country: ip.country,
        region: ip.region,
        countedAt: ip.countedAt,
      }))
    : cachedStats?.ipRecords ?? [];

  return await uploadContentImagesAndSendToD1({
    hasContent,
    churchInfo,
    coworkers,
    worshipTimes,
    liturgySteps,
    ministryRoster,
    weekdayMinistries,
    announcements,
    admins,
    visitorRequests,
    visitorCounter,
    visitorIps,
    getToken,
    onProgress,
    usedLocalCacheFallback,
    warnings,
  });
}
