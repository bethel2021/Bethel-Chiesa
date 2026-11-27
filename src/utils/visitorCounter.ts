const LOCAL_VISITOR_TOTAL_CACHE_KEY = 'bethel_visitor_total_cache_v2';
const VISITOR_TOTAL_CACHE_TTL_MS = 30 * 60 * 1000;

let inflightCounterPromise: Promise<number | null> | null = null;

interface CachedVisitorTotal {
  total: number;
  cachedAt: number;
}

function readCachedVisitorTotal(allowStale = false): number | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_VISITOR_TOTAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedVisitorTotal>;
    if (
      typeof parsed.total !== 'number' ||
      !Number.isFinite(parsed.total) ||
      parsed.total < 1 ||
      typeof parsed.cachedAt !== 'number'
    ) {
      return null;
    }
    if (!allowStale && Date.now() - parsed.cachedAt >= VISITOR_TOTAL_CACHE_TTL_MS) {
      return null;
    }
    return Math.floor(parsed.total);
  } catch {
    return null;
  }
}

function writeCachedVisitorTotal(total: number): void {
  if (!Number.isFinite(total) || total < 1) return;
  try {
    const payload: CachedVisitorTotal = {
      total: Math.floor(total),
      cachedAt: Date.now(),
    };
    window.localStorage.setItem(LOCAL_VISITOR_TOTAL_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

async function executeTrackUniqueVisitor(): Promise<number | null> {
  const cachedFresh = readCachedVisitorTotal(false);
  if (cachedFresh !== null) {
    return cachedFresh;
  }

  try {
    const res = await fetch('/api/visitor-track', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return readCachedVisitorTotal(true);
    }
    const json = (await res.json()) as { totalVisitors?: unknown };
    if (
      typeof json.totalVisitors === 'number' &&
      Number.isFinite(json.totalVisitors) &&
      json.totalVisitors >= 1
    ) {
      const val = Math.floor(json.totalVisitors);
      writeCachedVisitorTotal(val);
      return val;
    }
    return readCachedVisitorTotal(true);
  } catch {
    return readCachedVisitorTotal(true);
  }
}

export function trackUniqueVisitor(): Promise<number | null> {
  if (!inflightCounterPromise) {
    inflightCounterPromise = executeTrackUniqueVisitor().catch(() => readCachedVisitorTotal(true));
  }
  return inflightCounterPromise;
}
