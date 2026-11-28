import { FIELD_LIMITS } from '../data/cacheConfig';
import type {
  AdminUserItem,
  AnnouncementItem,
  ChurchInfo,
  LiturgyStep,
  MinistryRosterItem,
  PulpitCoworker,
  VisitorRequestItem,
  WeekdayMinistry,
  WorshipTimeSlot,
} from '../data/churchData';
import {
  buildChurchInfoFields,
  clampSortOrder,
  clampStr,
  cleanWeekdayMinistry,
  normalizeAnnouncements,
  normalizeChurchInfo,
  normalizeCoworkers,
  normalizeMinistryRoster,
  normalizeWeekdayMinistries,
} from '../utils/churchNormalization';
import { DATA_IMAGE_URI_REGEX } from '../utils/urlSafety';
import { firebaseApp, firebasePublicConfig } from './firebase';
import { blobToDataUrl, isD1MediaUrl } from './mediaStorage';

const MEDIA_CHUNK_CHARS = 600_000;
const MAX_MEDIA_CHUNKS = 30;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface FirestoreBackupSummary {
  backedUpImages: number;
  backedUpDocs: number;
  backedUpAdmins: number;
  backedUpRequests: number;
  warnings: string[];
}

function getErrorCodeAndMsg(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return `${code} ${msg}`.toLowerCase();
}

function isQuotaError(err: unknown): boolean {
  const combined = getErrorCodeAndMsg(err);
  return (
    combined.includes('resource-exhausted') ||
    combined.includes('resource_exhausted') ||
    combined.includes('quota') ||
    combined.includes('429')
  );
}

function isPermissionError(err: unknown): boolean {
  const combined = getErrorCodeAndMsg(err);
  return (
    combined.includes('permission-denied') ||
    combined.includes('permission_denied') ||
    combined.includes('insufficient permissions') ||
    combined.includes('unauthenticated')
  );
}

function sanitizeFirestoreId(raw: string | undefined, fallbackPrefix: string, index: number): string {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  if (cleaned.length >= 1) return cleaned;
  return `${fallbackPrefix}_${index + 1}`;
}

function mediaIdFromUrl(rawUrl: string, fallbackIndex: number): string {
  if (isD1MediaUrl(rawUrl)) {
    const fileName = rawUrl.split('/').pop() || '';
    const clean = fileName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 110);
    if (clean) return `d1_${clean}`;
  }
  let hash = 0;
  for (let i = 0; i < rawUrl.length; i += 1) {
    hash = (hash * 31 + rawUrl.charCodeAt(i)) >>> 0;
  }
  return `d1_inline_${hash.toString(36)}_${fallbackIndex}`;
}

