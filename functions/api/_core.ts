import { FIELD_LIMITS } from '../../src/data/cacheConfig';
import type { AdminAccessResult } from './_auth';
import { jsonResponse } from './_auth';
import { createD1MediaStore, type SqlDb, type SqlPreparedStatement } from './_db';
import type { GeoIdentity } from './_geo';
import {
  buildVisitorNotificationEmail,
  parseRecipients,
  resolveAdminPortalUrl,
  resolveSenderAddress,
  sanitizeMultiline,
  sanitizeSingleLine,
  sendResendEmail,
} from './_visitorNotify';

const VALID_COLLECTIONS = new Set([
  'coworkers',
  'worship_times',
  'liturgy_steps',
  'ministry_roster',
  'weekday_ministries',
  'announcements',
]);

const D1_MEDIA_URL_REGEX = /^\/api\/media\/([a-zA-Z0-9_-]{4,120}\.(webp|jpg|jpeg|png))$/;
const SAFE_MEDIA_KEY_REGEX = /^[a-zA-Z0-9_-]{4,120}\.(webp|jpg|jpeg|png)$/;
const SAFE_IMAGE_SRC_REGEX =
  /^(https?:\/\/.+|\/(?!\/).*|media:\/\/[a-zA-Z0-9_-]+\/[1-9][0-9]?|data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+)$/;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

function clampStr(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function clampSortOrder(val: unknown, fallback = 0): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(1000, Math.max(0, Math.round(num)));
}

function sanitizeImageRef(val: unknown, maxLen: number): string {
  const trimmed = String(val ?? '').trim();
  if (!trimmed) return '';
  if (!SAFE_IMAGE_SRC_REGEX.test(trimmed)) {
    throw new Error('图片地址格式无效，请重新上传或填写有效图片网址。');
  }
  return trimmed.slice(0, maxLen);
}

