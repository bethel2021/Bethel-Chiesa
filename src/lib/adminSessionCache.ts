import type {
  AdminUserItem,
  VisitorIpRecord,
  VisitorRequestItem,
  VisitorStatsSummary,
} from '../data/churchData';

const REQUESTS_CACHE_KEY = 'bethel_admin_requests_cache_v1';
const USERS_CACHE_KEY = 'bethel_admin_users_cache_v1';
const COUNTER_CACHE_KEY = 'bethel_admin_counter_cache_v1';
const STATS_CACHE_KEY = 'bethel_admin_visitor_stats_cache_v1';

export const ADMIN_SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const ADMIN_STATS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface TimedEnvelope<T> {
  uid: string;
  cachedAt: number;
  data: T;
}

function readEnvelope<T>(key: string, uid: string | null | undefined, ttlMs: number): T | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TimedEnvelope<T>>;
    if (
      !parsed ||
      parsed.uid !== uid ||
      typeof parsed.cachedAt !== 'number' ||
      Date.now() - parsed.cachedAt >= ttlMs ||
      parsed.data === undefined
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeEnvelope<T>(key: string, uid: string | null | undefined, data: T): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const payload: TimedEnvelope<T> = {
      uid,
      cachedAt: Date.now(),
      data,
    };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore sessionStorage quota/privacy errors
  }
}

export function clearAllAdminSessionCaches(): void {
  if (typeof window === 'undefined') return;
  for (const key of [REQUESTS_CACHE_KEY, USERS_CACHE_KEY, COUNTER_CACHE_KEY, STATS_CACHE_KEY]) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
}

export function readCachedVisitorRequests(uid: string | null | undefined): VisitorRequestItem[] | null {
  return readEnvelope<VisitorRequestItem[]>(REQUESTS_CACHE_KEY, uid, ADMIN_SESSION_CACHE_TTL_MS);
}

export function writeCachedVisitorRequests(
  uid: string | null | undefined,
  items: VisitorRequestItem[]
): void {
  writeEnvelope(REQUESTS_CACHE_KEY, uid, items);
}

export function readCachedAdminUsers(uid: string | null | undefined): AdminUserItem[] | null {
  return readEnvelope<AdminUserItem[]>(USERS_CACHE_KEY, uid, ADMIN_SESSION_CACHE_TTL_MS);
}

export function writeCachedAdminUsers(
  uid: string | null | undefined,
  items: AdminUserItem[]
): void {
  writeEnvelope(USERS_CACHE_KEY, uid, items);
}

export function readCachedVisitorCounter(
  uid: string | null | undefined
): VisitorStatsSummary | null | undefined {
  return readEnvelope<VisitorStatsSummary | null>(COUNTER_CACHE_KEY, uid, ADMIN_SESSION_CACHE_TTL_MS);
}

export function writeCachedVisitorCounter(
  uid: string | null | undefined,
  summary: VisitorStatsSummary | null
): void {
  writeEnvelope(COUNTER_CACHE_KEY, uid, summary);
}

export interface CachedVisitorStatsBundle {
  stats: VisitorStatsSummary | null;
  ipRecords: VisitorIpRecord[];
}

export function readCachedVisitorStatsBundle(
  uid: string | null | undefined
): CachedVisitorStatsBundle | null {
  return readEnvelope<CachedVisitorStatsBundle>(STATS_CACHE_KEY, uid, ADMIN_STATS_CACHE_TTL_MS);
}

export function writeCachedVisitorStatsBundle(
  uid: string | null | undefined,
  bundle: CachedVisitorStatsBundle
): void {
  writeEnvelope(STATS_CACHE_KEY, uid, bundle);
}