function stripUndefined<T extends object>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? stripUndefined(item as object)
          : item
      );
    } else if (v && typeof v === 'object') {
      out[k] = stripUndefined(v as object);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function backupImageToFirestoreChunks(
  rawUrl: string | undefined,
  db: import('firebase/firestore').Firestore,
  sdk: typeof import('firebase/firestore'),
  imageCache: Map<string, string>,
  warnings: string[],
  counter: { uploadedCount: number; index: number }
): Promise<string> {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return '';
  if (imageCache.has(trimmed)) {
    return imageCache.get(trimmed)!;
  }

  let dataUrl = '';
  try {
    if (isD1MediaUrl(trimmed)) {
      const res = await fetch(trimmed);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      dataUrl = await blobToDataUrl(await res.blob());
    } else if (DATA_IMAGE_URI_REGEX.test(trimmed)) {
      dataUrl = trimmed;
    } else {
      imageCache.set(trimmed, trimmed);
      return trimmed;
    }

    if (!DATA_IMAGE_URI_REGEX.test(dataUrl)) {
      imageCache.set(trimmed, trimmed);
      return trimmed;
    }

    const totalChunks = Math.ceil(dataUrl.length / MEDIA_CHUNK_CHARS);
    if (totalChunks < 1 || totalChunks > MAX_MEDIA_CHUNKS) {
      warnings.push(`图片体积过大（超出 ${MAX_MEDIA_CHUNKS} 分片上限），已保留原引用。`);
      imageCache.set(trimmed, trimmed);
      return trimmed;
    }

    counter.index += 1;
    const mediaId = mediaIdFromUrl(trimmed, counter.index);
    const batch = sdk.writeBatch(db);
    for (let idx = 0; idx < totalChunks; idx += 1) {
      const chunkStr = dataUrl.slice(idx * MEDIA_CHUNK_CHARS, (idx + 1) * MEDIA_CHUNK_CHARS);
      const chunkId = `${mediaId}__${idx}`;
      batch.set(sdk.doc(db, 'media_chunks', chunkId), {
        mediaId,
        chunkIndex: idx,
        totalChunks,
        data: chunkStr,
        updatedAt: sdk.serverTimestamp(),
      });
    }
    await batch.commit();

    const mediaRef = `media://${mediaId}/${totalChunks}`;
    counter.uploadedCount += 1;
    imageCache.set(trimmed, mediaRef);
    return mediaRef;
  } catch (err) {
    if (isQuotaError(err)) {
      warnings.push('部分图片因 Firestore 今日写入配额限制暂未写入分片，已保留链接引用。');
    } else if (isPermissionError(err)) {
      warnings.push('部分图片写入 Firestore 分片权限受限，已保留链接引用。');
    } else {
      warnings.push('部分图片备份至 Firestore 分片失败，已保留链接引用。');
    }
    imageCache.set(trimmed, trimmed);
    return trimmed;
  }
}

export async function backupD1ToFirestore(params: {
  content: {
    churchInfo: ChurchInfo;
    coworkers: PulpitCoworker[];
    worshipTimes: WorshipTimeSlot[];
    liturgySteps: LiturgyStep[];
    ministryRoster: MinistryRosterItem[];
    weekdayMinistries: WeekdayMinistry[];
    announcements: AnnouncementItem[];
  };
  admins: AdminUserItem[];
  visitorRequests: VisitorRequestItem[];
  isMainAdmin: boolean;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  onProgress?: (step: string) => void;
}): Promise<FirestoreBackupSummary> {
  const token = await params.getToken(true);
  if (!token) {
    throw new Error('请先使用主管理员账号登录后再备份数据到 Firestore。');
  }

  const sdk = await import('firebase/firestore');
  const db = firebasePublicConfig.firestoreDatabaseId
    ? sdk.getFirestore(firebaseApp, firebasePublicConfig.firestoreDatabaseId)
    : sdk.getFirestore(firebaseApp);

  const warnings: string[] = [];
  const imageCache = new Map<string, string>();
  const imageCounter = { uploadedCount: 0, index: 0 };

  params.onProgress?.('正在将 D1 优化图片备份至 Firestore…');

  const rawInfo = normalizeChurchInfo(params.content.churchInfo);
  const backedHeroImage = await backupImageToFirestoreChunks(
    rawInfo.heroImage,
    db,
    sdk,
    imageCache,
    warnings,
    imageCounter
  );
  const backedFellowshipImage = await backupImageToFirestoreChunks(
    rawInfo.fellowshipImage,
    db,
    sdk,
    imageCache,
    warnings,
    imageCounter
  );
  const backedTeamImage = rawInfo.churchTeamImage
    ? await backupImageToFirestoreChunks(
        rawInfo.churchTeamImage,
        db,
        sdk,
        imageCache,
        warnings,
        imageCounter
      )
    : '';

  const infoCore = buildChurchInfoFields({
    ...rawInfo,
    heroImage: backedHeroImage || rawInfo.heroImage,
    fellowshipImage: backedFellowshipImage || rawInfo.fellowshipImage,
    ...(backedTeamImage ? { churchTeamImage: backedTeamImage } : { churchTeamImage: '' }),
  });

  const normalizedCoworkers = await Promise.all(
    normalizeCoworkers(params.content.coworkers)
      .slice(0, 50)
      .map(async (cw, idx) => {
        const backedImage = cw.image
          ? await backupImageToFirestoreChunks(cw.image, db, sdk, imageCache, warnings, imageCounter)
          : '';
        return {
          ...cw,
          id: sanitizeFirestoreId(cw.id, 'cw', idx),
          name: clampStr(cw.name, FIELD_LIMITS.coworker.name) || '讲台同工',
          title: clampStr(cw.title, FIELD_LIMITS.coworker.title) || '教会同工',
          ...(backedImage ? { image: clampStr(backedImage, FIELD_LIMITS.coworker.image) } : {}),
          sortOrder: clampSortOrder(cw.sortOrder, idx + 1),
        };
      })
  );
  // Remove image key if empty so Firestore coworker rule (!('image' in data) || ...) passes cleanly
  const cleanCoworkersForFirestore = normalizedCoworkers.map((cw) => {
    const { image, ...rest } = cw;
    return image ? { ...rest, image } : rest;
  });

  const cleanWorshipTimes = params.content.worshipTimes.slice(0, 20).map((wt, idx) => ({
    id: sanitizeFirestoreId(wt.id, 'wt', idx),
    time: clampStr(wt.time, FIELD_LIMITS.worshipTime.time) || '14:30',
    title: clampStr(wt.title, FIELD_LIMITS.worshipTime.title) || '主日聚会',
    place: clampStr(wt.place, FIELD_LIMITS.worshipTime.place) || '主堂',
    desc: clampStr(wt.desc, FIELD_LIMITS.worshipTime.desc) || '敬拜与信息分享',
    sortOrder: clampSortOrder(wt.sortOrder, idx + 1),
  }));

  const cleanLiturgySteps = params.content.liturgySteps.slice(0, 40).map((ls, idx) => {
    const scriptureOrHymn = clampStr(ls.scriptureOrHymn, FIELD_LIMITS.liturgyStep.scriptureOrHymn);
    return {
      id: sanitizeFirestoreId(ls.id, 'ls', idx),
      liturgyType: ls.liturgyType === 'communion' ? ('communion' as const) : ('standard' as const),
      time: clampStr(ls.time, FIELD_LIMITS.liturgyStep.time) || '14:30',
      step: clampStr(ls.step, FIELD_LIMITS.liturgyStep.step) || '程序',
      ...(scriptureOrHymn ? { scriptureOrHymn } : {}),
      leader: clampStr(ls.leader, FIELD_LIMITS.liturgyStep.leader) || '主领同工',
      note: clampStr(ls.note, FIELD_LIMITS.liturgyStep.note) || '主日崇拜程序',
      sortOrder: clampSortOrder(ls.sortOrder, idx + 1),
    };
  });

  const cleanMinistryRoster = await Promise.all(
    normalizeMinistryRoster(params.content.ministryRoster)
      .slice(0, 80)
      .map(async (mr, idx) => {
        const backedImage = await backupImageToFirestoreChunks(
          mr.image,
          db,
          sdk,
          imageCache,
          warnings,
          imageCounter
        );
        const coverRef =
          clampStr(backedImage || mr.image, FIELD_LIMITS.ministryRoster.image) ||
          '/images/default.webp';
        const backedGallery: string[] = [];
        for (const img of (mr.galleryImages ?? []).slice(
          0,
          FIELD_LIMITS.ministryRoster.galleryMaxCount
        )) {
          const backedItem = await backupImageToFirestoreChunks(
            img,
            db,
            sdk,
            imageCache,
            warnings,
            imageCounter
          );
          const cleanRef = clampStr(backedItem || img, FIELD_LIMITS.ministryRoster.image);
          if (cleanRef && cleanRef !== coverRef && !backedGallery.includes(cleanRef)) {
            backedGallery.push(cleanRef);
          }
        }
        return {
          id: sanitizeFirestoreId(mr.id, 'mr', idx),
          category: mr.category,
          title: clampStr(mr.title, FIELD_LIMITS.ministryRoster.title) || '事工展示',
          image: coverRef,
          ...(backedGallery.length > 0 ? { galleryImages: backedGallery } : {}),
          schedule: clampStr(mr.schedule, FIELD_LIMITS.ministryRoster.schedule),
          description: clampStr(mr.description, FIELD_LIMITS.ministryRoster.description),
          sortOrder: clampSortOrder(mr.sortOrder, idx + 1),
        };
      })
  );

  const cleanWeekdayMinistries = normalizeWeekdayMinistries(params.content.weekdayMinistries)
    .slice(0, 30)
    .map((wm, idx) => {
      const cleaned = cleanWeekdayMinistry(wm, idx + 1);
      return {
        ...cleaned,
        id: sanitizeFirestoreId(cleaned.id, 'wm', idx),
      };
    });

  const cleanAnnouncements = await Promise.all(
    normalizeAnnouncements(params.content.announcements)
      .slice(0, 50)
      .map(async (ann, idx) => {
        const backedImage = ann.image
          ? await backupImageToFirestoreChunks(ann.image, db, sdk, imageCache, warnings, imageCounter)
          : '';
        return stripUndefined({
          id: sanitizeFirestoreId(ann.id, 'ann', idx),
          category: ann.category,
          ...(ann.date ? { date: clampStr(ann.date, FIELD_LIMITS.announcement.date) } : {}),
          title: clampStr(ann.title, FIELD_LIMITS.announcement.title) || '教会公告',
          summary: clampStr(ann.summary, FIELD_LIMITS.announcement.summary) || '家事通知',
          ...(ann.time ? { time: clampStr(ann.time, FIELD_LIMITS.announcement.time) } : {}),
          ...(ann.location ? { location: clampStr(ann.location, FIELD_LIMITS.announcement.location) } : {}),
          ...(ann.contact ? { contact: clampStr(ann.contact, FIELD_LIMITS.announcement.contact) } : {}),
          ...(backedImage ? { image: clampStr(backedImage, FIELD_LIMITS.announcement.image) } : {}),
          isFeatured: Boolean(ann.isFeatured),
          details: (ann.details ?? [])
            .slice(0, FIELD_LIMITS.announcement.detailsMaxCount)
            .map((d) => clampStr(d, FIELD_LIMITS.announcement.detailLen))
            .filter(Boolean),
          sortOrder: clampSortOrder(ann.sortOrder, idx + 1),
        });
      })
  );

  params.onProgress?.('正在将教会图文内容同步写入 Firestore…');
  let backedUpDocs = 0;

  try {
    // 1. church_sections/info & church_sections/public_bundle
    const cleanedInfoCore = stripUndefined(infoCore);
    if (!infoCore.churchTeamImage) {
      delete cleanedInfoCore.churchTeamImage;
    }
    const infoDocPayload = {
      ...cleanedInfoCore,
      updatedAt: sdk.serverTimestamp(),
    };

    const publicBundleDocPayload = {
      churchInfo: stripUndefined({
        ...infoCore,
        updatedAt: new Date().toISOString(),
      }),
      coworkers: cleanCoworkersForFirestore,
      worshipTimes: cleanWorshipTimes,
      liturgySteps: cleanLiturgySteps,
      ministryRoster: cleanMinistryRoster,
      weekdayMinistries: cleanWeekdayMinistries,
      announcements: cleanAnnouncements,
      version: Date.now(),
      updatedAt: sdk.serverTimestamp(),
    };

    const sectionBatch = sdk.writeBatch(db);
    sectionBatch.set(sdk.doc(db, 'church_sections', 'info'), infoDocPayload);
    sectionBatch.set(sdk.doc(db, 'church_sections', 'public_bundle'), publicBundleDocPayload);
    await sectionBatch.commit();
    backedUpDocs += 2;

    // 2. Sync each collection (upsert current docs + remove obsolete docs)
    const syncCollection = async (
      colName: string,
      items: Array<Record<string, unknown> & { id: string }>
    ) => {
      const existingSnap = await sdk.getDocs(sdk.collection(db, colName));
      const keepIds = new Set(items.map((item) => item.id));
      const ops: Array<
        | { type: 'set'; id: string; data: Record<string, unknown> }
        | { type: 'delete'; id: string }
      > = [];

      for (const item of items) {
        const { id, ...rest } = item;
        ops.push({
          type: 'set',
          id,
          data: {
            ...stripUndefined(rest),
            updatedAt: sdk.serverTimestamp(),
          },
        });
      }

      for (const existingDoc of existingSnap.docs) {
        if (!keepIds.has(existingDoc.id)) {
          ops.push({ type: 'delete', id: existingDoc.id });
        }
      }

      for (let i = 0; i < ops.length; i += 400) {
        const batch = sdk.writeBatch(db);
        for (const op of ops.slice(i, i + 400)) {
          const ref = sdk.doc(db, colName, op.id);
          if (op.type === 'set') {
            batch.set(ref, op.data);
            backedUpDocs += 1;
          } else {
            batch.delete(ref);
          }
        }
        await batch.commit();
      }
    };

    await syncCollection('coworkers', cleanCoworkersForFirestore);
    await syncCollection('worship_times', cleanWorshipTimes);
    await syncCollection('liturgy_steps', cleanLiturgySteps);
    await syncCollection('ministry_roster', cleanMinistryRoster);
    await syncCollection(
      'weekday_ministries',
      cleanWeekdayMinistries as unknown as Array<Record<string, unknown> & { id: string }>
    );
    await syncCollection(
      'announcements',
      cleanAnnouncements as unknown as Array<Record<string, unknown> & { id: string }>
    );
  } catch (err) {
    if (isQuotaError(err)) {
      throw new Error('Firestore 今日免费写入配额已达上限，请明日重置后再试。');
    }
    if (isPermissionError(err)) {
      throw new Error('Firestore 写入权限不足，请确认已使用授权管理员账号登录且安全规则已同步。');
    }
    throw err;
  }

  // 3. Optional private collections: admins & visitor_requests
  let backedUpAdmins = 0;
  let backedUpRequests = 0;

  if (params.isMainAdmin && params.admins.length > 0) {
    params.onProgress?.('正在备份同工权限名单到 Firestore…');
    try {
      for (let i = 0; i < params.admins.length; i += 1) {
        const admin = params.admins[i];
        const uid = sanitizeFirestoreId(admin.uid, 'admin', i);
        const email = clampStr(admin.email, FIELD_LIMITS.adminUser.email);
        const displayName = clampStr(admin.displayName, FIELD_LIMITS.adminUser.displayName);
        if (!uid || !EMAIL_REGEX.test(email) || !displayName) continue;

        const ref = sdk.doc(db, 'admins', uid);
        const snap = await sdk.getDoc(ref);
        if (!snap.exists()) {
          await sdk.setDoc(ref, {
            email,
            displayName,
            canViewVisitorStats: Boolean(admin.canViewVisitorStats),
            addedAt: sdk.serverTimestamp(),
          });
          backedUpAdmins += 1;
        } else {
          const prevFlag = snap.data()?.canViewVisitorStats === true;
          const nextFlag = Boolean(admin.canViewVisitorStats);
          if (prevFlag !== nextFlag) {
            await sdk.updateDoc(ref, { canViewVisitorStats: nextFlag });
            backedUpAdmins += 1;
          } else {
            backedUpAdmins += 1;
          }
        }
      }
    } catch (err) {
      if (isQuotaError(err)) {
        warnings.push('同工权限名单因 Firestore 配额限制未完成备份');
      } else if (isPermissionError(err)) {
        warnings.push('同工权限名单因 Firestore 权限受限已跳过');
      } else {
        warnings.push('同工权限名单备份时出现异常，已跳过');
      }
    }
  }

  if (params.visitorRequests.length > 0) {
    params.onProgress?.('正在备份来访留言到 Firestore…');
    try {
      for (let i = 0; i < params.visitorRequests.length; i += 1) {
        const req = params.visitorRequests[i];
        const id = sanitizeFirestoreId(req.id, 'vr', i);
        const name = clampStr(req.name, FIELD_LIMITS.visitorRequest.name);
        const contact = clampStr(req.contact, FIELD_LIMITS.visitorRequest.contact);
        const intent = clampStr(req.intent, FIELD_LIMITS.visitorRequest.intent);
        const message = clampStr(req.message, FIELD_LIMITS.visitorRequest.message);
        const adminNote = clampStr(req.adminNote, FIELD_LIMITS.visitorRequest.adminNote);
        const status =
          req.status === 'contacted' || req.status === 'archived' ? req.status : 'pending';
        if (!name || contact.length < 5) continue;

        const ref = sdk.doc(db, 'visitor_requests', id);
        const snap = await sdk.getDoc(ref);
        if (!snap.exists()) {
          await sdk.setDoc(ref, {
            name,
            contact,
            ...(intent ? { intent } : {}),
            message,
            status: 'pending',
            createdAt: sdk.serverTimestamp(),
          });
          if (status !== 'pending' || adminNote) {
            await sdk.updateDoc(ref, {
              status,
              ...(adminNote ? { adminNote } : {}),
            });
          }
          backedUpRequests += 1;
        } else {
          await sdk.updateDoc(ref, {
            status,
            adminNote,
          });
          backedUpRequests += 1;
        }
      }
    } catch (err) {
      if (isQuotaError(err)) {
        warnings.push('来访留言因 Firestore 配额限制未完成备份');
      } else if (isPermissionError(err)) {
        warnings.push('来访留言因 Firestore 权限受限已跳过');
      } else {
        warnings.push('来访留言备份时出现异常，已跳过');
      }
    }
  }

  return {
    backedUpImages: imageCounter.uploadedCount,
    backedUpDocs,
    backedUpAdmins,
    backedUpRequests,
    warnings,
  };
}
