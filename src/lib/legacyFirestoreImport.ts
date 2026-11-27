import {
  ANNOUNCEMENTS,
  CHURCH_INFO,
  LITURGY_COMMUNION,
  LITURGY_STANDARD,
  PULPIT_COWORKERS,
  SUNDAY_MINISTRY_ROSTER,
  SUNDAY_WORSHIP_TIMES,
  WEEKDAY_MINISTRIES,
  type AnnouncementItem,
  type ChurchInfo,
  type LiturgyStep,
  type MinistryRosterItem,
  type PulpitCoworker,
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
import { firebasePublicConfig } from './firebase';
import {
  dataUrlToBlobFast,
  isMediaUri,
  resolveLegacyMediaToBlob,
  uploadBlobToD1Media,
} from './mediaStorage';

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

function firestoreRestBase(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebasePublicConfig.projectId
  )}/databases/${encodeURIComponent(firebasePublicConfig.firestoreDatabaseId)}/documents`;
}

async function fetchFirestoreDoc(
  path: string,
  token: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${firestoreRestBase()}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`读取旧版 Firestore (${path}) 失败：HTTP ${res.status} ${text.slice(0, 120)}`);
  }
  const docJson = (await res.json()) as FirestoreDocument;
  return decodeFirestoreFields(docJson.fields);
}

async function fetchFirestoreCollection(
  colName: string,
  token: string,
  pageSize = 300
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const out: Array<Record<string, unknown> & { id: string }> = [];
  let pageToken = '';

  for (let page = 0; page < 8; page += 1) {
    const url = `${firestoreRestBase()}/${encodeURIComponent(
      colName
    )}?pageSize=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) break;
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

async function migrateImageToD1(
  rawUrl: string | undefined,
  getToken: () => Promise<string | null>,
  uploadedCache: Map<string, string>
): Promise<string> {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return '';
  if (uploadedCache.has(trimmed)) {
    return uploadedCache.get(trimmed)!;
  }

  let migrated = trimmed;
  if (isMediaUri(trimmed)) {
    const blob = await resolveLegacyMediaToBlob(trimmed);
    migrated = await uploadBlobToD1Media(blob, getToken);
  } else if (DATA_IMAGE_URI_REGEX.test(trimmed)) {
    const blob = await dataUrlToBlobFast(trimmed);
    migrated = await uploadBlobToD1Media(blob, getToken);
  }

  uploadedCache.set(trimmed, migrated);
  return migrated;
}

export interface LegacyImportSummary {
  migratedImages: number;
  importedAdmins: number;
  importedRequests: number;
  importedIps: number;
}

export async function runLegacyFirestoreMigration(
  getToken: () => Promise<string | null>,
  onProgress?: (step: string) => void
): Promise<LegacyImportSummary> {
  const token = await getToken();
  if (!token) {
    throw new Error('请先使用主管理员账号登录后再导入旧数据。');
  }

  onProgress?.('正在读取旧版 Firestore 公开内容…');
  const publicBundle = await fetchFirestoreDoc('church_sections/public_bundle', token);

  let churchInfo: ChurchInfo = CHURCH_INFO;
  let coworkers: PulpitCoworker[] = PULPIT_COWORKERS;
  let worshipTimes: WorshipTimeSlot[] = SUNDAY_WORSHIP_TIMES;
  let liturgySteps: LiturgyStep[] = [...LITURGY_STANDARD, ...LITURGY_COMMUNION];
  let ministryRoster: MinistryRosterItem[] = SUNDAY_MINISTRY_ROSTER;
  let weekdayMinistries: WeekdayMinistry[] = WEEKDAY_MINISTRIES;
  let announcements: AnnouncementItem[] = ANNOUNCEMENTS;
  let hasContent = false;

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
  } else {
    const infoDoc = await fetchFirestoreDoc('church_sections/info', token);
    if (infoDoc) {
      hasContent = true;
      churchInfo = normalizeChurchInfo(infoDoc as Partial<ChurchInfo>);
      const [cw, lp, wt, ls, mr, wm, ann] = await Promise.all([
        fetchFirestoreCollection('coworkers', token),
        fetchFirestoreCollection('pastors', token),
        fetchFirestoreCollection('worship_times', token),
        fetchFirestoreCollection('liturgy_steps', token),
        fetchFirestoreCollection('ministry_roster', token),
        fetchFirestoreCollection('weekday_ministries', token),
        fetchFirestoreCollection('announcements', token),
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
  }

  const uploadedCache = new Map<string, string>();
  if (hasContent) {
    onProgress?.('正在将旧版图片转存至 Cloudflare D1 数据库…');
    churchInfo = buildChurchInfoFields({
      ...churchInfo,
      heroImage: await migrateImageToD1(churchInfo.heroImage, getToken, uploadedCache),
      fellowshipImage: await migrateImageToD1(churchInfo.fellowshipImage, getToken, uploadedCache),
      churchTeamImage: await migrateImageToD1(churchInfo.churchTeamImage, getToken, uploadedCache),
    });

    coworkers = await Promise.all(
      coworkers.map(async (cw) => ({
        ...cw,
        ...(cw.image
          ? { image: await migrateImageToD1(cw.image, getToken, uploadedCache) }
          : {}),
      }))
    );

    ministryRoster = await Promise.all(
      ministryRoster.map(async (mr) => ({
        ...mr,
        image: await migrateImageToD1(mr.image, getToken, uploadedCache),
      }))
    );

    announcements = await Promise.all(
      announcements.map(async (ann) => ({
        ...ann,
        ...(ann.image
          ? { image: await migrateImageToD1(ann.image, getToken, uploadedCache) }
          : {}),
      }))
    );
  }

  onProgress?.('正在读取管理员名单、访客留言与访问统计…');
  const [adminsRaw, requestsRaw, visitorCounter, visitorIpsRaw] = await Promise.all([
    fetchFirestoreCollection('admins', token),
    fetchFirestoreCollection('visitor_requests', token),
    fetchFirestoreDoc('site_stats/visitor_counter', token),
    fetchFirestoreCollection('visitor_ips', token, 500),
  ]);

  const admins = adminsRaw.map((a) => ({
    uid: a.id,
    email: a.email,
    displayName: a.displayName,
    canViewVisitorStats: a.canViewVisitorStats === true,
    addedAt: a.addedAt,
  }));

  const visitorRequests = requestsRaw.map((r) => ({
    id: r.id,
    name: r.name,
    contact: r.contact,
    intent: r.intent,
    message: r.message,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: r.createdAt,
  }));

  const visitorIps = visitorIpsRaw.map((ip) => ({
    id: ip.id,
    country: ip.country,
    region: ip.region,
    countedAt: ip.countedAt,
  }));

  onProgress?.('正在写入 Cloudflare D1 数据库…');
  const res = await fetch('/api/admin/import-legacy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...(hasContent
        ? {
            content: {
              churchInfo,
              coworkers,
              worshipTimes,
              liturgySteps,
              ministryRoster,
              weekdayMinistries,
              announcements,
            },
          }
        : {}),
      admins,
      visitorRequests,
      visitorCounter,
      visitorIps,
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
    importedAdmins: result.importedAdmins ?? admins.length,
    importedRequests: result.importedRequests ?? visitorRequests.length,
    importedIps: result.importedIps ?? visitorIps.length,
  };
}
