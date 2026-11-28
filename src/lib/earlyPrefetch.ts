import type { PublicBundleData } from './publicBundleCache';

export type EarlyBundleResult =
  | { status: 'ok'; bundle: PublicBundleData }
  | { status: 'not-found' | 'error' };

export interface BethelPrefetchBridge {
  bundlePromise?: Promise<EarlyBundleResult>;
  resolvedResult?: EarlyBundleResult;
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
