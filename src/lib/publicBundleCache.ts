import { PUBLIC_CACHE_KEY, PUBLIC_CACHE_TTL_MS } from '../data/cacheConfig';
import type {
  AnnouncementItem,
  ChurchInfo,
  LiturgyStep,
  MinistryRosterItem,
  PulpitCoworker,
  WeekdayMinistry,
  WorshipTimeSlot,
} from '../data/churchData';

export interface PublicBundleData {
  churchInfo: ChurchInfo;
  coworkers: PulpitCoworker[];
  worshipTimes: WorshipTimeSlot[];
  liturgySteps: LiturgyStep[];
  ministryRoster: MinistryRosterItem[];
  weekdayMinistries: WeekdayMinistry[];
  announcements: AnnouncementItem[];
  version: number;
}

export interface CachedBundleEnvelope {
  cachedAt: number;
  hasCloudBundle: boolean;
  bundle: PublicBundleData;
}

export function isCacheFresh(cached: CachedBundleEnvelope | null): cached is CachedBundleEnvelope {
  return Boolean(cached && Date.now() - cached.cachedAt < PUBLIC_CACHE_TTL_MS);
}

export function readLocalBundleCache(): CachedBundleEnvelope | null {
  try {
    const raw = window.localStorage.getItem(PUBLIC_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBundleEnvelope;
    if (!parsed || !parsed.bundle || typeof parsed.cachedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalBundleCache(bundle: PublicBundleData, hasCloudBundle: boolean): number {
  const now = Date.now();
  try {
    const envelope: CachedBundleEnvelope = {
      cachedAt: now,
      hasCloudBundle,
      bundle,
    };
    window.localStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Ignore quota/private-mode storage errors
  }
  return now;
}
