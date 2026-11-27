import {
  doc,
  getDoc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, isFirestoreQuotaError } from '../lib/firebase';

const VISITOR_HASH_DOMAIN = 'bethel-church-visitor-counter-v1';
const LOCAL_GEO_RECORDED_KEY = 'bethel_visitor_geo_recorded_v2';
const LOCAL_VISITOR_TOTAL_CACHE_KEY = 'bethel_visitor_total_cache_v1';
const VISITOR_TOTAL_CACHE_TTL_MS = 30 * 60 * 1000;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;

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

interface ResolvedVisitorIdentity {
  ipHash: string;
  country: string;
  region: string;
}

function isValidSha256Hex(val: unknown): val is string {
  return typeof val === 'string' && SHA256_HEX_RE.test(val);
}

function clampGeoField(val: unknown, maxLen: number, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const cleaned = val.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
  return cleaned || fallback;
}

function isResolvedCountry(country: string | undefined): boolean {
  const clean = typeof country === 'string' ? country.trim() : '';
  return Boolean(clean && clean !== '未知国家/地区');
}

async function sha256HexClient(input: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function resolveVisitorIdentity(): Promise<ResolvedVisitorIdentity | null> {
  // 1. Primary: server-side Express or Cloudflare Pages Function endpoint (/api/client-ip)
  try {
    const res = await fetch('/api/client-ip', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as {
          ipHash?: unknown;
          country?: unknown;
          region?: unknown;
        };
        if (isValidSha256Hex(json.ipHash)) {
          return {
            ipHash: json.ipHash,
            country: clampGeoField(json.country, 80, '未知国家/地区'),
            region: clampGeoField(json.region, 100, '未知省份/州'),
          };
        }
      }
    }
  } catch {
    // Fall through to CDN / public IP fallback
  }

  // 2. Fallback: Cloudflare trace endpoint (when served behind Cloudflare without Functions)
  try {
    const res = await fetch('/cdn-cgi/trace', { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const ipMatch = text.match(/^ip=(.+)$/m);
      const locMatch = text.match(/^loc=(.+)$/m);
      const ip = ipMatch?.[1]?.trim().toLowerCase();
      if (ip && ip.length <= 64) {
        const ipHash = await sha256HexClient(`${VISITOR_HASH_DOMAIN}:${ip}`);
        if (ipHash) {
          return {
            ipHash,
            country: clampGeoField(locMatch?.[1], 80, '未知国家/地区'),
            region: '未知省份/州',
          };
        }
      }
    }
  } catch {
    // Fall through
  }

  // 3. Fallback: Public IP & GeoIP lookup
  try {
    const res = await fetch('https://ipwho.is/?lang=zh-CN', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        success?: boolean;
        ip?: unknown;
        country?: unknown;
        region?: unknown;
      };
      if (
        json.success !== false &&
        typeof json.ip === 'string' &&
        json.ip.trim().length > 0 &&
        json.ip.trim().length <= 64
      ) {
        const ipHash = await sha256HexClient(`${VISITOR_HASH_DOMAIN}:${json.ip.trim().toLowerCase()}`);
        if (ipHash) {
          return {
            ipHash,
            country: clampGeoField(json.country, 80, '未知国家/地区'),
            region: clampGeoField(json.region, 100, '未知省份/州'),
          };
        }
      }
    }
  } catch {
    // Ignore fallback failure
  }

  return null;
}

async function readCurrentVisitorTotal(): Promise<number | null> {
  const cachedFresh = readCachedVisitorTotal(false);
  if (cachedFresh !== null) {
    return cachedFresh;
  }

  const counterRef = doc(db, 'site_stats', 'visitor_counter');
  try {
    const snap = await getDocFromServer(counterRef);
    if (snap.exists()) {
      const raw = snap.data()?.totalVisitors;
      if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
        const val = Math.floor(raw);
        writeCachedVisitorTotal(val);
        return val;
      }
    }
    return readCachedVisitorTotal(true);
  } catch {
    try {
      const snap = await getDoc(counterRef);
      if (snap.exists()) {
        const raw = snap.data()?.totalVisitors;
        if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
          const val = Math.floor(raw);
          writeCachedVisitorTotal(val);
          return val;
        }
      }
    } catch {
      // Ignore cache read error
    }
    return readCachedVisitorTotal(true);
  }
}

