import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { FIELD_LIMITS } from '../data/cacheConfig';
import {
  EMPTY_CHURCH_INFO,
  normalizeMinistryCategory,
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
import { normalizeSiteTheme, type SiteThemeId } from '../data/themes';
import {
  clearAllAdminSessionCaches,
  readCachedAdminUsers,
  readCachedVisitorCounter,
  readCachedVisitorRequests,
  readCachedVisitorStatsBundle,
  writeCachedAdminUsers,
  writeCachedVisitorCounter,
  writeCachedVisitorRequests,
  writeCachedVisitorStatsBundle,
  type VisitorStatsAggregates,
} from '../lib/adminSessionCache';
import {
  awaitEarlyPrefetchedBundle,
  getEarlyPrefetchedBundleSnapshot,
} from '../lib/earlyPrefetch';
import { getCurrentAuthUid } from '../lib/firebase';
import { persistImageToD1IfNeeded, preloadImageRef } from '../lib/mediaStorage';
import {
  clearLocalBundleCache,
  isCacheFresh,
  readLocalBundleCache,
  writeLocalBundleCache,
  type PublicBundleData,
} from '../lib/publicBundleCache';
import {
  buildChurchInfoFields,
  clampSortOrder,
  clampStr,
  cleanWeekdayMinistry,
  makeDocId,
  normalizeAnnouncementCategory,
  normalizeAnnouncements,
  normalizeChurchInfo,
  normalizeCoworkers,
  normalizeMinistryRoster,
  normalizeWeekdayMinistries,
  removeById,
  sanitizeImageRef,
  upsertSorted,
} from '../utils/churchNormalization';

export type { PublicBundleData };
export type DataSourceMode = 'local-cache' | 'cloud-bundle' | 'admin-live' | 'empty';

export interface PublicChurchDataValue {
  churchInfo: ChurchInfo;
  coworkers: PulpitCoworker[];
  worshipTimes: WorshipTimeSlot[];
  liturgySteps: LiturgyStep[];
  ministryRoster: MinistryRosterItem[];
  weekdayMinistries: WeekdayMinistry[];
  announcements: AnnouncementItem[];
  activeTheme: SiteThemeId;
  hasCloudData: boolean;
  hasPublicBundle: boolean;
  cloudLoading: boolean;
  quotaExceeded: boolean;
  dataSource: DataSourceMode;
  lastSyncedAt: number | null;
  submitVisitorRequest: (payload: {
    name: string;
    contact: string;
    intent?: string;
    message: string;
  }) => Promise<void>;
  refreshPublicSnapshot: () => Promise<void>;
}

export interface ChurchAuthValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  isMainAdmin: boolean;
  canViewVisitorStats: boolean;
  visitorRequests: VisitorRequestItem[];
  adminUsers: AdminUserItem[];
  visitorStats: VisitorStatsSummary | null;
  visitorIpRecords: VisitorIpRecord[];
  visitorStatsAggregates: VisitorStatsAggregates | null;
  visitorStatsLoading: boolean;
  adminUsersLoading: boolean;
  loadVisitorStatsData: (forceRefresh?: boolean) => Promise<void>;
  loadAdminUsersData: (forceRefresh?: boolean) => Promise<void>;
  activateAdminSession: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

export interface ChurchAdminActionsValue {
  syncModifiedContentToCloud: () => Promise<void>;
  publishPublicBundle: () => Promise<void>;
  refreshAdminData: () => Promise<void>;
  backupToFirestore: (onProgress?: (step: string) => void) => Promise<{
    backedUpImages: number;
    backedUpDocs: number;
    backedUpAdmins: number;
    backedUpRequests: number;
    warnings: string[];
  }>;
  saveSiteTheme: (theme: SiteThemeId) => Promise<void>;
  saveChurchInfo: (info: ChurchInfo) => Promise<void>;
  saveCoworker: (item: PulpitCoworker) => Promise<void>;
  deleteCoworker: (id: string) => Promise<void>;
  saveWorshipTime: (item: WorshipTimeSlot) => Promise<void>;
  deleteWorshipTime: (id: string) => Promise<void>;
  saveLiturgyStep: (item: LiturgyStep) => Promise<void>;
  deleteLiturgyStep: (id: string) => Promise<void>;
  saveMinistryRoster: (item: MinistryRosterItem) => Promise<void>;
  deleteMinistryRoster: (id: string) => Promise<void>;
  saveWeekdayMinistry: (item: WeekdayMinistry) => Promise<void>;
  deleteWeekdayMinistry: (id: string) => Promise<void>;
  saveAnnouncement: (item: AnnouncementItem) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  updateVisitorRequestStatus: (
    id: string,
    status: VisitorRequestItem['status'],
    adminNote: string
  ) => Promise<void>;
  deleteVisitorRequest: (id: string) => Promise<void>;
  addAdminUser: (
    uid: string,
    email: string,
    displayName: string,
    canViewVisitorStats?: boolean
  ) => Promise<void>;
  updateAdminVisitorStatsPermission: (
    uid: string,
    canViewVisitorStats: boolean
  ) => Promise<void>;
  removeAdminUser: (uid: string) => Promise<void>;
}

export type ChurchDataContextValue = PublicChurchDataValue &
  ChurchAuthValue &
  ChurchAdminActionsValue;

const ChurchPublicContext = createContext<PublicChurchDataValue | null>(null);
const ChurchAuthContext = createContext<ChurchAuthValue | null>(null);
const ChurchAdminActionsContext = createContext<ChurchAdminActionsValue | null>(null);

function resolveInitialAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/admin' || window.location.hash === '#admin';
}