function sanitizeMinistryGallery(
  rawGallery: unknown,
  coverImage: string,
  maxCount: number,
  maxLen: number
): string[] {
  if (!Array.isArray(rawGallery)) return [];
  const seen = new Set<string>(coverImage ? [coverImage] : []);
  const out: string[] = [];
  for (const entry of rawGallery.slice(0, maxCount * 2)) {
    if (out.length >= maxCount) break;
    if (typeof entry !== 'string') continue;
    const clean = sanitizeImageRef(entry, maxLen);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

function parseMinistryGalleryJson(rawJson: unknown, coverImage: string): string[] {
  if (typeof rawJson !== 'string' || !rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>(coverImage ? [coverImage] : []);
    const out: string[] = [];
    for (const item of parsed) {
      if (out.length >= FIELD_LIMITS.ministryRoster.galleryMaxCount) break;
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed || !SAFE_IMAGE_SRC_REGEX.test(trimmed) || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
    return out;
  } catch {
    return [];
  }
}

function makeId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rnd}`;
}

function validateSafeDocId(id: unknown, fallbackPrefix: string): string {
  const raw = String(id ?? '').trim();
  if (!raw) return makeId(fallbackPrefix);
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  return clean || makeId(fallbackPrefix);
}

export function extractD1MediaKey(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = url.trim().match(D1_MEDIA_URL_REGEX);
  return match ? match[1] : null;
}

export function detectValidImageMime(
  bytes: Uint8Array,
  declaredMime: string
): { mime: 'image/webp' | 'image/jpeg' | 'image/png'; ext: 'webp' | 'jpg' | 'png' } | null {
  if (bytes.length < 12) return null;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  const lower = declaredMime.toLowerCase().split(';')[0].trim();
  if (isWebp && (lower === 'image/webp' || !lower)) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (isJpeg && (lower === 'image/jpeg' || lower === 'image/jpg' || !lower)) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (isPng && (lower === 'image/png' || !lower)) {
    return { mime: 'image/png', ext: 'png' };
  }
  // If magic bytes match one of the safe formats even if Content-Type was slightly generic
  if (isWebp) return { mime: 'image/webp', ext: 'webp' };
  if (isJpeg) return { mime: 'image/jpeg', ext: 'jpg' };
  if (isPng) return { mime: 'image/png', ext: 'png' };
  return null;
}

function sanitizeChurchInfoPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const L = FIELD_LIMITS.churchInfo;
  const rawTheme = String(raw.siteTheme ?? 'classic');
  const siteTheme = ['classic', 'christmas', 'easter', 'thanksgiving'].includes(rawTheme)
    ? rawTheme
    : 'classic';

  const introParagraphs = Array.isArray(raw.introParagraphs)
    ? raw.introParagraphs
        .slice(0, L.introParagraphMaxCount)
        .map((p) => clampStr(p, L.introParagraphLen))
        .filter(Boolean)
    : [];

  const coreValues = Array.isArray(raw.coreValues)
    ? raw.coreValues.slice(0, L.coreValuesMaxCount).map((cv, idx) => {
        const obj = (cv && typeof cv === 'object' ? cv : {}) as Record<string, unknown>;
        return {
          index: clampStr(obj.index || String(idx + 1).padStart(2, '0'), L.coreValueIndex),
          title: clampStr(obj.title, L.coreValueTitle),
          description: clampStr(obj.description, L.coreValueDescription),
        };
      })
    : [];

  return {
    name: clampStr(raw.name, L.name),
    founded: clampStr(raw.founded, L.founded),
    scriptureQuote: clampStr(raw.scriptureQuote, L.scriptureQuote),
    scriptureRef: clampStr(raw.scriptureRef, L.scriptureRef),
    heroSubtitle: clampStr(raw.heroSubtitle, L.heroSubtitle),
    heroImage: sanitizeImageRef(raw.heroImage, L.heroImage),
    fellowshipImage: sanitizeImageRef(raw.fellowshipImage, L.fellowshipImage),
    churchTeamImage: sanitizeImageRef(raw.churchTeamImage, L.churchTeamImage),
    address: clampStr(raw.address, L.address),
    shortAddress: clampStr(raw.shortAddress, L.shortAddress),
    pastoralPhone: clampStr(raw.pastoralPhone, L.pastoralPhone),
    themeVerse: clampStr(raw.themeVerse, L.themeVerse),
    themeVerseRef: clampStr(raw.themeVerseRef, L.themeVerseRef),
    thisWeekLabel: clampStr(raw.thisWeekLabel, L.thisWeekLabel),
    nextWeekLabel: clampStr(raw.nextWeekLabel, L.nextWeekLabel),
    siteTheme,
    introParagraphs,
    coreValues,
  };
}

export async function rebuildPublicSnapshot(db: SqlDb): Promise<{
  bundle: Record<string, unknown>;
  version: number;
  updatedAt: string;
} | null> {
  const infoRow = await db
    .prepare('SELECT payload FROM church_info WHERE id = ? LIMIT 1')
    .bind('info')
    .first<{ payload: string }>();

  if (!infoRow) {
    return null;
  }

  let churchInfo: Record<string, unknown>;
  try {
    churchInfo = JSON.parse(infoRow.payload) as Record<string, unknown>;
  } catch {
    return null;
  }

  const [cwRows, wtRows, lsRows, mrRows, wmRows, annRows] = await Promise.all([
    db
      .prepare('SELECT id, name, title, image, sort_order FROM coworkers ORDER BY sort_order ASC LIMIT 50')
      .all<{ id: string; name: string; title: string; image: string; sort_order: number }>(),
    db
      .prepare('SELECT id, time, title, place, desc, sort_order FROM worship_times ORDER BY sort_order ASC LIMIT 20')
      .all<{ id: string; time: string; title: string; place: string; desc: string; sort_order: number }>(),
    db
      .prepare(
        'SELECT id, liturgy_type, time, step, scripture_or_hymn, leader, note, sort_order FROM liturgy_steps ORDER BY sort_order ASC LIMIT 40'
      )
      .all<{
        id: string;
        liturgy_type: string;
        time: string;
        step: string;
        scripture_or_hymn: string;
        leader: string;
        note: string;
        sort_order: number;
      }>(),
    db
      .prepare(
        'SELECT id, category, title, image, gallery_json, schedule, description, sort_order FROM ministry_roster ORDER BY sort_order ASC LIMIT 80'
      )
      .all<{
        id: string;
        category: string;
        title: string;
        image: string;
        gallery_json: string;
        schedule: string;
        description: string;
        sort_order: number;
      }>(),
    db
      .prepare(
        'SELECT id, day, time, title, location, leader, description, sort_order FROM weekday_ministries ORDER BY sort_order ASC LIMIT 30'
      )
      .all<{
        id: string;
        day: string;
        time: string;
        title: string;
        location: string;
        leader: string;
        description: string;
        sort_order: number;
      }>(),
    db
      .prepare(
        'SELECT id, category, date, title, summary, time, location, contact, image, is_featured, details_json, sort_order FROM announcements ORDER BY sort_order ASC LIMIT 50'
      )
      .all<{
        id: string;
        category: string;
        date: string;
        title: string;
        summary: string;
        time: string;
        location: string;
        contact: string;
        image: string;
        is_featured: number;
        details_json: string;
        sort_order: number;
      }>(),
  ]);

  const version = Date.now();
  const updatedAt = new Date().toISOString();

  const bundle = {
    churchInfo,
    coworkers: cwRows.results.map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      ...(r.image ? { image: r.image } : {}),
      sortOrder: Number(r.sort_order),
    })),
    worshipTimes: wtRows.results.map((r) => ({
      id: r.id,
      time: r.time,
      title: r.title,
      place: r.place,
      desc: r.desc,
      sortOrder: Number(r.sort_order),
    })),
    liturgySteps: lsRows.results.map((r) => ({
      id: r.id,
      liturgyType: r.liturgy_type === 'communion' ? 'communion' : 'standard',
      time: r.time,
      step: r.step,
      ...(r.scripture_or_hymn ? { scriptureOrHymn: r.scripture_or_hymn } : {}),
      leader: r.leader,
      note: r.note,
      sortOrder: Number(r.sort_order),
    })),
    ministryRoster: mrRows.results.map((r) => {
      const galleryImages = parseMinistryGalleryJson(r.gallery_json, r.image);
      return {
        id: r.id,
        category: r.category,
        title: r.title,
        image: r.image,
        ...(galleryImages.length > 0 ? { galleryImages } : {}),
        schedule: r.schedule,
        description: r.description,
        sortOrder: Number(r.sort_order),
      };
    }),
    weekdayMinistries: wmRows.results.map((r) => ({
      id: r.id,
      day: r.day,
      time: r.time,
      title: r.title,
      ...(r.location ? { location: r.location } : {}),
      ...(r.leader ? { leader: r.leader } : {}),
      ...(r.description ? { description: r.description } : {}),
      sortOrder: Number(r.sort_order),
    })),
    announcements: annRows.results.map((r) => {
      let details: string[] = [];
      try {
        const parsed = JSON.parse(r.details_json);
        if (Array.isArray(parsed)) details = parsed.filter((x) => typeof x === 'string');
      } catch {
        details = [];
      }
      return {
        id: r.id,
        category: r.category,
        ...(r.date ? { date: r.date } : {}),
        title: r.title,
        summary: r.summary,
        ...(r.time ? { time: r.time } : {}),
        ...(r.location ? { location: r.location } : {}),
        ...(r.contact ? { contact: r.contact } : {}),
        ...(r.image ? { image: r.image } : {}),
        isFeatured: Number(r.is_featured) === 1,
        details,
        sortOrder: Number(r.sort_order),
      };
    }),
    version,
  };

  await db
    .prepare(
      `INSERT INTO public_snapshot (id, bundle_json, version, updated_at)
       VALUES ('public_bundle', ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         bundle_json = excluded.bundle_json,
         version = excluded.version,
         updated_at = excluded.updated_at`
    )
    .bind(JSON.stringify(bundle), version, updatedAt)
    .run();

  return { bundle, version, updatedAt };
}

async function isMediaKeyStillReferenced(db: SqlDb, mediaKey: string): Promise<boolean> {
  const url = `/api/media/${mediaKey}`;
  const infoRow = await db
    .prepare('SELECT payload FROM church_info WHERE id = ? LIMIT 1')
    .bind('info')
    .first<{ payload: string }>();
  if (infoRow && infoRow.payload.includes(url)) {
    return true;
  }
  const [cw, mr, ann] = await Promise.all([
    db.prepare('SELECT id FROM coworkers WHERE image = ? LIMIT 1').bind(url).first(),
    db
      .prepare('SELECT id FROM ministry_roster WHERE image = ? OR INSTR(gallery_json, ?) > 0 LIMIT 1')
      .bind(url, JSON.stringify(url))
      .first(),
    db.prepare('SELECT id FROM announcements WHERE image = ? LIMIT 1').bind(url).first(),
  ]);
  return Boolean(cw || mr || ann);
}

async function cleanupOrphanedMediaKeys(
  db: SqlDb,
  candidateUrls: Array<string | undefined | null>
): Promise<void> {
  const mediaStore = createD1MediaStore(db);
  const keys = new Set<string>();
  for (const url of candidateUrls) {
    const key = extractD1MediaKey(url);
    if (key) keys.add(key);
  }
  for (const key of keys) {
    try {
      const referenced = await isMediaKeyStillReferenced(db, key);
      if (!referenced) {
        await mediaStore.delete(key);
      }
    } catch {
      // Best-effort cleanup
    }
  }
}

export async function handleGetPublicBundle(db: SqlDb): Promise<Response> {
  const row = await db
    .prepare('SELECT bundle_json, version, updated_at FROM public_snapshot WHERE id = ? LIMIT 1')
    .bind('public_bundle')
    .first<{ bundle_json: string; version: number; updated_at: string }>();

  if (!row) {
    return jsonResponse(
      { exists: false, bundle: null },
      200,
      { 'cache-control': 'no-cache, max-age=0' }
    );
  }

  let bundle: unknown = null;
  try {
    bundle = JSON.parse(row.bundle_json);
  } catch {
    return jsonResponse({ exists: false, bundle: null }, 200);
  }

  return jsonResponse(
    {
      exists: true,
      bundle,
      version: Number(row.version),
      updatedAt: row.updated_at,
    },
    200,
    {
      'cache-control': 'public, max-age=0, must-revalidate',
      etag: `"v${Number(row.version)}"`,
    }
  );
}

export async function handleTrackVisitor(
  db: SqlDb,
  identity: GeoIdentity
): Promise<Response> {
  const { ipHash, country, region } = identity;
  const nowIso = new Date().toISOString();

  const existingIp = await db
    .prepare('SELECT ip_hash, country, region FROM visitor_ips WHERE ip_hash = ? LIMIT 1')
    .bind(ipHash)
    .first<{ ip_hash: string; country: string; region: string }>();

  const isResolved = country && country !== '未知国家/地区';

  if (existingIp) {
    if (
      isResolved &&
      (!existingIp.country || existingIp.country === '未知国家/地区')
    ) {
      await db
        .prepare('UPDATE visitor_ips SET country = ?, region = ?, updated_at = ? WHERE ip_hash = ?')
        .bind(country, region, nowIso, ipHash)
        .run();
    }
    const statRow = await db
      .prepare('SELECT total_visitors FROM site_stats WHERE id = ? LIMIT 1')
      .bind('visitor_counter')
      .first<{ total_visitors: number }>();
    const total = statRow ? Math.max(1, Math.floor(Number(statRow.total_visitors))) : null;
    return jsonResponse({ totalVisitors: total });
  }

  // Insert dedupe record idempotently using INSERT OR IGNORE
  const insertRes = await db
    .prepare(
      `INSERT OR IGNORE INTO visitor_ips (ip_hash, country, region, counted_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(ipHash, country, region, nowIso, nowIso)
    .run();

  const inserted = Number(insertRes.meta?.changes ?? 0) > 0;
  if (inserted) {
    await db
      .prepare(
        `INSERT INTO site_stats (id, total_visitors, last_visitor_id, updated_at)
         VALUES ('visitor_counter', 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           total_visitors = site_stats.total_visitors + 1,
           last_visitor_id = excluded.last_visitor_id,
           updated_at = excluded.updated_at`
      )
      .bind(ipHash, nowIso)
      .run();
  }

  const statRow = await db
    .prepare('SELECT total_visitors FROM site_stats WHERE id = ? LIMIT 1')
    .bind('visitor_counter')
    .first<{ total_visitors: number }>();

  const totalVisitors = statRow
    ? Math.max(1, Math.floor(Number(statRow.total_visitors)))
    : 1;

  return jsonResponse({ totalVisitors });
}

export async function handleCreateVisitorRequest(
  db: SqlDb,
  body: Record<string, unknown>,
  notifyEnv: {
    resendApiKey?: string;
    notifyTo?: string;
    notifyFrom?: string;
    appUrl?: string;
    host?: string;
    proto?: string;
  }
): Promise<Response> {
  if (typeof body.honeypot === 'string' && body.honeypot.trim().length > 0) {
    return jsonResponse({ ok: true, skipped: true });
  }

  const L = FIELD_LIMITS.visitorRequest;
  const name = sanitizeSingleLine(body.name, L.name);
  const contact = sanitizeSingleLine(body.contact, L.contact);
  const intent = sanitizeSingleLine(body.intent, L.intent);
  const message = sanitizeMultiline(body.message, L.message);

  if (!name || contact.length < 5) {
    return jsonResponse({ ok: false, error: '请填写您的姓名及有效的联系方式。' }, 400);
  }

  const id = makeId('vr');
  const nowIso = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO visitor_requests (id, name, contact, intent, message, status, admin_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', '', ?, ?)`
    )
    .bind(id, name, contact, intent, message, nowIso, nowIso)
    .run();

  let emailSent = false;
  const apiKey = (notifyEnv.resendApiKey || '').trim();
  if (apiKey) {
    const to = parseRecipients(notifyEnv.notifyTo);
    const from = resolveSenderAddress(notifyEnv.notifyFrom);
    const adminUrl = resolveAdminPortalUrl(notifyEnv.appUrl, {
      host: notifyEnv.host,
      proto: notifyEnv.proto,
    });
    const email = buildVisitorNotificationEmail({
      payload: { name, contact, intent, message },
      adminUrl,
    });
    const sendRes = await sendResendEmail({
      apiKey,
      from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    emailSent = sendRes.ok;
  }

  return jsonResponse({ ok: true, id, emailSent });
}

export async function handleGetMedia(
  db: SqlDb,
  rawKey: string,
  ifNoneMatch?: string | null
): Promise<Response> {
  const key = rawKey.trim();
  if (!SAFE_MEDIA_KEY_REGEX.test(key)) {
    return new Response('Invalid media key', { status: 400 });
  }
  const expectedEtag = `"media-${key}"`;
  if (ifNoneMatch && ifNoneMatch.includes(expectedEtag)) {
    return new Response(null, {
      status: 304,
      headers: {
        etag: expectedEtag,
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const mediaStore = createD1MediaStore(db);
  const obj = await mediaStore.get(key);
  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }

  const headers: Record<string, string> = {
    'content-type': obj.contentType,
    'content-length': String(obj.bytes.byteLength),
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    etag: obj.etag,
  };

  return new Response(obj.bytes as unknown as BodyInit, { status: 200, headers });
}

export async function handleUploadMedia(
  db: SqlDb,
  bytes: Uint8Array,
  declaredContentType: string
): Promise<Response> {
  if (bytes.byteLength === 0) {
    return jsonResponse({ ok: false, error: '上传图片内容为空。' }, 400);
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return jsonResponse({ ok: false, error: '图片文件超过 10 MB 上限，请压缩后再试。' }, 413);
  }

  const detected = detectValidImageMime(bytes, declaredContentType);
  if (!detected) {
    return jsonResponse(
      { ok: false, error: '仅支持 JPG、PNG 或 WebP 格式的有效图片文件。' },
      400
    );
  }

  const randomPart = Math.random().toString(36).slice(2, 8);
  const key = `img-${Date.now()}-${randomPart}.${detected.ext}`;
  const mediaStore = createD1MediaStore(db);
  await mediaStore.put(key, bytes, detected.mime);

  return jsonResponse({
    ok: true,
    key,
    url: `/api/media/${key}`,
    contentType: detected.mime,
    bytes: bytes.byteLength,
  });
}

export async function handleGetAdminWorkspace(
  db: SqlDb,
  access: AdminAccessResult
): Promise<Response> {
  const [snapRes, reqRows, statRow] = await Promise.all([
    db
      .prepare('SELECT bundle_json, version, updated_at FROM public_snapshot WHERE id = ? LIMIT 1')
      .bind('public_bundle')
      .first<{ bundle_json: string; version: number; updated_at: string }>(),
    db
      .prepare(
        'SELECT id, name, contact, intent, message, status, admin_note, created_at FROM visitor_requests ORDER BY created_at DESC LIMIT 100'
      )
      .all<{
        id: string;
        name: string;
        contact: string;
        intent: string;
        message: string;
        status: string;
        admin_note: string;
        created_at: string;
      }>(),
    access.canViewVisitorStats
      ? db
          .prepare('SELECT total_visitors, last_visitor_id, updated_at FROM site_stats WHERE id = ? LIMIT 1')
          .bind('visitor_counter')
          .first<{ total_visitors: number; last_visitor_id: string; updated_at: string }>()
      : Promise.resolve(null),
  ]);

  let bundle: unknown = null;
  if (snapRes) {
    try {
      bundle = JSON.parse(snapRes.bundle_json);
    } catch {
      bundle = null;
    }
  }

  const visitorRequests = reqRows.results.map((r) => ({
    id: r.id,
    name: r.name,
    contact: r.contact,
    ...(r.intent ? { intent: r.intent } : {}),
    message: r.message,
    status:
      r.status === 'contacted' || r.status === 'archived' ? r.status : 'pending',
    ...(r.admin_note ? { adminNote: r.admin_note } : {}),
    createdAt: r.created_at,
  }));

  const visitorStats =
    access.canViewVisitorStats && statRow
      ? {
          totalVisitors: Number(statRow.total_visitors),
          lastVisitorId: statRow.last_visitor_id,
          updatedAt: statRow.updated_at,
        }
      : null;

  return jsonResponse({
    hasCloudData: Boolean(bundle),
    bundle,
    version: snapRes ? Number(snapRes.version) : 0,
    updatedAt: snapRes ? snapRes.updated_at : null,
    visitorRequests,
    visitorStats,
  });
}

export async function handleSyncAll(
  db: SqlDb,
  body: Record<string, unknown>
): Promise<Response> {
  const rawInfo = body.churchInfo;
  if (!rawInfo || typeof rawInfo !== 'object' || Array.isArray(rawInfo)) {
    return jsonResponse({ ok: false, error: '缺少教会基础信息。' }, 400);
  }

  const nowIso = new Date().toISOString();
  const cleanedInfo = sanitizeChurchInfoPayload(rawInfo as Record<string, unknown>);

  const statements: SqlPreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO church_info (id, payload, updated_at)
         VALUES ('info', ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
      )
      .bind(JSON.stringify(cleanedInfo), nowIso),
  ];

  // Replace collections cleanly inside batch
  statements.push(db.prepare('DELETE FROM coworkers'));
  const coworkers = Array.isArray(body.coworkers) ? body.coworkers.slice(0, 50) : [];
  for (const [idx, item] of coworkers.entries()) {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const L = FIELD_LIMITS.coworker;
    statements.push(
      db
        .prepare(
          'INSERT INTO coworkers (id, name, title, image, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(
          validateSafeDocId(obj.id, 'cw'),
          clampStr(obj.name, L.name),
          clampStr(obj.title, L.title),
          sanitizeImageRef(obj.image, L.image),
          clampSortOrder(obj.sortOrder, idx + 1),
          nowIso
        )
    );
  }

  statements.push(db.prepare('DELETE FROM worship_times'));
  const worshipTimes = Array.isArray(body.worshipTimes) ? body.worshipTimes.slice(0, 20) : [];
  for (const [idx, item] of worshipTimes.entries()) {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const L = FIELD_LIMITS.worshipTime;
    statements.push(
      db
        .prepare(
          'INSERT INTO worship_times (id, time, title, place, desc, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          validateSafeDocId(obj.id, 'wt'),
          clampStr(obj.time, L.time),
          clampStr(obj.title, L.title),
          clampStr(obj.place, L.place),
          clampStr(obj.desc, L.desc),
          clampSortOrder(obj.sortOrder, idx + 1),
          nowIso
        )
    );
  }

  statements.push(db.prepare('DELETE FROM liturgy_steps'));
  const liturgySteps = Array.isArray(body.liturgySteps) ? body.liturgySteps.slice(0, 40) : [];
  for (const [idx, item] of liturgySteps.entries()) {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const L = FIELD_LIMITS.liturgyStep;
    const liturgyType = obj.liturgyType === 'communion' ? 'communion' : 'standard';
    statements.push(
      db
        .prepare(
          'INSERT INTO liturgy_steps (id, liturgy_type, time, step, scripture_or_hymn, leader, note, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          validateSafeDocId(obj.id, 'ls'),
          liturgyType,
          clampStr(obj.time, L.time),
          clampStr(obj.step, L.step),
          clampStr(obj.scriptureOrHymn, L.scriptureOrHymn),
          clampStr(obj.leader, L.leader),
          clampStr(obj.note, L.note),
          clampSortOrder(obj.sortOrder, idx + 1),
          nowIso
        )
    );
  }

  statements.push(db.prepare('DELETE FROM ministry_roster'));
  const ministryRoster = Array.isArray(body.ministryRoster)
    ? body.ministryRoster.slice(0, 80)
    : [];
  for (const [idx, item] of ministryRoster.entries()) {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const L = FIELD_LIMITS.ministryRoster;
    const cat = ['choir', 'small-group', 'youth', 'sunday-school'].includes(
      String(obj.category)
    )
      ? String(obj.category)
      : 'choir';
    const coverImage = sanitizeImageRef(obj.image, L.image);
    const galleryImages = sanitizeMinistryGallery(
      obj.galleryImages,
      coverImage,
      L.galleryMaxCount,
      L.image
    );
    statements.push(
      db
        .prepare(
          'INSERT INTO ministry_roster (id, category, title, image, gallery_json, schedule, description, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          validateSafeDocId(obj.id, 'roster'),
          cat,
          clampStr(obj.title, L.title),
          coverImage,
          JSON.stringify(galleryImages),
          clampStr(obj.schedule, L.schedule),
          clampStr(obj.description, L.description),
          clampSortOrder(obj.sortOrder, idx + 1),
          nowIso
        )
    );
  }

  statements.push(db.prepare('DELETE FROM weekday_ministries'));
  const weekdayMinistries = Array.isArray(body.weekdayMinistries)
    ? body.weekdayMinistries.slice(0, 30)
    : [];
  for (const [idx, item] of weekdayMinistries.entries()) {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const L = FIELD_LIMITS.weekdayMinistry;
    statements.push(
      db
        .prepare(
          'INSERT INTO weekday_ministries (id, day, time, title, location, leader, description, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          validateSafeDocId(obj.id, 'wm'),
          clampStr(obj.day, L.day),
          clampStr(obj.time, L.time),
          clampStr(obj.title, L.title),
          clampStr(obj.location, L.location),
          clampStr(obj.leader, L.leader),
          clampStr(obj.description, L.description),
          clampSortOrder(obj.sortOrder, idx + 1),
          nowIso
        )
    );
  }

  statements.push(db.prepare('DELETE FROM announcements'));
  const announcements = Array.isArray(body.announcements) ? body.announcements.slice(0, 50) : [];
  for (const [idx, item] of announcements.entries()) {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const L = FIELD_LIMITS.announcement;
    const category = obj.category === '家事注意' ? '家事注意' : '特别聚会';
    const details = Array.isArray(obj.details)
      ? obj.details
          .slice(0, L.detailsMaxCount)
          .map((d) => clampStr(d, L.detailLen))
          .filter(Boolean)
      : [];
    statements.push(
      db
        .prepare(
          'INSERT INTO announcements (id, category, date, title, summary, time, location, contact, image, is_featured, details_json, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          validateSafeDocId(obj.id, 'ann'),
          category,
          clampStr(obj.date, L.date),
          clampStr(obj.title, L.title),
          clampStr(obj.summary, L.summary),
          clampStr(obj.time, L.time),
          clampStr(obj.location, L.location),
          clampStr(obj.contact, L.contact),
          sanitizeImageRef(obj.image, L.image),
          obj.isFeatured ? 1 : 0,
          JSON.stringify(details),
          clampSortOrder(obj.sortOrder, idx + 1),
          nowIso
        )
    );
  }

  await db.batch(statements);
  const rebuilt = await rebuildPublicSnapshot(db);
  return jsonResponse({
    ok: true,
    bundle: rebuilt?.bundle ?? null,
    version: rebuilt?.version ?? Date.now(),
    updatedAt: rebuilt?.updatedAt ?? nowIso,
  });
}

export async function handleSaveChurchInfo(
  db: SqlDb,
  body: Record<string, unknown>
): Promise<Response> {
  const prevRow = await db
    .prepare('SELECT payload FROM church_info WHERE id = ? LIMIT 1')
    .bind('info')
    .first<{ payload: string }>();

  let prevImages: string[] = [];
  if (prevRow) {
    try {
      const prev = JSON.parse(prevRow.payload) as Record<string, unknown>;
      prevImages = [
        String(prev.heroImage ?? ''),
        String(prev.fellowshipImage ?? ''),
        String(prev.churchTeamImage ?? ''),
      ];
    } catch {
      prevImages = [];
    }
  }

  const cleaned = sanitizeChurchInfoPayload(body);
  const nowIso = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO church_info (id, payload, updated_at)
       VALUES ('info', ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
    )
    .bind(JSON.stringify(cleaned), nowIso)
    .run();

  const rebuilt = await rebuildPublicSnapshot(db);
  await cleanupOrphanedMediaKeys(db, prevImages);

  return jsonResponse({
    ok: true,
    churchInfo: cleaned,
    version: rebuilt?.version ?? Date.now(),
    updatedAt: rebuilt?.updatedAt ?? nowIso,
  });
}

export async function handleUpsertCollectionItem(
  db: SqlDb,
  collectionName: string,
  rawItem: Record<string, unknown>
): Promise<Response> {
  if (!VALID_COLLECTIONS.has(collectionName)) {
    return jsonResponse({ ok: false, error: '无效的数据集合名称。' }, 400);
  }

  const nowIso = new Date().toISOString();
  let oldImage: string | undefined;

  if (collectionName === 'coworkers') {
    const L = FIELD_LIMITS.coworker;
    const id = validateSafeDocId(rawItem.id, 'cw');
    const prev = await db
      .prepare('SELECT image FROM coworkers WHERE id = ? LIMIT 1')
      .bind(id)
      .first<{ image: string }>();
    oldImage = prev?.image;
    const image = sanitizeImageRef(rawItem.image, L.image);
    await db
      .prepare(
        `INSERT INTO coworkers (id, name, title, image, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, title = excluded.title, image = excluded.image,
           sort_order = excluded.sort_order, updated_at = excluded.updated_at`
      )
      .bind(
        id,
        clampStr(rawItem.name, L.name),
        clampStr(rawItem.title, L.title),
        image,
        clampSortOrder(rawItem.sortOrder, 0),
        nowIso
      )
      .run();
  } else if (collectionName === 'worship_times') {
    const L = FIELD_LIMITS.worshipTime;
    const id = validateSafeDocId(rawItem.id, 'wt');
    await db
      .prepare(
        `INSERT INTO worship_times (id, time, title, place, desc, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           time = excluded.time, title = excluded.title, place = excluded.place,
           desc = excluded.desc, sort_order = excluded.sort_order, updated_at = excluded.updated_at`
      )
      .bind(
        id,
        clampStr(rawItem.time, L.time),
        clampStr(rawItem.title, L.title),
        clampStr(rawItem.place, L.place),
        clampStr(rawItem.desc, L.desc),
        clampSortOrder(rawItem.sortOrder, 0),
        nowIso
      )
      .run();
  } else if (collectionName === 'liturgy_steps') {
    const L = FIELD_LIMITS.liturgyStep;
    const id = validateSafeDocId(rawItem.id, 'ls');
    const liturgyType = rawItem.liturgyType === 'communion' ? 'communion' : 'standard';
    await db
      .prepare(
        `INSERT INTO liturgy_steps (id, liturgy_type, time, step, scripture_or_hymn, leader, note, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           liturgy_type = excluded.liturgy_type, time = excluded.time, step = excluded.step,
           scripture_or_hymn = excluded.scripture_or_hymn, leader = excluded.leader,
           note = excluded.note, sort_order = excluded.sort_order, updated_at = excluded.updated_at`
      )
      .bind(
        id,
        liturgyType,
        clampStr(rawItem.time, L.time),
        clampStr(rawItem.step, L.step),
        clampStr(rawItem.scriptureOrHymn, L.scriptureOrHymn),
        clampStr(rawItem.leader, L.leader),
        clampStr(rawItem.note, L.note),
        clampSortOrder(rawItem.sortOrder, 0),
        nowIso
      )
      .run();
  } else if (collectionName === 'ministry_roster') {
    const L = FIELD_LIMITS.ministryRoster;
    const id = validateSafeDocId(rawItem.id, 'roster');
    const prev = await db
      .prepare('SELECT image, gallery_json FROM ministry_roster WHERE id = ? LIMIT 1')
      .bind(id)
      .first<{ image: string; gallery_json: string }>();
    const prevGallery = parseMinistryGalleryJson(prev?.gallery_json, prev?.image ?? '');
    const oldMediaCandidates = [prev?.image, ...prevGallery].filter(Boolean) as string[];
    const cat = ['choir', 'small-group', 'youth', 'sunday-school'].includes(
      String(rawItem.category)
    )
      ? String(rawItem.category)
      : 'choir';
    const image = sanitizeImageRef(rawItem.image, L.image);
    const galleryImages = sanitizeMinistryGallery(
      rawItem.galleryImages,
      image,
      L.galleryMaxCount,
      L.image
    );
    await db
      .prepare(
        `INSERT INTO ministry_roster (id, category, title, image, gallery_json, schedule, description, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           category = excluded.category, title = excluded.title, image = excluded.image,
           gallery_json = excluded.gallery_json, schedule = excluded.schedule,
           description = excluded.description, sort_order = excluded.sort_order, updated_at = excluded.updated_at`
      )
      .bind(
        id,
        cat,
        clampStr(rawItem.title, L.title),
        image,
        JSON.stringify(galleryImages),
        clampStr(rawItem.schedule, L.schedule),
        clampStr(rawItem.description, L.description),
        clampSortOrder(rawItem.sortOrder, 0),
        nowIso
      )
      .run();

    const rebuilt = await rebuildPublicSnapshot(db);
    if (oldMediaCandidates.length > 0) {
      await cleanupOrphanedMediaKeys(db, oldMediaCandidates);
    }

    return jsonResponse({
      ok: true,
      bundle: rebuilt?.bundle ?? null,
      version: rebuilt?.version ?? Date.now(),
      updatedAt: rebuilt?.updatedAt ?? nowIso,
    });
  } else if (collectionName === 'weekday_ministries') {
    const L = FIELD_LIMITS.weekdayMinistry;
    const id = validateSafeDocId(rawItem.id, 'wm');
    await db
      .prepare(
        `INSERT INTO weekday_ministries (id, day, time, title, location, leader, description, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           day = excluded.day, time = excluded.time, title = excluded.title,
           location = excluded.location, leader = excluded.leader, description = excluded.description,
           sort_order = excluded.sort_order, updated_at = excluded.updated_at`
      )
      .bind(
        id,
        clampStr(rawItem.day, L.day),
        clampStr(rawItem.time, L.time),
        clampStr(rawItem.title, L.title),
        clampStr(rawItem.location, L.location),
        clampStr(rawItem.leader, L.leader),
        clampStr(rawItem.description, L.description),
        clampSortOrder(rawItem.sortOrder, 0),
        nowIso
      )
      .run();
  } else if (collectionName === 'announcements') {
    const L = FIELD_LIMITS.announcement;
    const id = validateSafeDocId(rawItem.id, 'ann');
    const prev = await db
      .prepare('SELECT image FROM announcements WHERE id = ? LIMIT 1')
      .bind(id)
      .first<{ image: string }>();
    oldImage = prev?.image;
    const category = rawItem.category === '家事注意' ? '家事注意' : '特别聚会';
    const image = sanitizeImageRef(rawItem.image, L.image);
    const details = Array.isArray(rawItem.details)
      ? rawItem.details
          .slice(0, L.detailsMaxCount)
          .map((d) => clampStr(d, L.detailLen))
          .filter(Boolean)
      : [];
    await db
      .prepare(
        `INSERT INTO announcements (id, category, date, title, summary, time, location, contact, image, is_featured, details_json, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           category = excluded.category, date = excluded.date, title = excluded.title,
           summary = excluded.summary, time = excluded.time, location = excluded.location,
           contact = excluded.contact, image = excluded.image, is_featured = excluded.is_featured,
           details_json = excluded.details_json, sort_order = excluded.sort_order, updated_at = excluded.updated_at`
      )
      .bind(
        id,
        category,
        clampStr(rawItem.date, L.date),
        clampStr(rawItem.title, L.title),
        clampStr(rawItem.summary, L.summary),
        clampStr(rawItem.time, L.time),
        clampStr(rawItem.location, L.location),
        clampStr(rawItem.contact, L.contact),
        image,
        rawItem.isFeatured ? 1 : 0,
        JSON.stringify(details),
        clampSortOrder(rawItem.sortOrder, 0),
        nowIso
      )
      .run();
  }

  const rebuilt = await rebuildPublicSnapshot(db);
  if (oldImage) {
    await cleanupOrphanedMediaKeys(db, [oldImage]);
  }

  return jsonResponse({
    ok: true,
    bundle: rebuilt?.bundle ?? null,
    version: rebuilt?.version ?? Date.now(),
    updatedAt: rebuilt?.updatedAt ?? nowIso,
  });
}

const DELETE_BY_COLLECTION_SQL: Record<string, string> = {
  coworkers: 'DELETE FROM coworkers WHERE id = ?',
  worship_times: 'DELETE FROM worship_times WHERE id = ?',
  liturgy_steps: 'DELETE FROM liturgy_steps WHERE id = ?',
  ministry_roster: 'DELETE FROM ministry_roster WHERE id = ?',
  weekday_ministries: 'DELETE FROM weekday_ministries WHERE id = ?',
  announcements: 'DELETE FROM announcements WHERE id = ?',
};

const SELECT_IMAGE_BY_COLLECTION_SQL: Record<string, string> = {
  coworkers: 'SELECT image FROM coworkers WHERE id = ? LIMIT 1',
  ministry_roster: 'SELECT image FROM ministry_roster WHERE id = ? LIMIT 1',
  announcements: 'SELECT image FROM announcements WHERE id = ? LIMIT 1',
};

export async function handleDeleteCollectionItem(
  db: SqlDb,
  collectionName: string,
  id: string
): Promise<Response> {
  const deleteSql = DELETE_BY_COLLECTION_SQL[collectionName];
  if (!deleteSql) {
    return jsonResponse({ ok: false, error: '无效的数据集合名称。' }, 400);
  }
  const cleanId = id.trim();
  if (!cleanId) {
    return jsonResponse({ ok: false, error: '缺少记录 ID。' }, 400);
  }

  const oldMediaCandidates: string[] = [];
  if (collectionName === 'ministry_roster') {
    const row = await db
      .prepare('SELECT image, gallery_json FROM ministry_roster WHERE id = ? LIMIT 1')
      .bind(cleanId)
      .first<{ image: string; gallery_json: string }>();
    if (row?.image) oldMediaCandidates.push(row.image);
    if (row?.gallery_json) {
      oldMediaCandidates.push(...parseMinistryGalleryJson(row.gallery_json, row.image));
    }
  } else {
    const selectImageSql = SELECT_IMAGE_BY_COLLECTION_SQL[collectionName];
    if (selectImageSql) {
      const row = await db
        .prepare(selectImageSql)
        .bind(cleanId)
        .first<{ image: string }>();
      if (row?.image) oldMediaCandidates.push(row.image);
    }
  }

  await db.prepare(deleteSql).bind(cleanId).run();
  const rebuilt = await rebuildPublicSnapshot(db);
  if (oldMediaCandidates.length > 0) {
    await cleanupOrphanedMediaKeys(db, oldMediaCandidates);
  }

  return jsonResponse({
    ok: true,
    bundle: rebuilt?.bundle ?? null,
    version: rebuilt?.version ?? Date.now(),
    updatedAt: rebuilt?.updatedAt ?? new Date().toISOString(),
  });
}

export async function handleUpdateVisitorRequest(
  db: SqlDb,
  id: string,
  body: Record<string, unknown>
): Promise<Response> {
  const cleanId = id.trim();
  const status = String(body.status ?? '');
  if (!cleanId || !['pending', 'contacted', 'archived'].includes(status)) {
    return jsonResponse({ ok: false, error: '无效的跟进状态参数。' }, 400);
  }
  const adminNote = clampStr(body.adminNote, FIELD_LIMITS.visitorRequest.adminNote);
  const nowIso = new Date().toISOString();

  await db
    .prepare(
      'UPDATE visitor_requests SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?'
    )
    .bind(status, adminNote, nowIso, cleanId)
    .run();

  return jsonResponse({ ok: true });
}

export async function handleDeleteVisitorRequest(db: SqlDb, id: string): Promise<Response> {
  const cleanId = id.trim();
  if (!cleanId) {
    return jsonResponse({ ok: false, error: '缺少记录 ID。' }, 400);
  }
  await db.prepare('DELETE FROM visitor_requests WHERE id = ?').bind(cleanId).run();
  return jsonResponse({ ok: true });
}

export async function handleListAdmins(db: SqlDb): Promise<Response> {
  const rows = await db
    .prepare(
      'SELECT uid, email, display_name, can_view_visitor_stats, added_at FROM admins ORDER BY added_at DESC LIMIT 100'
    )
    .all<{
      uid: string;
      email: string;
      display_name: string;
      can_view_visitor_stats: number;
      added_at: string;
    }>();

  return jsonResponse({
    admins: rows.results.map((r) => ({
      uid: r.uid,
      email: r.email,
      displayName: r.display_name,
      canViewVisitorStats: Number(r.can_view_visitor_stats) === 1,
      addedAt: r.added_at,
    })),
  });
}

export async function handleUpsertAdmin(
  db: SqlDb,
  body: Record<string, unknown>
): Promise<Response> {
  const L = FIELD_LIMITS.adminUser;
  const uid = clampStr(body.uid, L.uid);
  const email = clampStr(body.email, L.email);
  const displayName = clampStr(body.displayName, L.displayName);
  const canViewVisitorStats = body.canViewVisitorStats === true ? 1 : 0;

  if (!/^[a-zA-Z0-9_-]+$/.test(uid)) {
    return jsonResponse(
      { ok: false, error: '管理员 UID 格式无效（仅支持字母、数字、下划线或连字符）。' },
      400
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonResponse({ ok: false, error: '请输入有效的同工邮箱地址。' }, 400);
  }
  if (!displayName) {
    return jsonResponse({ ok: false, error: '请填写同工称呼。' }, 400);
  }

  const nowIso = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO admins (uid, email, display_name, can_view_visitor_stats, added_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         can_view_visitor_stats = excluded.can_view_visitor_stats`
    )
    .bind(uid, email, displayName, canViewVisitorStats, nowIso)
    .run();

  return jsonResponse({
    ok: true,
    admin: {
      uid,
      email,
      displayName,
      canViewVisitorStats: canViewVisitorStats === 1,
      addedAt: nowIso,
    },
  });
}

export async function handleUpdateAdminStatsPerm(
  db: SqlDb,
  uid: string,
  body: Record<string, unknown>
): Promise<Response> {
  const cleanUid = uid.trim();
  if (!cleanUid) {
    return jsonResponse({ ok: false, error: '缺少用户 UID。' }, 400);
  }
  const canView = body.canViewVisitorStats === true ? 1 : 0;
  await db
    .prepare('UPDATE admins SET can_view_visitor_stats = ? WHERE uid = ?')
    .bind(canView, cleanUid)
    .run();
  return jsonResponse({ ok: true });
}

export async function handleDeleteAdmin(
  db: SqlDb,
  actorUid: string,
  targetUid: string
): Promise<Response> {
  const cleanUid = targetUid.trim();
  if (!cleanUid) {
    return jsonResponse({ ok: false, error: '缺少用户 UID。' }, 400);
  }
  if (cleanUid === actorUid) {
    return jsonResponse(
      { ok: false, error: '为防止误锁定，无法在此撤销当前登录账号自身的权限。' },
      400
    );
  }
  await db.prepare('DELETE FROM admins WHERE uid = ?').bind(cleanUid).run();
  return jsonResponse({ ok: true });
}

export async function handleGetVisitorStats(db: SqlDb): Promise<Response> {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();
  const sevenDaysIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [statRow, countsRow, regionRows, recentRows] = await Promise.all([
    db
      .prepare('SELECT total_visitors, last_visitor_id, updated_at FROM site_stats WHERE id = ? LIMIT 1')
      .bind('visitor_counter')
      .first<{ total_visitors: number; last_visitor_id: string; updated_at: string }>(),
    db
      .prepare(
        `SELECT
           COUNT(*) AS totalRecords,
           COALESCE(SUM(CASE WHEN counted_at >= ? THEN 1 ELSE 0 END), 0) AS todayCount,
           COALESCE(SUM(CASE WHEN counted_at >= ? THEN 1 ELSE 0 END), 0) AS weekCount,
           COALESCE(SUM(CASE WHEN counted_at >= ? THEN 1 ELSE 0 END), 0) AS monthCount
         FROM visitor_ips`
      )
      .bind(todayIso, sevenDaysIso, thirtyDaysIso)
      .first<{
        totalRecords: number;
        todayCount: number;
        weekCount: number;
        monthCount: number;
      }>(),
    db
      .prepare(
        `SELECT country, region, COUNT(*) AS count, MAX(counted_at) AS latestAt
         FROM visitor_ips
         GROUP BY country, region
         ORDER BY count DESC, latestAt DESC
         LIMIT 200`
      )
      .all<{ country: string; region: string; count: number; latestAt: string }>(),
    db
      .prepare(
        'SELECT ip_hash, country, region, counted_at FROM visitor_ips ORDER BY counted_at DESC LIMIT 200'
      )
      .all<{ ip_hash: string; country: string; region: string; counted_at: string }>(),
  ]);

  const stats = statRow
    ? {
        totalVisitors: Number(statRow.total_visitors),
        lastVisitorId: statRow.last_visitor_id,
        updatedAt: statRow.updated_at,
      }
    : null;

  const ipRecords = recentRows.results.map((r) => ({
    id: r.ip_hash,
    country: r.country,
    region: r.region,
    countedAt: r.counted_at,
  }));

  const aggregates = {
    totalRecords: Number(countsRow?.totalRecords ?? ipRecords.length),
    todayCount: Number(countsRow?.todayCount ?? 0),
    weekCount: Number(countsRow?.weekCount ?? 0),
    monthCount: Number(countsRow?.monthCount ?? 0),
    regionBreakdown: regionRows.results.map((r) => ({
      country: r.country,
      region: r.region,
      count: Number(r.count),
      latestAt: r.latestAt,
    })),
  };

  return jsonResponse({
    stats,
    ipRecords,
    aggregates,
  });
}

export async function handleImportLegacyData(
  db: SqlDb,
  body: Record<string, unknown>
): Promise<Response> {
  const nowIso = new Date().toISOString();

  if (body.content && typeof body.content === 'object' && !Array.isArray(body.content)) {
    const syncRes = await handleSyncAll(db, body.content as Record<string, unknown>);
    if (!syncRes.ok) return syncRes;
  }

  const statements: SqlPreparedStatement[] = [];

  if (Array.isArray(body.admins)) {
    for (const raw of body.admins.slice(0, 100)) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const uid = clampStr(obj.uid, FIELD_LIMITS.adminUser.uid);
      const email = clampStr(obj.email, FIELD_LIMITS.adminUser.email);
      const displayName = clampStr(obj.displayName, FIELD_LIMITS.adminUser.displayName);
      if (!uid || !email || !displayName) continue;
      statements.push(
        db
          .prepare(
            `INSERT INTO admins (uid, email, display_name, can_view_visitor_stats, added_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(uid) DO UPDATE SET
               email = excluded.email,
               display_name = excluded.display_name,
               can_view_visitor_stats = excluded.can_view_visitor_stats`
          )
          .bind(
            uid,
            email,
            displayName,
            obj.canViewVisitorStats === true ? 1 : 0,
            typeof obj.addedAt === 'string' && obj.addedAt ? obj.addedAt : nowIso
          )
      );
    }
  }

  if (Array.isArray(body.visitorRequests)) {
    for (const raw of body.visitorRequests.slice(0, 300)) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const id = validateSafeDocId(obj.id, 'vr');
      const name = sanitizeSingleLine(obj.name, FIELD_LIMITS.visitorRequest.name);
      const contact = sanitizeSingleLine(obj.contact, FIELD_LIMITS.visitorRequest.contact);
      if (!name || !contact) continue;
      const status =
        obj.status === 'contacted' || obj.status === 'archived' ? obj.status : 'pending';
      statements.push(
        db
          .prepare(
            `INSERT INTO visitor_requests (id, name, contact, intent, message, status, admin_note, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               status = excluded.status,
               admin_note = excluded.admin_note`
          )
          .bind(
            id,
            name,
            contact,
            sanitizeSingleLine(obj.intent, FIELD_LIMITS.visitorRequest.intent),
            sanitizeMultiline(obj.message, FIELD_LIMITS.visitorRequest.message),
            status,
            clampStr(obj.adminNote, FIELD_LIMITS.visitorRequest.adminNote),
            typeof obj.createdAt === 'string' && obj.createdAt ? obj.createdAt : nowIso,
            nowIso
          )
      );
    }
  }

  if (Array.isArray(body.visitorIps)) {
    for (const raw of body.visitorIps.slice(0, 2000)) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const ipHash = String(obj.id ?? '').trim();
      if (!/^[a-f0-9]{64}$/.test(ipHash)) continue;
      const countedAt =
        typeof obj.countedAt === 'string' && obj.countedAt ? obj.countedAt : nowIso;
      statements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO visitor_ips (ip_hash, country, region, counted_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(
            ipHash,
            clampStr(obj.country, 80),
            clampStr(obj.region, 100),
            countedAt,
            nowIso
          )
      );
    }
  }

  if (body.visitorCounter && typeof body.visitorCounter === 'object') {
    const vc = body.visitorCounter as Record<string, unknown>;
    const total = Number(vc.totalVisitors ?? 0);
    if (Number.isFinite(total) && total >= 1) {
      statements.push(
        db
          .prepare(
            `INSERT INTO site_stats (id, total_visitors, last_visitor_id, updated_at)
             VALUES ('visitor_counter', ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               total_visitors = MAX(site_stats.total_visitors, excluded.total_visitors),
               last_visitor_id = excluded.last_visitor_id,
               updated_at = excluded.updated_at`
          )
          .bind(
            Math.floor(total),
            String(vc.lastVisitorId ?? '').slice(0, 64),
            typeof vc.updatedAt === 'string' && vc.updatedAt ? vc.updatedAt : nowIso
          )
      );
    }
  }

  if (statements.length > 0) {
    for (let i = 0; i < statements.length; i += 80) {
      await db.batch(statements.slice(i, i + 80));
    }
  }

  return jsonResponse({
    ok: true,
    importedAdmins: Array.isArray(body.admins) ? body.admins.length : 0,
    importedRequests: Array.isArray(body.visitorRequests) ? body.visitorRequests.length : 0,
    importedIps: Array.isArray(body.visitorIps) ? body.visitorIps.length : 0,
  });
}