function isGeoRecordedForIp(ipHash: string): boolean {
  try {
    return window.localStorage.getItem(LOCAL_GEO_RECORDED_KEY) === ipHash;
  } catch {
    return false;
  }
}

function hasAnyGeoRecorded(): boolean {
  try {
    const val = window.localStorage.getItem(LOCAL_GEO_RECORDED_KEY);
    return Boolean(val && SHA256_HEX_RE.test(val));
  } catch {
    return false;
  }
}

function markGeoRecordedForIp(ipHash: string): void {
  try {
    window.localStorage.setItem(LOCAL_GEO_RECORDED_KEY, ipHash);
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

async function executeTrackUniqueVisitor(): Promise<number | null> {
  // Zero-network fast path when this browser already recorded an IP and cached total is fresh
  const cachedFresh = readCachedVisitorTotal(false);
  if (cachedFresh !== null && hasAnyGeoRecorded()) {
    return cachedFresh;
  }

  const identity = await resolveVisitorIdentity();
  if (!identity) {
    return await readCurrentVisitorTotal();
  }

  const { ipHash, country, region } = identity;

  // Fast path: this browser already recorded this IP hash WITH valid geolocation
  if (isGeoRecordedForIp(ipHash)) {
    const current = await readCurrentVisitorTotal();
    if (current !== null) return current;
  }

  const ipRef = doc(db, 'visitor_ips', ipHash);
  const counterRef = doc(db, 'site_stats', 'visitor_counter');

  try {
    const ipSnap = await getDocFromServer(ipRef);
    if (ipSnap.exists()) {
      const existingCountry = ipSnap.data()?.country as string | undefined;
      if (!isResolvedCountry(existingCountry) && isResolvedCountry(country)) {
        try {
          await updateDoc(ipRef, { country, region });
          markGeoRecordedForIp(ipHash);
        } catch {
          // Best-effort geolocation backfill
        }
      } else if (isResolvedCountry(existingCountry)) {
        markGeoRecordedForIp(ipHash);
      }
      return await readCurrentVisitorTotal();
    }
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      return readCachedVisitorTotal(true);
    }
    // Continue to atomic transaction which checks ipRef authoritatively
  }

  try {
    const totalVisitors = await runTransaction(db, async (tx) => {
      const [counterSnap, txIpSnap] = await Promise.all([
        tx.get(counterRef),
        tx.get(ipRef),
      ]);

      const existingTotal = counterSnap.exists()
        ? Number(counterSnap.data()?.totalVisitors ?? 0)
        : 0;

      if (txIpSnap.exists()) {
        return existingTotal >= 1 ? Math.floor(existingTotal) : null;
      }

      const nextTotal = existingTotal >= 1 ? Math.floor(existingTotal) + 1 : 1;
      tx.set(ipRef, {
        country,
        region,
        countedAt: serverTimestamp(),
      });

      if (counterSnap.exists()) {
        tx.update(counterRef, {
          totalVisitors: nextTotal,
          lastVisitorId: ipHash,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(counterRef, {
          totalVisitors: 1,
          lastVisitorId: ipHash,
          updatedAt: serverTimestamp(),
        });
      }

      return nextTotal;
    });

    if (typeof totalVisitors === 'number' && totalVisitors >= 1) {
      writeCachedVisitorTotal(totalVisitors);
    }
    if (isResolvedCountry(country)) {
      markGeoRecordedForIp(ipHash);
    }
    return totalVisitors;
  } catch {
    // Fallback to read-only counter fetch if offline or quota-exhausted
    return await readCurrentVisitorTotal();
  }
}

export function trackUniqueVisitor(): Promise<number | null> {
  if (!inflightCounterPromise) {
    inflightCounterPromise = executeTrackUniqueVisitor().catch(() => readCachedVisitorTotal(true));
  }
  return inflightCounterPromise;
}
