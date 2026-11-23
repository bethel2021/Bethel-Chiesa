import type { PublicBundleData } from '../context/ChurchDataContext';

export type EarlyBundleResult =
  | { status: 'ok'; bundle: PublicBundleData }
  | { status: 'not-found' | 'error' };

export interface EarlyHeroMediaEntry {
  uri: string;
  promise: Promise<string[] | null>;
}

export interface BethelPrefetchBridge {
  bundlePromise?: Promise<EarlyBundleResult>;
  resolvedResult?: EarlyBundleResult;
  heroMedia?: EarlyHeroMediaEntry;
}

declare global {
  interface Window {
    __BETHEL_PREFETCH__?: BethelPrefetchBridge;
  }
}

export function getEarlyPrefetchedBundleSnapshot(): EarlyBundleResult | null {
  if (typeof window === 'undefined') return null;
  return window.__BETHEL_PREFETCH__?.resolvedResult ?? null;
}

export async function awaitEarlyPrefetchedBundle(): Promise<EarlyBundleResult | null> {
  if (typeof window === 'undefined') return null;
  const bridge = window.__BETHEL_PREFETCH__;
  if (!bridge) return null;
  if (bridge.resolvedResult) return bridge.resolvedResult;
  if (!bridge.bundlePromise) return null;
  try {
    return await bridge.bundlePromise;
  } catch {
    return null;
  }
}

export async function consumeEarlyHeroMediaChunks(mediaUri: string): Promise<string[] | null> {
  if (typeof window === 'undefined') return null;
  const entry = window.__BETHEL_PREFETCH__?.heroMedia;
  if (!entry || entry.uri !== mediaUri.trim()) {
    return null;
  }
  try {
    return await entry.promise;
  } catch {
    return null;
  }
}