export function ChurchDataProvider({ children }: { children: ReactNode }) {
  const rawCache = typeof window !== 'undefined' ? readLocalBundleCache() : null;
  const cloudRawCache = rawCache?.hasCloudBundle ? rawCache : null;
  const freshCache = isCacheFresh(cloudRawCache) ? cloudRawCache : null;
  const earlySnapshot =
    !freshCache && typeof window !== 'undefined' ? getEarlyPrefetchedBundleSnapshot() : null;
  const initialEarlyBundle = earlySnapshot?.status === 'ok' ? earlySnapshot.bundle : null;
  const initialBundle = freshCache?.bundle ?? initialEarlyBundle ?? cloudRawCache?.bundle ?? null;

  const [adminSessionRequested, setAdminSessionRequested] = useState<boolean>(
    resolveInitialAdminRoute
  );
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(() => !resolveInitialAdminRoute());
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [canViewVisitorStats, setCanViewVisitorStats] = useState(false);

  const [cloudLoading, setCloudLoading] = useState(!freshCache && !initialEarlyBundle);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [hasCloudData, setHasCloudData] = useState(
    Boolean(freshCache?.hasCloudBundle || initialEarlyBundle)
  );
  const [hasPublicBundle, setHasPublicBundle] = useState(
    Boolean(freshCache?.hasCloudBundle || initialEarlyBundle)
  );
  const [dataSource, setDataSource] = useState<DataSourceMode>(
    freshCache ? 'local-cache' : initialEarlyBundle ? 'cloud-bundle' : 'empty'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(
    freshCache ? freshCache.cachedAt : null
  );

  const [churchInfo, setChurchInfo] = useState<ChurchInfo>(
    initialBundle?.churchInfo ? normalizeChurchInfo(initialBundle.churchInfo) : EMPTY_CHURCH_INFO
  );
  const initialCachedHeroRef = useRef(initialBundle?.churchInfo?.heroImage);
  const earlyPrefetchBundleRef = useRef<PublicBundleData | null>(initialEarlyBundle);
  const publicBootStartedRef = useRef(false);
  const wasAdminRef = useRef(false);
  const visitorStatsLoadedRef = useRef(false);
  const adminUsersLoadedRef = useRef(false);
  const adminSessionIdRef = useRef(0);
  const activeAuthUidRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const activeTheme: SiteThemeId = normalizeSiteTheme(churchInfo.siteTheme);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-site-theme', activeTheme);
    }
  }, [activeTheme]);

  useEffect(() => {
    if (initialCachedHeroRef.current) {
      preloadImageRef(initialCachedHeroRef.current, 'high');
    }
  }, []);

  const [coworkers, setCoworkers] = useState<PulpitCoworker[]>(
    initialBundle?.coworkers ? normalizeCoworkers(initialBundle.coworkers) : []
  );
  const [worshipTimes, setWorshipTimes] = useState<WorshipTimeSlot[]>(
    initialBundle?.worshipTimes ?? []
  );
  const [liturgySteps, setLiturgySteps] = useState<LiturgyStep[]>(
    initialBundle?.liturgySteps ?? []
  );
  const [ministryRoster, setMinistryRoster] = useState<MinistryRosterItem[]>(
    initialBundle?.ministryRoster ? normalizeMinistryRoster(initialBundle.ministryRoster) : []
  );
  const [weekdayMinistries, setWeekdayMinistries] = useState<WeekdayMinistry[]>(
    initialBundle?.weekdayMinistries
      ? normalizeWeekdayMinistries(initialBundle.weekdayMinistries)
      : []
  );
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(
    initialBundle?.announcements ? normalizeAnnouncements(initialBundle.announcements) : []
  );

  const [visitorRequests, setVisitorRequests] = useState<VisitorRequestItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [visitorStats, setVisitorStats] = useState<VisitorStatsSummary | null>(null);
  const [visitorIpRecords, setVisitorIpRecords] = useState<VisitorIpRecord[]>([]);
  const [visitorStatsAggregates, setVisitorStatsAggregates] =
    useState<VisitorStatsAggregates | null>(null);
  const [visitorStatsLoading, setVisitorStatsLoading] = useState(false);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);

  const latestStateRef = useRef({
    churchInfo,
    coworkers,
    worshipTimes,
    liturgySteps,
    ministryRoster,
    weekdayMinistries,
    announcements,
  });

  useEffect(() => {
    latestStateRef.current = {
      churchInfo,
      coworkers,
      worshipTimes,
      liturgySteps,
      ministryRoster,
      weekdayMinistries,
      announcements,
    };
  }, [
    churchInfo,
    coworkers,
    worshipTimes,
    liturgySteps,
    ministryRoster,
    weekdayMinistries,
    announcements,
  ]);

  const getBearerToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    if (userRef.current) {
      return await userRef.current.getIdToken(forceRefresh);
    }
    const mod = await import('../lib/firebaseAuth');
    return await mod.getCurrentIdToken(forceRefresh);
  }, []);

  const adminFetch = useCallback(
    async <T = Record<string, unknown>>(
      url: string,
      init: RequestInit = {}
    ): Promise<T> => {
      const token = await getBearerToken();
      if (!token) {
        throw new Error('管理员登录凭证已失效，请重新登录。');
      }
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(url, { ...init, headers });
      const data = (await res.json().catch(() => ({}))) as T & {
        error?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error || `服务端请求失败（HTTP ${res.status}）`);
      }
      return data;
    },
    [getBearerToken]
  );

  const applyBundleToState = useCallback((bundle: PublicBundleData) => {
    if (bundle.churchInfo) {
      const merged = normalizeChurchInfo(bundle.churchInfo);
      preloadImageRef(merged.heroImage, 'high');
      setChurchInfo(merged);
    }
    if (Array.isArray(bundle.coworkers)) {
      setCoworkers(normalizeCoworkers(bundle.coworkers));
    }
    if (Array.isArray(bundle.worshipTimes)) {
      setWorshipTimes(bundle.worshipTimes);
    }
    if (Array.isArray(bundle.liturgySteps)) {
      setLiturgySteps(bundle.liturgySteps);
    }
    if (Array.isArray(bundle.ministryRoster)) {
      setMinistryRoster(normalizeMinistryRoster(bundle.ministryRoster));
    }
    if (Array.isArray(bundle.weekdayMinistries)) {
      setWeekdayMinistries(normalizeWeekdayMinistries(bundle.weekdayMinistries));
    }
    if (Array.isArray(bundle.announcements)) {
      setAnnouncements(normalizeAnnouncements(bundle.announcements));
    }
  }, []);

  const buildPublicBundlePayload = useCallback(
    (snapshot: {
      churchInfo: ChurchInfo;
      coworkers: PulpitCoworker[];
      worshipTimes: WorshipTimeSlot[];
      liturgySteps: LiturgyStep[];
      ministryRoster: MinistryRosterItem[];
      weekdayMinistries: WeekdayMinistry[];
      announcements: AnnouncementItem[];
    }) => ({
      churchInfo: buildChurchInfoFields(snapshot.churchInfo),
      coworkers: normalizeCoworkers(snapshot.coworkers).slice(0, 50),
      worshipTimes: snapshot.worshipTimes.slice(0, 20),
      liturgySteps: snapshot.liturgySteps.slice(0, 40),
      ministryRoster: normalizeMinistryRoster(snapshot.ministryRoster).slice(0, 80),
      weekdayMinistries: normalizeWeekdayMinistries(snapshot.weekdayMinistries)
        .slice(0, 30)
        .map((wm, idx) => cleanWeekdayMinistry(wm, idx + 1)),
      announcements: normalizeAnnouncements(snapshot.announcements).slice(0, 50),
      version: Date.now(),
    }),
    []
  );

  const updateCollectionStateAndRef = useCallback(
    (
      bundleKey: keyof Omit<PublicBundleData, 'churchInfo' | 'version'>,
      nextList: PublicBundleData[typeof bundleKey]
    ) => {
      latestStateRef.current = {
        ...latestStateRef.current,
        [bundleKey]: nextList,
      };
      switch (bundleKey) {
        case 'coworkers':
          setCoworkers(nextList as PulpitCoworker[]);
          break;
        case 'worshipTimes':
          setWorshipTimes(nextList as WorshipTimeSlot[]);
          break;
        case 'liturgySteps':
          setLiturgySteps(nextList as LiturgyStep[]);
          break;
        case 'ministryRoster':
          setMinistryRoster(nextList as MinistryRosterItem[]);
          break;
        case 'weekdayMinistries':
          setWeekdayMinistries(nextList as WeekdayMinistry[]);
          break;
        case 'announcements':
          setAnnouncements(nextList as AnnouncementItem[]);
          break;
      }
    },
    []
  );

  const loadSingleDocPublicBundle = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh) {
        const cached = readLocalBundleCache();
        if (isCacheFresh(cached) && cached.hasCloudBundle) {
          applyBundleToState(cached.bundle);
          setHasCloudData(true);
          setHasPublicBundle(true);
          setDataSource('local-cache');
          setLastSyncedAt(cached.cachedAt);
          setCloudLoading(false);
          return;
        }
      }

      setCloudLoading(true);
      try {
        const earlyResult = !forceRefresh ? await awaitEarlyPrefetchedBundle() : null;
        if (earlyResult?.status === 'ok') {
          const data = earlyResult.bundle;
          applyBundleToState(data);
          const syncedAt = writeLocalBundleCache(data, true);
          setHasCloudData(true);
          setHasPublicBundle(true);
          setQuotaExceeded(false);
          setDataSource('cloud-bundle');
          setLastSyncedAt(syncedAt);
          return;
        }

        if (earlyResult?.status !== 'not-found') {
          const res = await fetch('/api/public-bundle', {
            headers: { Accept: 'application/json' },
            ...(forceRefresh ? { cache: 'no-store' as const } : {}),
          });
          if (res.ok) {
            const payload = (await res.json()) as {
              exists?: boolean;
              bundle?: PublicBundleData | null;
            };
            if (payload.exists && payload.bundle) {
              applyBundleToState(payload.bundle);
              const syncedAt = writeLocalBundleCache(payload.bundle, true);
              setHasCloudData(true);
              setHasPublicBundle(true);
              setQuotaExceeded(false);
              setDataSource('cloud-bundle');
              setLastSyncedAt(syncedAt);
              return;
            }
          }
        }

        clearLocalBundleCache();
        setHasCloudData(false);
        setHasPublicBundle(false);
        setQuotaExceeded(false);
        setDataSource('empty');
        setLastSyncedAt(null);
      } catch {
        // Keep local cache rendered if network fails
      } finally {
        setCloudLoading(false);
      }
    },
    [applyBundleToState]
  );

  const activateAdminSession = useCallback(() => {
    setAdminSessionRequested((prev) => {
      if (!prev) {
        setAuthReady(false);
      }
      return true;
    });
  }, []);

  useEffect(() => {
    if (!adminSessionRequested) return;
    let active = true;
    let unsub: (() => void) | null = null;

    void import('../lib/firebaseAuth')
      .then((mod) => {
        if (!active) return;
        unsub = mod.subscribeAdminAuthAndRbac((state) => {
          if (!active) return;
          setUser(state.user);
          setIsAdmin(state.isAdmin);
          setIsMainAdmin(state.isMainAdmin);
          setCanViewVisitorStats(state.canViewVisitorStats);
          setAuthReady(state.authReady);
        });
      })
      .catch(() => {
        if (!active) return;
        setIsAdmin(false);
        setIsMainAdmin(false);
        setCanViewVisitorStats(false);
        setAuthReady(true);
      });

    return () => {
      active = false;
      unsub?.();
    };
  }, [adminSessionRequested]);

  useEffect(() => {
    if (publicBootStartedRef.current) return;
    publicBootStartedRef.current = true;
    if (adminSessionRequested) return;

    if (earlyPrefetchBundleRef.current) {
      const syncedAt = writeLocalBundleCache(earlyPrefetchBundleRef.current, true);
      setLastSyncedAt(syncedAt);
      return;
    }

    void loadSingleDocPublicBundle(false);
  }, [adminSessionRequested, loadSingleDocPublicBundle]);

  const loadAdminWorkspaceData = useCallback(
    async (sessionId: number, forceRefresh = false) => {
      const isCurrent = () => adminSessionIdRef.current === sessionId;
      const uid = activeAuthUidRef.current;

      setCloudLoading(true);
      try {
        const workspace = await adminFetch<{
          hasCloudData: boolean;
          bundle: PublicBundleData | null;
          visitorRequests: VisitorRequestItem[];
          visitorStats: VisitorStatsSummary | null;
        }>('/api/admin/workspace', { cache: 'no-store' });

        if (!isCurrent()) return;

        if (workspace.hasCloudData && workspace.bundle) {
          applyBundleToState(workspace.bundle);
          const syncedAt = writeLocalBundleCache(workspace.bundle, true);
          setHasCloudData(true);
          setHasPublicBundle(true);
          setLastSyncedAt(syncedAt);
        } else {
          setHasCloudData(false);
          setHasPublicBundle(false);
        }

        const requests = Array.isArray(workspace.visitorRequests)
          ? workspace.visitorRequests
          : [];
        setVisitorRequests(requests);
        writeCachedVisitorRequests(uid, requests);

        if (canViewVisitorStats) {
          const summary = workspace.visitorStats ?? null;
          setVisitorStats(summary);
          writeCachedVisitorCounter(uid, summary);
        } else {
          setVisitorStats(null);
          setVisitorIpRecords([]);
          setVisitorStatsAggregates(null);
        }
        setQuotaExceeded(false);
      } catch {
        if (!isCurrent()) return;
        if (!forceRefresh) {
          const cachedReq = readCachedVisitorRequests(uid);
          if (cachedReq) setVisitorRequests(cachedReq);
          const cachedCounter = readCachedVisitorCounter(uid);
          if (cachedCounter !== undefined) setVisitorStats(cachedCounter);
        }
      } finally {
        if (isCurrent()) {
          setCloudLoading(false);
        }
      }
    },
    [adminFetch, applyBundleToState, canViewVisitorStats]
  );

  useEffect(() => {
    if (!authReady) return;

    activeAuthUidRef.current = user?.uid ?? null;

    if (!isAdmin) {
      adminSessionIdRef.current += 1;
      visitorStatsLoadedRef.current = false;
      adminUsersLoadedRef.current = false;
      clearAllAdminSessionCaches();
      setVisitorRequests([]);
      setAdminUsers([]);
      setVisitorStats(null);
      setVisitorIpRecords([]);
      setVisitorStatsAggregates(null);
      if (wasAdminRef.current) {
        wasAdminRef.current = false;
        void loadSingleDocPublicBundle(false);
      }
      return;
    }

    wasAdminRef.current = true;
    setDataSource('admin-live');
    adminSessionIdRef.current += 1;
    const currentSessionId = adminSessionIdRef.current;
    void loadAdminWorkspaceData(currentSessionId, false);
  }, [authReady, isAdmin, user?.uid, loadAdminWorkspaceData, loadSingleDocPublicBundle]);

  const loadAdminUsersData = useCallback(
    async (forceRefresh = false) => {
      if (!isAdmin || !isMainAdmin) return;
      const uid = activeAuthUidRef.current;

      if (!forceRefresh) {
        if (adminUsersLoadedRef.current) return;
        const cachedUsers = readCachedAdminUsers(uid);
        if (cachedUsers !== null) {
          setAdminUsers(cachedUsers);
          adminUsersLoadedRef.current = true;
          return;
        }
      }

      const sessionAtStart = adminSessionIdRef.current;
      setAdminUsersLoading(true);
      try {
        const res = await adminFetch<{ admins: AdminUserItem[] }>('/api/admin/users', {
          cache: 'no-store',
        });
        if (adminSessionIdRef.current !== sessionAtStart) return;
        const items = Array.isArray(res.admins) ? res.admins : [];
        setAdminUsers(items);
        adminUsersLoadedRef.current = true;
        writeCachedAdminUsers(uid, items);
      } catch {
        // Handled cleanly in panel
      } finally {
        if (adminSessionIdRef.current === sessionAtStart) {
          setAdminUsersLoading(false);
        }
      }
    },
    [adminFetch, isAdmin, isMainAdmin]
  );

  const loadVisitorStatsData = useCallback(
    async (forceRefresh = false) => {
      if (!isAdmin || !canViewVisitorStats) return;
      const uid = activeAuthUidRef.current;

      if (!forceRefresh) {
        if (visitorStatsLoadedRef.current) return;
        const cachedStats = readCachedVisitorStatsBundle(uid);
        if (cachedStats !== null) {
          setVisitorStats(cachedStats.stats);
          setVisitorIpRecords(cachedStats.ipRecords);
          setVisitorStatsAggregates(cachedStats.aggregates ?? null);
          visitorStatsLoadedRef.current = true;
          return;
        }
      }

      const sessionAtStart = adminSessionIdRef.current;
      setVisitorStatsLoading(true);
      try {
        const res = await adminFetch<{
          stats: VisitorStatsSummary | null;
          ipRecords: VisitorIpRecord[];
          aggregates?: VisitorStatsAggregates | null;
        }>('/api/admin/visitor-stats', { cache: 'no-store' });

        if (adminSessionIdRef.current !== sessionAtStart) return;

        const summary = res.stats ?? null;
        const items = Array.isArray(res.ipRecords) ? res.ipRecords : [];
        const aggregates = res.aggregates ?? null;

        setVisitorStats(summary);
        setVisitorIpRecords(items);
        setVisitorStatsAggregates(aggregates);
        visitorStatsLoadedRef.current = true;
        writeCachedVisitorCounter(uid, summary);
        writeCachedVisitorStatsBundle(uid, {
          stats: summary,
          ipRecords: items,
          aggregates,
        });
      } catch {
        // Keep current state gracefully
      } finally {
        if (adminSessionIdRef.current === sessionAtStart) {
          setVisitorStatsLoading(false);
        }
      }
    },
    [adminFetch, canViewVisitorStats, isAdmin]
  );

  const refreshAdminData = useCallback(async () => {
    if (!isAdmin) return;
    adminSessionIdRef.current += 1;
    visitorStatsLoadedRef.current = false;
    adminUsersLoadedRef.current = false;
    await loadAdminWorkspaceData(adminSessionIdRef.current, true);
  }, [isAdmin, loadAdminWorkspaceData]);

  const signInWithGoogle = useCallback(async () => {
    setAdminSessionRequested(true);
    const { signInWithGoogleSafe } = await import('../lib/firebaseAuth');
    await signInWithGoogleSafe();
  }, []);

  const signOutUser = useCallback(async () => {
    const { signOutFirebaseUser } = await import('../lib/firebaseAuth');
    await signOutFirebaseUser();
  }, []);

  const syncLocalCacheFromServerBundle = useCallback(
    (bundle: PublicBundleData | null | undefined) => {
      const targetBundle = bundle ?? buildPublicBundlePayload(latestStateRef.current);
      const syncedAt = writeLocalBundleCache(targetBundle, true);
      setHasCloudData(true);
      setHasPublicBundle(true);
      setLastSyncedAt(syncedAt);
    },
    [buildPublicBundlePayload]
  );

  const publishPublicBundle = useCallback(async () => {
    const res = await adminFetch<{ bundle?: PublicBundleData }>('/api/admin/publish-bundle', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    syncLocalCacheFromServerBundle(res.bundle);
  }, [adminFetch, syncLocalCacheFromServerBundle]);

  const refreshPublicSnapshot = useCallback(async () => {
    await loadSingleDocPublicBundle(true);
  }, [loadSingleDocPublicBundle]);

  const syncModifiedContentToCloud = useCallback(async () => {
    const current = latestStateRef.current;

    const [resolvedHeroImage, resolvedFellowshipImage, resolvedTeamImage] = await Promise.all([
      persistImageToD1IfNeeded(current.churchInfo.heroImage, getBearerToken),
      persistImageToD1IfNeeded(current.churchInfo.fellowshipImage, getBearerToken),
      persistImageToD1IfNeeded(current.churchInfo.churchTeamImage, getBearerToken),
    ]);

    const resolvedCoworkers = await Promise.all(
      normalizeCoworkers(current.coworkers).map(async (cw) => ({
        ...cw,
        ...(cw.image
          ? { image: await persistImageToD1IfNeeded(cw.image, getBearerToken) }
          : {}),
      }))
    );

    const resolvedRoster = await Promise.all(
      normalizeMinistryRoster(current.ministryRoster).map(async (mr) => ({
        ...mr,
        image: await persistImageToD1IfNeeded(mr.image, getBearerToken),
      }))
    );

    const resolvedAnnouncements = await Promise.all(
      normalizeAnnouncements(current.announcements).map(async (ann) => ({
        ...ann,
        ...(ann.image
          ? { image: await persistImageToD1IfNeeded(ann.image, getBearerToken) }
          : {}),
      }))
    );

    const normalizedSnapshot = {
      churchInfo: buildChurchInfoFields({
        ...current.churchInfo,
        heroImage: resolvedHeroImage,
        fellowshipImage: resolvedFellowshipImage,
        churchTeamImage: resolvedTeamImage,
      }),
      coworkers: resolvedCoworkers,
      worshipTimes: current.worshipTimes,
      liturgySteps: current.liturgySteps,
      ministryRoster: resolvedRoster,
      weekdayMinistries: normalizeWeekdayMinistries(current.weekdayMinistries).map((wm, idx) =>
        cleanWeekdayMinistry(wm, idx + 1)
      ),
      announcements: resolvedAnnouncements,
    };

    const res = await adminFetch<{ bundle?: PublicBundleData }>('/api/admin/sync-all', {
      method: 'POST',
      body: JSON.stringify(normalizedSnapshot),
    });

    latestStateRef.current = normalizedSnapshot;
    applyBundleToState(normalizedSnapshot as PublicBundleData);
    syncLocalCacheFromServerBundle(res.bundle);
  }, [adminFetch, applyBundleToState, getBearerToken, syncLocalCacheFromServerBundle]);

  const backupToFirestore = useCallback(
    async (onProgress?: (step: string) => void) => {
      const { backupD1ToFirestore } = await import('../lib/firestoreBackup');
      const current = latestStateRef.current;

      let latestAdmins = adminUsers;
      if (isMainAdmin && !adminUsersLoadedRef.current) {
        try {
          const usersRes = await adminFetch<{ users?: AdminUserItem[] }>('/api/admin/users', {
            cache: 'no-store',
          });
          if (Array.isArray(usersRes.users)) {
            latestAdmins = usersRes.users;
            setAdminUsers(usersRes.users);
            adminUsersLoadedRef.current = true;
          }
        } catch {
          // Proceed with current adminUsers state
        }
      }

      return await backupD1ToFirestore({
        content: {
          churchInfo: current.churchInfo,
          coworkers: current.coworkers,
          worshipTimes: current.worshipTimes,
          liturgySteps: current.liturgySteps,
          ministryRoster: current.ministryRoster,
          weekdayMinistries: current.weekdayMinistries,
          announcements: current.announcements,
        },
        admins: latestAdmins,
        visitorRequests,
        isMainAdmin,
        getToken: getBearerToken,
        onProgress,
      });
    },
    [adminFetch, adminUsers, getBearerToken, isMainAdmin, visitorRequests]
  );

  const saveSortedCollectionDoc = useCallback(
    async <T extends { id: string; sortOrder: number }>(
      colName: string,
      bundleKey: keyof Omit<PublicBundleData, 'churchInfo' | 'version'>,
      cleaned: T
    ) => {
      const res = await adminFetch<{ bundle?: PublicBundleData }>(
        `/api/admin/collection/${encodeURIComponent(colName)}`,
        {
          method: 'PUT',
          body: JSON.stringify(cleaned),
        }
      );

      const currentList = latestStateRef.current[bundleKey] as unknown as T[];
      const nextList = upsertSorted(currentList, cleaned);
      updateCollectionStateAndRef(
        bundleKey,
        nextList as unknown as PublicBundleData[typeof bundleKey]
      );
      syncLocalCacheFromServerBundle(res.bundle);
    },
    [adminFetch, syncLocalCacheFromServerBundle, updateCollectionStateAndRef]
  );

  const deleteSortedCollectionDoc = useCallback(
    async <T extends { id: string }>(
      colName: string,
      bundleKey: keyof Omit<PublicBundleData, 'churchInfo' | 'version'>,
      id: string
    ) => {
      const res = await adminFetch<{ bundle?: PublicBundleData }>(
        `/api/admin/collection/${encodeURIComponent(colName)}/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      const currentList = latestStateRef.current[bundleKey] as unknown as T[];
      const nextList = removeById(currentList, id);
      updateCollectionStateAndRef(
        bundleKey,
        nextList as unknown as PublicBundleData[typeof bundleKey]
      );
      syncLocalCacheFromServerBundle(res.bundle);
    },
    [adminFetch, syncLocalCacheFromServerBundle, updateCollectionStateAndRef]
  );

  const saveChurchInfo = useCallback(
    async (info: ChurchInfo) => {
      const [resolvedHeroImage, resolvedFellowshipImage, resolvedTeamImage] = await Promise.all([
        persistImageToD1IfNeeded(info.heroImage, getBearerToken),
        persistImageToD1IfNeeded(info.fellowshipImage, getBearerToken),
        persistImageToD1IfNeeded(info.churchTeamImage, getBearerToken),
      ]);
      const cleaned = buildChurchInfoFields({
        ...info,
        heroImage: resolvedHeroImage,
        fellowshipImage: resolvedFellowshipImage,
        churchTeamImage: resolvedTeamImage,
      });

      await adminFetch('/api/admin/church-info', {
        method: 'PUT',
        body: JSON.stringify(cleaned),
      });

      latestStateRef.current = {
        ...latestStateRef.current,
        churchInfo: cleaned,
      };
      setChurchInfo(cleaned);
      syncLocalCacheFromServerBundle(null);
    },
    [adminFetch, getBearerToken, syncLocalCacheFromServerBundle]
  );

  const saveSiteTheme = useCallback(
    async (theme: SiteThemeId) => {
      await saveChurchInfo({
        ...latestStateRef.current.churchInfo,
        siteTheme: normalizeSiteTheme(theme),
      });
    },
    [saveChurchInfo]
  );

  const saveCoworker = useCallback(
    async (item: PulpitCoworker) => {
      const L = FIELD_LIMITS.coworker;
      const id = item.id || makeDocId('cw');
      const resolvedImage = item.image
        ? await persistImageToD1IfNeeded(item.image, getBearerToken)
        : '';
      const cleaned: PulpitCoworker = {
        id,
        name: clampStr(item.name, L.name),
        title: clampStr(item.title, L.title),
        image: sanitizeImageRef(resolvedImage, L.image),
        sortOrder: clampSortOrder(item.sortOrder, 0),
      };
      await saveSortedCollectionDoc('coworkers', 'coworkers', cleaned);
    },
    [getBearerToken, saveSortedCollectionDoc]
  );

  const deleteCoworker = useCallback(
    (id: string) => deleteSortedCollectionDoc<PulpitCoworker>('coworkers', 'coworkers', id),
    [deleteSortedCollectionDoc]
  );

  const saveWorshipTime = useCallback(
    async (item: WorshipTimeSlot) => {
      const L = FIELD_LIMITS.worshipTime;
      const id = item.id || makeDocId('wt');
      await saveSortedCollectionDoc('worship_times', 'worshipTimes', {
        id,
        time: clampStr(item.time, L.time),
        title: clampStr(item.title, L.title),
        place: clampStr(item.place, L.place),
        desc: clampStr(item.desc, L.desc),
        sortOrder: clampSortOrder(item.sortOrder, 0),
      });
    },
    [saveSortedCollectionDoc]
  );

  const deleteWorshipTime = useCallback(
    (id: string) => deleteSortedCollectionDoc<WorshipTimeSlot>('worship_times', 'worshipTimes', id),
    [deleteSortedCollectionDoc]
  );

  const saveLiturgyStep = useCallback(
    async (item: LiturgyStep) => {
      const L = FIELD_LIMITS.liturgyStep;
      const id = item.id || makeDocId('ls');
      const cleanRef = clampStr(item.scriptureOrHymn, L.scriptureOrHymn);
      await saveSortedCollectionDoc<LiturgyStep>('liturgy_steps', 'liturgySteps', {
        id,
        liturgyType: item.liturgyType,
        time: clampStr(item.time, L.time),
        step: clampStr(item.step, L.step),
        ...(cleanRef ? { scriptureOrHymn: cleanRef } : {}),
        leader: clampStr(item.leader, L.leader),
        note: clampStr(item.note, L.note),
        sortOrder: clampSortOrder(item.sortOrder, 0),
      });
    },
    [saveSortedCollectionDoc]
  );

  const deleteLiturgyStep = useCallback(
    (id: string) => deleteSortedCollectionDoc<LiturgyStep>('liturgy_steps', 'liturgySteps', id),
    [deleteSortedCollectionDoc]
  );

  const saveMinistryRoster = useCallback(
    async (item: MinistryRosterItem) => {
      const L = FIELD_LIMITS.ministryRoster;
      const id = item.id || makeDocId('roster');
      const resolvedImage = item.image
        ? await persistImageToD1IfNeeded(item.image, getBearerToken)
        : '';
      const cleaned: MinistryRosterItem = {
        id,
        category: normalizeMinistryCategory(item.category),
        title: clampStr(item.title, L.title),
        image: sanitizeImageRef(resolvedImage, L.image),
        schedule: clampStr(item.schedule, L.schedule),
        description: clampStr(item.description, L.description),
        sortOrder: clampSortOrder(item.sortOrder, 0),
      };
      await saveSortedCollectionDoc('ministry_roster', 'ministryRoster', cleaned);
    },
    [getBearerToken, saveSortedCollectionDoc]
  );

  const deleteMinistryRoster = useCallback(
    (id: string) =>
      deleteSortedCollectionDoc<MinistryRosterItem>('ministry_roster', 'ministryRoster', id),
    [deleteSortedCollectionDoc]
  );

  const saveWeekdayMinistry = useCallback(
    async (item: WeekdayMinistry) => {
      const id = item.id || makeDocId('wm');
      const cleaned = cleanWeekdayMinistry({ ...item, id }, 0);
      await saveSortedCollectionDoc('weekday_ministries', 'weekdayMinistries', cleaned);
    },
    [saveSortedCollectionDoc]
  );

  const deleteWeekdayMinistry = useCallback(
    (id: string) =>
      deleteSortedCollectionDoc<WeekdayMinistry>('weekday_ministries', 'weekdayMinistries', id),
    [deleteSortedCollectionDoc]
  );

  const saveAnnouncement = useCallback(
    async (item: AnnouncementItem) => {
      const L = FIELD_LIMITS.announcement;
      const id = item.id || makeDocId('ann');
      const resolvedImage = item.image
        ? await persistImageToD1IfNeeded(item.image, getBearerToken)
        : '';
      const cleanDate = clampStr(item.date, L.date);
      const cleanTime = clampStr(item.time, L.time);
      const cleanLocation = clampStr(item.location, L.location);
      const cleanContact = clampStr(item.contact, L.contact);
      const cleaned: AnnouncementItem = {
        id,
        category: normalizeAnnouncementCategory(item.category),
        ...(cleanDate ? { date: cleanDate } : {}),
        title: clampStr(item.title, L.title),
        summary: clampStr(item.summary, L.summary),
        ...(cleanTime ? { time: cleanTime } : {}),
        ...(cleanLocation ? { location: cleanLocation } : {}),
        ...(cleanContact ? { contact: cleanContact } : {}),
        image: sanitizeImageRef(resolvedImage, L.image),
        isFeatured: Boolean(item.isFeatured),
        details: item.details
          .slice(0, L.detailsMaxCount)
          .map((d) => clampStr(d, L.detailLen))
          .filter(Boolean),
        sortOrder: clampSortOrder(item.sortOrder, 0),
      };
      await saveSortedCollectionDoc('announcements', 'announcements', cleaned);
    },
    [getBearerToken, saveSortedCollectionDoc]
  );

  const deleteAnnouncement = useCallback(
    (id: string) => deleteSortedCollectionDoc<AnnouncementItem>('announcements', 'announcements', id),
    [deleteSortedCollectionDoc]
  );

  const submitVisitorRequest = useCallback(
    async (payload: { name: string; contact: string; intent?: string; message: string }) => {
      const L = FIELD_LIMITS.visitorRequest;
      const cleanName = clampStr(payload.name, L.name);
      const cleanContact = clampStr(payload.contact, L.contact);
      const cleanIntent = payload.intent ? clampStr(payload.intent, L.intent) : '';
      const cleanMessage = clampStr(payload.message, L.message);

      const res = await fetch('/api/visitor-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          contact: cleanContact,
          ...(cleanIntent ? { intent: cleanIntent } : {}),
          message: cleanMessage,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '提交来访留言失败，请稍后重试。');
      }
    },
    []
  );

  const updateVisitorRequestStatus = useCallback(
    async (id: string, status: VisitorRequestItem['status'], adminNote: string) => {
      const cleanNote = clampStr(adminNote, FIELD_LIMITS.visitorRequest.adminNote);
      await adminFetch(`/api/admin/visitor-requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote: cleanNote }),
      });
      setVisitorRequests((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, status, adminNote: cleanNote } : r));
        writeCachedVisitorRequests(activeAuthUidRef.current, next);
        return next;
      });
    },
    [adminFetch]
  );

  const deleteVisitorRequest = useCallback(
    async (id: string) => {
      await adminFetch(`/api/admin/visitor-requests/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setVisitorRequests((prev) => {
        const next = prev.filter((r) => r.id !== id);
        writeCachedVisitorRequests(activeAuthUidRef.current, next);
        return next;
      });
    },
    [adminFetch]
  );

  const addAdminUser = useCallback(
    async (
      uid: string,
      email: string,
      displayName: string,
      allowVisitorStats = false
    ) => {
      const L = FIELD_LIMITS.adminUser;
      const cleanUid = clampStr(uid, L.uid);
      if (!/^[a-zA-Z0-9_-]+$/.test(cleanUid)) {
        throw new Error('管理员 UID 格式无效（仅支持字母、数字、下划线或连字符）。');
      }
      const cleanEmail = clampStr(email, L.email);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
        throw new Error('请输入有效的同工邮箱地址。');
      }
      const cleanDisplayName = clampStr(displayName, L.displayName);
      if (!cleanDisplayName) {
        throw new Error('请填写同工称呼。');
      }
      const allowStats = Boolean(allowVisitorStats);

      const res = await adminFetch<{ admin?: AdminUserItem }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          uid: cleanUid,
          email: cleanEmail,
          displayName: cleanDisplayName,
          canViewVisitorStats: allowStats,
        }),
      });

      const created: AdminUserItem = res.admin ?? {
        uid: cleanUid,
        email: cleanEmail,
        displayName: cleanDisplayName,
        canViewVisitorStats: allowStats,
      };
      setAdminUsers((prev) => {
        const next = [...prev.filter((a) => a.uid !== cleanUid), created];
        writeCachedAdminUsers(activeAuthUidRef.current, next);
        return next;
      });
    },
    [adminFetch]
  );

  const updateAdminVisitorStatsPermission = useCallback(
    async (uid: string, allowVisitorStats: boolean) => {
      const allowStats = Boolean(allowVisitorStats);
      await adminFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ canViewVisitorStats: allowStats }),
      });
      setAdminUsers((prev) => {
        const next = prev.map((a) =>
          a.uid === uid ? { ...a, canViewVisitorStats: allowStats } : a
        );
        writeCachedAdminUsers(activeAuthUidRef.current, next);
        return next;
      });
    },
    [adminFetch]
  );

  const removeAdminUser = useCallback(
    async (uid: string) => {
      const activeUid = getCurrentAuthUid();
      if (activeUid && uid === activeUid) {
        throw new Error('为防止误锁定，无法在此撤销当前登录账号自身的权限。');
      }
      await adminFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
      });
      setAdminUsers((prev) => {
        const next = prev.filter((a) => a.uid !== uid);
        writeCachedAdminUsers(activeAuthUidRef.current, next);
        return next;
      });
    },
    [adminFetch]
  );

  const publicValue = useMemo<PublicChurchDataValue>(
    () => ({
      churchInfo,
      coworkers,
      worshipTimes,
      liturgySteps,
      ministryRoster,
      weekdayMinistries,
      announcements,
      activeTheme,
      hasCloudData,
      hasPublicBundle,
      cloudLoading,
      quotaExceeded,
      dataSource,
      lastSyncedAt,
      submitVisitorRequest,
      refreshPublicSnapshot,
    }),
    [
      churchInfo,
      coworkers,
      worshipTimes,
      liturgySteps,
      ministryRoster,
      weekdayMinistries,
      announcements,
      activeTheme,
      hasCloudData,
      hasPublicBundle,
      cloudLoading,
      quotaExceeded,
      dataSource,
      lastSyncedAt,
      submitVisitorRequest,
      refreshPublicSnapshot,
    ]
  );

  const authValue = useMemo<ChurchAuthValue>(
    () => ({
      user,
      authReady,
      isAdmin,
      isMainAdmin,
      canViewVisitorStats,
      visitorRequests,
      adminUsers,
      visitorStats,
      visitorIpRecords,
      visitorStatsAggregates,
      visitorStatsLoading,
      adminUsersLoading,
      loadVisitorStatsData,
      loadAdminUsersData,
      activateAdminSession,
      signInWithGoogle,
      signOutUser,
    }),
    [
      user,
      authReady,
      isAdmin,
      isMainAdmin,
      canViewVisitorStats,
      visitorRequests,
      adminUsers,
      visitorStats,
      visitorIpRecords,
      visitorStatsAggregates,
      visitorStatsLoading,
      adminUsersLoading,
      loadVisitorStatsData,
      loadAdminUsersData,
      activateAdminSession,
      signInWithGoogle,
      signOutUser,
    ]
  );

  const adminActionsValue = useMemo<ChurchAdminActionsValue>(
    () => ({
      syncModifiedContentToCloud,
      publishPublicBundle,
      refreshAdminData,
      backupToFirestore,
      saveSiteTheme,
      saveChurchInfo,
      saveCoworker,
      deleteCoworker,
      saveWorshipTime,
      deleteWorshipTime,
      saveLiturgyStep,
      deleteLiturgyStep,
      saveMinistryRoster,
      deleteMinistryRoster,
      saveWeekdayMinistry,
      deleteWeekdayMinistry,
      saveAnnouncement,
      deleteAnnouncement,
      updateVisitorRequestStatus,
      deleteVisitorRequest,
      addAdminUser,
      updateAdminVisitorStatsPermission,
      removeAdminUser,
    }),
    [
      syncModifiedContentToCloud,
      publishPublicBundle,
      refreshAdminData,
      backupToFirestore,
      saveSiteTheme,
      saveChurchInfo,
      saveCoworker,
      deleteCoworker,
      saveWorshipTime,
      deleteWorshipTime,
      saveLiturgyStep,
      deleteLiturgyStep,
      saveMinistryRoster,
      deleteMinistryRoster,
      saveWeekdayMinistry,
      deleteWeekdayMinistry,
      saveAnnouncement,
      deleteAnnouncement,
      updateVisitorRequestStatus,
      deleteVisitorRequest,
      addAdminUser,
      updateAdminVisitorStatsPermission,
      removeAdminUser,
    ]
  );

  return (
    <ChurchPublicContext.Provider value={publicValue}>
      <ChurchAuthContext.Provider value={authValue}>
        <ChurchAdminActionsContext.Provider value={adminActionsValue}>
          {children}
        </ChurchAdminActionsContext.Provider>
      </ChurchAuthContext.Provider>
    </ChurchPublicContext.Provider>
  );
}

export function usePublicChurchData(): PublicChurchDataValue {
  const ctx = useContext(ChurchPublicContext);
  if (!ctx) {
    throw new Error('usePublicChurchData must be used inside ChurchDataProvider');
  }
  return ctx;
}

export function useChurchAuth(): ChurchAuthValue {
  const ctx = useContext(ChurchAuthContext);
  if (!ctx) {
    throw new Error('useChurchAuth must be used inside ChurchDataProvider');
  }
  return ctx;
}

export function useChurchAdminActions(): ChurchAdminActionsValue {
  const ctx = useContext(ChurchAdminActionsContext);
  if (!ctx) {
    throw new Error('useChurchAdminActions must be used inside ChurchDataProvider');
  }
  return ctx;
}

export function useChurchData(): ChurchDataContextValue {
  const pub = usePublicChurchData();
  const authCtx = useChurchAuth();
  const actions = useChurchAdminActions();
  return useMemo(
    () => ({ ...pub, ...authCtx, ...actions }),
    [pub, authCtx, actions]
  );
}
