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
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { FIELD_LIMITS } from '../data/cacheConfig';
import {
  ANNOUNCEMENTS,
  CHURCH_INFO,
  isLegacySeededWeekdayMinistries,
  LITURGY_COMMUNION,
  LITURGY_STANDARD,
  normalizeMinistryCategory,
  normalizeWeekdayMinistries,
  PULPIT_COWORKERS,
  SUNDAY_MINISTRY_ROSTER,
  SUNDAY_WORSHIP_TIMES,
  WEEKDAY_MINISTRIES,
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
  awaitEarlyPrefetchedBundle,
  getEarlyPrefetchedBundleSnapshot,
} from '../lib/earlyPrefetch';
import {
  db,
  fetchPublicBundleFromServer,
  getCurrentAuthUid,
  handleFirestoreError,
  isFirestoreQuotaError,
  OperationType,
} from '../lib/firebase';
import {
  deleteMediaChunksByUri,
  isMediaUri,
  persistLosslessImageIfNeeded,
  preloadImageRef,
} from '../lib/mediaStorage';
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
} from '../lib/adminSessionCache';
import {
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
  mergeLegacyPastorsIntoCoworkers,
  normalizeAnnouncementCategory,
  normalizeAnnouncements,
  normalizeChurchInfo,
  normalizeCoworkers,
  normalizeMinistryRoster,
  removeById,
  sanitizeImageRef,
  toWeekdayFirestoreBody,
  upsertSorted,
  type LegacyPastorLike,
} from '../utils/churchNormalization';

export type { PublicBundleData };
export type DataSourceMode = 'local-cache' | 'cloud-bundle' | 'admin-live' | 'default';

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

interface BatchWriteOp {
  ref: DocumentReference;
  data: Record<string, unknown>;
}

async function commitChunkedBatches(ops: BatchWriteOp[], chunkSize = 400): Promise<void> {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + chunkSize);
    for (const op of slice) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();
  }
}

function cleanupReplacedMediaUri(
  oldUri: string | undefined,
  newUri: string | undefined,
  stillReferencedUris: Set<string> = new Set()
): void {
  const prev = String(oldUri ?? '').trim();
  const next = String(newUri ?? '').trim();
  if (!prev || prev === next || !isMediaUri(prev) || stillReferencedUris.has(prev)) {
    return;
  }
  void deleteMediaChunksByUri(prev).catch(() => {
    // Best-effort orphaned chunk cleanup
  });
}

function resolveInitialAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/admin' || window.location.hash === '#admin';
}

export function ChurchDataProvider({ children }: { children: ReactNode }) {
  const rawCache = typeof window !== 'undefined' ? readLocalBundleCache() : null;
  const freshCache = isCacheFresh(rawCache) ? rawCache : null;
  const earlySnapshot =
    !freshCache && typeof window !== 'undefined' ? getEarlyPrefetchedBundleSnapshot() : null;
  const initialEarlyBundle = earlySnapshot?.status === 'ok' ? earlySnapshot.bundle : null;
  const initialBundle = freshCache?.bundle ?? initialEarlyBundle ?? rawCache?.bundle ?? null;

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
    freshCache ? 'local-cache' : initialEarlyBundle ? 'cloud-bundle' : 'default'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(
    freshCache ? freshCache.cachedAt : null
  );

  const [churchInfo, setChurchInfo] = useState<ChurchInfo>(
    initialBundle?.churchInfo ? normalizeChurchInfo(initialBundle.churchInfo) : CHURCH_INFO
  );
  const initialCachedHeroRef = useRef(initialBundle?.churchInfo?.heroImage);
  const earlyPrefetchBundleRef = useRef<PublicBundleData | null>(initialEarlyBundle);
  const publicBootStartedRef = useRef(false);
  const wasAdminRef = useRef(false);
  const legacyCloudWeekdayIdsRef = useRef<string[]>([]);
  const legacyCloudPastorIdsRef = useRef<Set<string>>(new Set());
  const visitorStatsLoadedRef = useRef(false);
  const adminUsersLoadedRef = useRef(false);
  const adminSessionIdRef = useRef(0);
  const activeAuthUidRef = useRef<string | null>(null);

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

  const initialLegacyPastors = (initialBundle as { pastors?: LegacyPastorLike[] } | null)?.pastors;
  const [coworkers, setCoworkers] = useState<PulpitCoworker[]>(
    initialBundle?.coworkers?.length || initialLegacyPastors?.length
      ? mergeLegacyPastorsIntoCoworkers(initialBundle?.coworkers ?? [], initialLegacyPastors)
      : PULPIT_COWORKERS
  );
  const [worshipTimes, setWorshipTimes] = useState<WorshipTimeSlot[]>(
    initialBundle?.worshipTimes?.length ? initialBundle.worshipTimes : SUNDAY_WORSHIP_TIMES
  );
  const [liturgySteps, setLiturgySteps] = useState<LiturgyStep[]>(
    initialBundle?.liturgySteps?.length
      ? initialBundle.liturgySteps
      : [...LITURGY_STANDARD, ...LITURGY_COMMUNION]
  );
  const [ministryRoster, setMinistryRoster] = useState<MinistryRosterItem[]>(
    initialBundle?.ministryRoster?.length
      ? normalizeMinistryRoster(initialBundle.ministryRoster)
      : SUNDAY_MINISTRY_ROSTER
  );
  const [weekdayMinistries, setWeekdayMinistries] = useState<WeekdayMinistry[]>(
    initialBundle?.weekdayMinistries?.length
      ? normalizeWeekdayMinistries(initialBundle.weekdayMinistries)
      : WEEKDAY_MINISTRIES
  );
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(
    initialBundle?.announcements?.length
      ? normalizeAnnouncements(initialBundle.announcements)
      : ANNOUNCEMENTS
  );

  const [visitorRequests, setVisitorRequests] = useState<VisitorRequestItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [visitorStats, setVisitorStats] = useState<VisitorStatsSummary | null>(null);
  const [visitorIpRecords, setVisitorIpRecords] = useState<VisitorIpRecord[]>([]);
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

  const applyBundleToState = useCallback((bundle: PublicBundleData) => {
    if (bundle.churchInfo) {
      const merged = normalizeChurchInfo(bundle.churchInfo);
      preloadImageRef(merged.heroImage, 'high');
      setChurchInfo(merged);
    }
    const legacyPastors = (bundle as { pastors?: LegacyPastorLike[] }).pastors;
    if (bundle.coworkers?.length || legacyPastors?.length) {
      setCoworkers(mergeLegacyPastorsIntoCoworkers(bundle.coworkers ?? [], legacyPastors));
    }
    if (bundle.worshipTimes?.length) setWorshipTimes(bundle.worshipTimes);
    if (bundle.liturgySteps?.length) setLiturgySteps(bundle.liturgySteps);
    if (bundle.ministryRoster?.length) {
      setMinistryRoster(normalizeMinistryRoster(bundle.ministryRoster));
    }
    if (bundle.weekdayMinistries?.length) {
      setWeekdayMinistries(normalizeWeekdayMinistries(bundle.weekdayMinistries));
    }
    if (bundle.announcements?.length) {
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

  const publishBundleSnapshot = useCallback(
    async (snapshot: Parameters<typeof buildPublicBundlePayload>[0]) => {
      const bundle = buildPublicBundlePayload(snapshot);
      const approxBytes = new Blob([JSON.stringify(bundle)]).size;
      if (approxBytes > 950_000) {
        throw new Error(
          '当前所有模块图片与文本汇总大小已接近云端单文档 1MB 上限，请改用外链图片地址或适当压缩后再试。'
        );
      }
      await setDoc(doc(db, 'church_sections', 'public_bundle'), {
        ...bundle,
        updatedAt: serverTimestamp(),
      });
      const syncedAt = writeLocalBundleCache(bundle, true);
      setHasPublicBundle(true);
      setLastSyncedAt(syncedAt);
    },
    [buildPublicBundlePayload]
  );

  const handleReadError = useCallback(
    (error: unknown, operationType: OperationType, path: string | null): boolean => {
      if (isFirestoreQuotaError(error)) {
        setQuotaExceeded(true);
        return true;
      }
      try {
        handleFirestoreError(error, operationType, path);
      } catch {
        // Keep local cache / default fallback rendered smoothly
      }
      return false;
    },
    []
  );

  const handleWriteError = useCallback(
    (error: unknown, operationType: OperationType, path: string | null): never => {
      if (isFirestoreQuotaError(error)) {
        setQuotaExceeded(true);
        throw new Error(
          '今日云端数据库免费读写额度已达上限，请待每日配额重置（约意大利时间 09:00）后再试。'
        );
      }
      handleFirestoreError(error, operationType, path);
    },
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
        if (isCacheFresh(cached)) {
          applyBundleToState(cached.bundle);
          setHasCloudData(cached.hasCloudBundle);
          setHasPublicBundle(cached.hasCloudBundle);
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

        if (earlyResult?.status === 'quota-exceeded') {
          setQuotaExceeded(true);
          return;
        }

        if (earlyResult?.status !== 'not-found') {
          const bundleSnap = await fetchPublicBundleFromServer();
          if (bundleSnap.exists()) {
            const data = bundleSnap.data() as PublicBundleData;
            applyBundleToState(data);
            const syncedAt = writeLocalBundleCache(data, true);
            setHasCloudData(true);
            setHasPublicBundle(true);
            setQuotaExceeded(false);
            setDataSource('cloud-bundle');
            setLastSyncedAt(syncedAt);
            return;
          }
        }

        // Backward compatibility for legacy pre-bundle databases
        const infoSnap = await getDocFromServer(doc(db, 'church_sections', 'info'));
        if (infoSnap.exists()) {
          const fetchSorted = async <T extends { sortOrder: number }>(
            colName: string,
            fallback: T[]
          ): Promise<T[]> => {
            const snap = await getDocs(query(collection(db, colName), orderBy('sortOrder', 'asc')));
            if (snap.empty) return fallback;
            return snap.docs.map((d) => ({
              ...(d.data() as Omit<T, 'id'>),
              id: d.id,
            })) as unknown as T[];
          };

          const fetchOptionalDocs = async <T,>(colName: string): Promise<T[]> => {
            const snap = await getDocs(query(collection(db, colName), orderBy('sortOrder', 'asc')));
            if (snap.empty) return [];
            return snap.docs.map((d) => ({
              ...(d.data() as Omit<T, 'id'>),
              id: d.id,
            })) as unknown as T[];
          };

          const [
            legacyPastorsList,
            coworkersRawList,
            worshipTimesList,
            liturgyList,
            rosterList,
            weekdayList,
            annList,
          ] = await Promise.all([
            fetchOptionalDocs<LegacyPastorLike>('pastors'),
            fetchOptionalDocs<PulpitCoworker>('coworkers'),
            fetchSorted<WorshipTimeSlot>('worship_times', SUNDAY_WORSHIP_TIMES),
            fetchSorted<LiturgyStep>('liturgy_steps', [...LITURGY_STANDARD, ...LITURGY_COMMUNION]),
            fetchSorted<MinistryRosterItem>('ministry_roster', SUNDAY_MINISTRY_ROSTER),
            fetchSorted<WeekdayMinistry>('weekday_ministries', WEEKDAY_MINISTRIES),
            fetchSorted<AnnouncementItem>('announcements', ANNOUNCEMENTS),
          ]);

          const mergedCoworkers =
            coworkersRawList.length || legacyPastorsList.length
              ? mergeLegacyPastorsIntoCoworkers(coworkersRawList, legacyPastorsList)
              : PULPIT_COWORKERS;

          const legacyBundle: PublicBundleData = {
            churchInfo: { ...CHURCH_INFO, ...(infoSnap.data() as ChurchInfo) },
            coworkers: mergedCoworkers,
            worshipTimes: worshipTimesList,
            liturgySteps: liturgyList,
            ministryRoster: normalizeMinistryRoster(rosterList),
            weekdayMinistries: normalizeWeekdayMinistries(weekdayList),
            announcements: normalizeAnnouncements(annList),
            version: Date.now(),
          };
          applyBundleToState(legacyBundle);
          const syncedAt = writeLocalBundleCache(legacyBundle, false);
          setHasCloudData(true);
          setHasPublicBundle(false);
          setQuotaExceeded(false);
          setDataSource('cloud-bundle');
          setLastSyncedAt(syncedAt);
        } else {
          const defaultBundle: PublicBundleData = {
            churchInfo: CHURCH_INFO,
            coworkers: PULPIT_COWORKERS,
            worshipTimes: SUNDAY_WORSHIP_TIMES,
            liturgySteps: [...LITURGY_STANDARD, ...LITURGY_COMMUNION],
            ministryRoster: SUNDAY_MINISTRY_ROSTER,
            weekdayMinistries: WEEKDAY_MINISTRIES,
            announcements: ANNOUNCEMENTS,
            version: 0,
          };
          const syncedAt = writeLocalBundleCache(defaultBundle, false);
          setHasCloudData(false);
          setHasPublicBundle(false);
          setQuotaExceeded(false);
          setDataSource('default');
          setLastSyncedAt(syncedAt);
        }
      } catch (error) {
        handleReadError(error, OperationType.GET, 'church_sections/public_bundle');
      } finally {
        setCloudLoading(false);
      }
    },
    [applyBundleToState, handleReadError]
  );

  const activateAdminSession = useCallback(() => {
    setAdminSessionRequested((prev) => {
      if (!prev) {
        setAuthReady(false);
      }
      return true;
    });
  }, []);

  // Lazy-load Firebase Auth only when Admin mode is accessed
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

  // Visitor Mode boot: immediately load or apply public snapshot without waiting for Firebase Auth
  // Skip when booting directly into Admin Mode so Admin loader owns the single fetch/cache path.
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
      let hitQuota = false;

      // 1. Reuse fresh local public_bundle cache unless forceRefresh; otherwise 1 single read
      const cachedBundle = !forceRefresh ? readLocalBundleCache() : null;
      if (isCacheFresh(cachedBundle)) {
        applyBundleToState(cachedBundle.bundle);
        setHasCloudData(cachedBundle.hasCloudBundle);
        setHasPublicBundle(cachedBundle.hasCloudBundle);
        setLastSyncedAt(cachedBundle.cachedAt);
        setCloudLoading(false);
      } else {
        try {
          const bundleSnap = await fetchPublicBundleFromServer();
          if (!isCurrent()) return;

          if (bundleSnap.exists()) {
            const data = bundleSnap.data() as PublicBundleData;
            applyBundleToState(data);
            const syncedAt = writeLocalBundleCache(data, true);
            setHasCloudData(true);
            setHasPublicBundle(true);
            setQuotaExceeded(false);
            setLastSyncedAt(syncedAt);
          } else {
            // Legacy fallback: only query individual collections if public_bundle doesn't exist yet
            const infoSnap = await getDocFromServer(doc(db, 'church_sections', 'info')).catch((err) => {
              if (isFirestoreQuotaError(err)) throw err;
              return getDoc(doc(db, 'church_sections', 'info'));
            });
            if (!isCurrent()) return;

            if (infoSnap.exists()) {
              const fetchSorted = async <T extends { sortOrder: number }>(
                colName: string,
                fallback: T[]
              ): Promise<T[]> => {
                const snap = await getDocs(query(collection(db, colName), orderBy('sortOrder', 'asc')));
                if (snap.empty) return fallback;
                return snap.docs.map((d) => ({
                  ...(d.data() as Omit<T, 'id'>),
                  id: d.id,
                })) as unknown as T[];
              };

              const fetchOptionalDocs = async <T,>(colName: string): Promise<T[]> => {
                const snap = await getDocs(query(collection(db, colName), orderBy('sortOrder', 'asc')));
                if (snap.empty) return [];
                return snap.docs.map((d) => ({
                  ...(d.data() as Omit<T, 'id'>),
                  id: d.id,
                })) as unknown as T[];
              };

              const [
                legacyPastorsList,
                coworkersRawList,
                worshipTimesList,
                liturgyList,
                rosterList,
                weekdayList,
                annList,
              ] = await Promise.all([
                fetchOptionalDocs<LegacyPastorLike>('pastors'),
                fetchOptionalDocs<PulpitCoworker>('coworkers'),
                fetchSorted<WorshipTimeSlot>('worship_times', SUNDAY_WORSHIP_TIMES),
                fetchSorted<LiturgyStep>('liturgy_steps', [...LITURGY_STANDARD, ...LITURGY_COMMUNION]),
                fetchSorted<MinistryRosterItem>('ministry_roster', SUNDAY_MINISTRY_ROSTER),
                fetchSorted<WeekdayMinistry>('weekday_ministries', WEEKDAY_MINISTRIES),
                fetchSorted<AnnouncementItem>('announcements', ANNOUNCEMENTS),
              ]);
              if (!isCurrent()) return;

              legacyCloudPastorIdsRef.current = new Set(
                legacyPastorsList.map((p) => String(p.id || '')).filter(Boolean)
              );
              if (isLegacySeededWeekdayMinistries(weekdayList)) {
                legacyCloudWeekdayIdsRef.current = weekdayList.map((item) => item.id);
              } else {
                legacyCloudWeekdayIdsRef.current = [];
              }

              const mergedCoworkers =
                coworkersRawList.length || legacyPastorsList.length
                  ? mergeLegacyPastorsIntoCoworkers(coworkersRawList, legacyPastorsList)
                  : PULPIT_COWORKERS;

              const legacyBundle: PublicBundleData = {
                churchInfo: { ...CHURCH_INFO, ...(infoSnap.data() as ChurchInfo) },
                coworkers: mergedCoworkers,
                worshipTimes: worshipTimesList,
                liturgySteps: liturgyList,
                ministryRoster: normalizeMinistryRoster(rosterList),
                weekdayMinistries: isLegacySeededWeekdayMinistries(weekdayList)
                  ? WEEKDAY_MINISTRIES
                  : normalizeWeekdayMinistries(weekdayList),
                announcements: normalizeAnnouncements(annList),
                version: Date.now(),
              };
              applyBundleToState(legacyBundle);
              const syncedAt = writeLocalBundleCache(legacyBundle, false);
              setHasCloudData(true);
              setHasPublicBundle(false);
              setQuotaExceeded(false);
              setLastSyncedAt(syncedAt);
            } else {
              setHasCloudData(false);
              setHasPublicBundle(false);
            }
          }
        } catch (error) {
          if (!isCurrent()) return;
          hitQuota = handleReadError(error, OperationType.GET, 'church_sections/public_bundle');
        } finally {
          if (isCurrent()) {
            setCloudLoading(false);
          }
        }
      }

      if (hitQuota || !isCurrent()) return;

      // 2. Load visitor requests (5-min sessionStorage cache + bounded limit(50) query)
      const cachedRequests = !forceRefresh ? readCachedVisitorRequests(uid) : null;
      if (cachedRequests !== null) {
        setVisitorRequests(cachedRequests);
      } else {
        try {
          const reqSnap = await getDocs(
            query(collection(db, 'visitor_requests'), orderBy('createdAt', 'desc'), limit(50))
          );
          if (!isCurrent()) return;
          const items = reqSnap.docs.map((d) => ({
            ...(d.data() as Omit<VisitorRequestItem, 'id'>),
            id: d.id,
          }));
          setVisitorRequests(items);
          writeCachedVisitorRequests(uid, items);
        } catch (error) {
          if (!isCurrent()) return;
          hitQuota = handleReadError(error, OperationType.LIST, 'visitor_requests');
          if (hitQuota) return;
        }
      }

      // 3. Admins list is lazy-loaded only when AdminVisitorsPanel mounts (saves up to 50 reads on boot)
      if (!isMainAdmin) {
        setAdminUsers([]);
      }

      // 4. Load lightweight visitor_counter doc (5-min sessionStorage cache, 1 read when stale)
      if (canViewVisitorStats) {
        const cachedCounter = !forceRefresh ? readCachedVisitorCounter(uid) : undefined;
        if (cachedCounter !== undefined) {
          setVisitorStats(cachedCounter);
        } else {
          try {
            const counterRef = doc(db, 'site_stats', 'visitor_counter');
            const counterSnap = await getDocFromServer(counterRef).catch((err) => {
              if (isFirestoreQuotaError(err)) throw err;
              return getDoc(counterRef);
            });
            if (!isCurrent()) return;
            const summary: VisitorStatsSummary | null = counterSnap.exists()
              ? {
                  totalVisitors: Number((counterSnap.data() as Partial<VisitorStatsSummary>).totalVisitors ?? 0),
                  lastVisitorId: String((counterSnap.data() as Partial<VisitorStatsSummary>).lastVisitorId ?? ''),
                  updatedAt: (counterSnap.data() as Partial<VisitorStatsSummary>).updatedAt,
                }
              : null;
            setVisitorStats(summary);
            writeCachedVisitorCounter(uid, summary);
          } catch (error) {
            if (!isCurrent()) return;
            handleReadError(error, OperationType.GET, 'site_stats/visitor_counter');
          }
        }
      } else {
        setVisitorStats(null);
        setVisitorIpRecords([]);
      }
    },
    [applyBundleToState, canViewVisitorStats, handleReadError, isMainAdmin]
  );

  // Admin Mode one-shot sync after Auth & RBAC verification (avoids 13 live onSnapshot listeners)
  useEffect(() => {
    if (!authReady) return;

    activeAuthUidRef.current = user?.uid ?? null;

    if (!isAdmin) {
      adminSessionIdRef.current += 1;
      legacyCloudWeekdayIdsRef.current = [];
      legacyCloudPastorIdsRef.current = new Set();
      visitorStatsLoadedRef.current = false;
      adminUsersLoadedRef.current = false;
      clearAllAdminSessionCaches();
      setVisitorRequests([]);
      setAdminUsers([]);
      setVisitorStats(null);
      setVisitorIpRecords([]);
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
        const adminsSnap = await getDocs(query(collection(db, 'admins'), limit(50)));
        if (adminSessionIdRef.current !== sessionAtStart) return;
        const items: AdminUserItem[] = adminsSnap.docs.map((d) => ({
          ...(d.data() as Omit<AdminUserItem, 'uid'>),
          uid: d.id,
        }));
        setAdminUsers(items);
        adminUsersLoadedRef.current = true;
        writeCachedAdminUsers(uid, items);
      } catch (error) {
        if (adminSessionIdRef.current !== sessionAtStart) return;
        handleReadError(error, OperationType.LIST, 'admins');
      } finally {
        if (adminSessionIdRef.current === sessionAtStart) {
          setAdminUsersLoading(false);
        }
      }
    },
    [handleReadError, isAdmin, isMainAdmin]
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
          visitorStatsLoadedRef.current = true;
          return;
        }
      }

      const sessionAtStart = adminSessionIdRef.current;
      setVisitorStatsLoading(true);
      try {
        const counterRef = doc(db, 'site_stats', 'visitor_counter');
        const [counterSnap, ipSnap] = await Promise.all([
          getDocFromServer(counterRef).catch((err) => {
            if (isFirestoreQuotaError(err)) throw err;
            return getDoc(counterRef);
          }),
          getDocs(query(collection(db, 'visitor_ips'), orderBy('countedAt', 'desc'), limit(200))),
        ]);

        if (adminSessionIdRef.current !== sessionAtStart) return;

        const summary: VisitorStatsSummary | null = counterSnap.exists()
          ? {
              totalVisitors: Number((counterSnap.data() as Partial<VisitorStatsSummary>).totalVisitors ?? 0),
              lastVisitorId: String((counterSnap.data() as Partial<VisitorStatsSummary>).lastVisitorId ?? ''),
              updatedAt: (counterSnap.data() as Partial<VisitorStatsSummary>).updatedAt,
            }
          : null;
        setVisitorStats(summary);
        writeCachedVisitorCounter(uid, summary);

        const items: VisitorIpRecord[] = ipSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            country: typeof data?.country === 'string' ? data.country : '',
            region: typeof data?.region === 'string' ? data.region : '',
            countedAt: data?.countedAt,
          };
        });
        setVisitorIpRecords(items);
        visitorStatsLoadedRef.current = true;
        writeCachedVisitorStatsBundle(uid, { stats: summary, ipRecords: items });
        setQuotaExceeded(false);
      } catch (error) {
        if (adminSessionIdRef.current !== sessionAtStart) return;
        handleReadError(error, OperationType.LIST, 'visitor_ips');
      } finally {
        if (adminSessionIdRef.current === sessionAtStart) {
          setVisitorStatsLoading(false);
        }
      }
    },
    [canViewVisitorStats, handleReadError, isAdmin]
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

  const publishPublicBundle = useCallback(async () => {
    try {
      await publishBundleSnapshot(latestStateRef.current);
      setQuotaExceeded(false);
    } catch (error) {
      handleWriteError(error, OperationType.WRITE, 'church_sections/public_bundle');
    }
  }, [handleWriteError, publishBundleSnapshot]);

  const refreshPublicSnapshot = useCallback(async () => {
    await loadSingleDocPublicBundle(true);
  }, [loadSingleDocPublicBundle]);

  const syncModifiedContentToCloud = useCallback(async () => {
    const current = latestStateRef.current;
    try {
      if (!hasCloudData) {
        const [resolvedHeroImage, resolvedFellowshipImage, resolvedTeamImage] = await Promise.all([
          persistLosslessImageIfNeeded(current.churchInfo.heroImage, 180_000),
          persistLosslessImageIfNeeded(current.churchInfo.fellowshipImage, 180_000),
          persistLosslessImageIfNeeded(current.churchInfo.churchTeamImage, 250_000),
        ]);
        const resolvedCoworkers = await Promise.all(
          normalizeCoworkers(current.coworkers).map(async (cw) => ({
            ...cw,
            ...(cw.image ? { image: await persistLosslessImageIfNeeded(cw.image, 50_000) } : {}),
          }))
        );
        const normalizedSnapshot = {
          ...current,
          churchInfo: {
            ...current.churchInfo,
            heroImage: resolvedHeroImage || CHURCH_INFO.heroImage,
            fellowshipImage: resolvedFellowshipImage || CHURCH_INFO.fellowshipImage,
            churchTeamImage: resolvedTeamImage || CHURCH_INFO.churchTeamImage,
          },
          coworkers: resolvedCoworkers,
        };

        const ops: BatchWriteOp[] = [
          {
            ref: doc(db, 'church_sections', 'info'),
            data: {
              ...buildChurchInfoFields(normalizedSnapshot.churchInfo),
              updatedAt: serverTimestamp(),
            },
          },
        ];

        for (const cw of normalizedSnapshot.coworkers) {
          const { id, image, ...body } = cw;
          ops.push({
            ref: doc(db, 'coworkers', id),
            data: { ...body, ...(image ? { image } : {}), updatedAt: serverTimestamp() },
          });
        }

        for (const wt of current.worshipTimes) {
          const { id, ...body } = wt;
          ops.push({
            ref: doc(db, 'worship_times', id),
            data: { ...body, updatedAt: serverTimestamp() },
          });
        }

        for (const ls of current.liturgySteps) {
          const cleanRef = clampStr(
            ls.scriptureOrHymn,
            FIELD_LIMITS.liturgyStep.scriptureOrHymn
          );
          const { id, scriptureOrHymn: _ignoredRef, ...body } = ls;
          ops.push({
            ref: doc(db, 'liturgy_steps', id),
            data: {
              ...body,
              ...(cleanRef ? { scriptureOrHymn: cleanRef } : {}),
              updatedAt: serverTimestamp(),
            },
          });
        }

        for (const r of normalizeMinistryRoster(current.ministryRoster)) {
          const { id, ...body } = r;
          ops.push({
            ref: doc(db, 'ministry_roster', id),
            data: { ...body, updatedAt: serverTimestamp() },
          });
        }

        for (const [idx, wm] of normalizeWeekdayMinistries(current.weekdayMinistries).entries()) {
          const cleanedWm = cleanWeekdayMinistry(wm, idx + 1);
          ops.push({
            ref: doc(db, 'weekday_ministries', cleanedWm.id),
            data: toWeekdayFirestoreBody(cleanedWm),
          });
        }

        for (const ann of normalizeAnnouncements(current.announcements)) {
          const { id, ...body } = ann;
          ops.push({
            ref: doc(db, 'announcements', id),
            data: { ...body, updatedAt: serverTimestamp() },
          });
        }

        const bundle = buildPublicBundlePayload(normalizedSnapshot);
        ops.push({
          ref: doc(db, 'church_sections', 'public_bundle'),
          data: { ...bundle, updatedAt: serverTimestamp() },
        });

        await commitChunkedBatches(ops);
        const syncedAt = writeLocalBundleCache(bundle, true);
        setHasCloudData(true);
        setHasPublicBundle(true);
        setQuotaExceeded(false);
        setLastSyncedAt(syncedAt);
        return;
      }

      await publishBundleSnapshot(current);
      setQuotaExceeded(false);
    } catch (error) {
      handleWriteError(error, OperationType.WRITE, 'syncModifiedContentToCloud');
    }
  }, [hasCloudData, buildPublicBundlePayload, handleWriteError, publishBundleSnapshot]);

  // Generic CRUD factories for sorted collections
  const saveSortedCollectionDoc = useCallback(
    async <T extends { id: string; sortOrder: number }>(
      colName: string,
      bundleKey: keyof Omit<PublicBundleData, 'churchInfo' | 'version'>,
      cleaned: T
    ) => {
      const { id, ...docBody } = cleaned;
      const path = `${colName}/${id}`;
      try {
        await setDoc(doc(db, colName, id), {
          ...docBody,
          updatedAt: serverTimestamp(),
        });
        const currentList = latestStateRef.current[bundleKey] as unknown as T[];
        const nextList = upsertSorted(currentList, cleaned);
        updateCollectionStateAndRef(
          bundleKey,
          nextList as unknown as PublicBundleData[typeof bundleKey]
        );
        setHasCloudData(true);
        await publishBundleSnapshot(latestStateRef.current);
        setQuotaExceeded(false);
      } catch (error) {
        handleWriteError(error, OperationType.WRITE, path);
      }
    },
    [handleWriteError, publishBundleSnapshot, updateCollectionStateAndRef]
  );

  const deleteSortedCollectionDoc = useCallback(
    async <T extends { id: string }>(
      colName: string,
      bundleKey: keyof Omit<PublicBundleData, 'churchInfo' | 'version'>,
      id: string
    ) => {
      const path = `${colName}/${id}`;
      try {
        await deleteDoc(doc(db, colName, id));
        const currentList = latestStateRef.current[bundleKey] as unknown as T[];
        const nextList = removeById(currentList, id);
        updateCollectionStateAndRef(
          bundleKey,
          nextList as unknown as PublicBundleData[typeof bundleKey]
        );
        await publishBundleSnapshot(latestStateRef.current);
        setQuotaExceeded(false);
      } catch (error) {
        handleWriteError(error, OperationType.DELETE, path);
      }
    },
    [handleWriteError, publishBundleSnapshot, updateCollectionStateAndRef]
  );

  const saveChurchInfo = useCallback(
    async (info: ChurchInfo) => {
      const path = 'church_sections/info';
      const prevInfo = latestStateRef.current.churchInfo;
      try {
        const [resolvedHeroImage, resolvedFellowshipImage, resolvedTeamImage] = await Promise.all([
          persistLosslessImageIfNeeded(info.heroImage, 180_000),
          persistLosslessImageIfNeeded(info.fellowshipImage, 180_000),
          persistLosslessImageIfNeeded(info.churchTeamImage, 250_000),
        ]);
        const cleaned = buildChurchInfoFields({
          ...info,
          heroImage: resolvedHeroImage,
          fellowshipImage: resolvedFellowshipImage,
          churchTeamImage: resolvedTeamImage,
        });
        await setDoc(doc(db, 'church_sections', 'info'), {
          ...cleaned,
          updatedAt: serverTimestamp(),
        });
        latestStateRef.current = {
          ...latestStateRef.current,
          churchInfo: cleaned,
        };
        setChurchInfo(cleaned);
        setHasCloudData(true);
        await publishBundleSnapshot(latestStateRef.current);
        setQuotaExceeded(false);

        cleanupReplacedMediaUri(prevInfo.heroImage, cleaned.heroImage);
        cleanupReplacedMediaUri(prevInfo.fellowshipImage, cleaned.fellowshipImage);
        cleanupReplacedMediaUri(prevInfo.churchTeamImage, cleaned.churchTeamImage);
      } catch (error) {
        handleWriteError(error, OperationType.WRITE, path);
      }
    },
    [handleWriteError, publishBundleSnapshot]
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

  const migrateLegacyPastorsWithCoworkerList = useCallback(
    async (rawNextList: PulpitCoworker[]) => {
      const L = FIELD_LIMITS.coworker;
      const legacyIds = Array.from(legacyCloudPastorIdsRef.current);
      const migratedList = await Promise.all(
        rawNextList.map(async (cw) => {
          const resolvedImage = cw.image
            ? await persistLosslessImageIfNeeded(cw.image, 50_000)
            : '';
          return {
            id: cw.id,
            name: clampStr(cw.name, L.name),
            title: clampStr(cw.title, L.title),
            image: sanitizeImageRef(resolvedImage, L.image),
            sortOrder: clampSortOrder(cw.sortOrder, 0),
          };
        })
      );

      const batch = writeBatch(db);
      for (const cw of migratedList) {
        const { id: cwId, ...body } = cw;
        batch.set(doc(db, 'coworkers', cwId), {
          ...body,
          updatedAt: serverTimestamp(),
        });
      }
      for (const legacyId of legacyIds) {
        batch.delete(doc(db, 'pastors', legacyId));
      }
      await batch.commit();
      legacyCloudPastorIdsRef.current = new Set();
      latestStateRef.current = {
        ...latestStateRef.current,
        coworkers: migratedList,
      };
      setCoworkers(migratedList);
      setHasCloudData(true);
      await publishBundleSnapshot(latestStateRef.current);
      setQuotaExceeded(false);
    },
    [publishBundleSnapshot]
  );

  const saveCoworker = useCallback(
    async (item: PulpitCoworker) => {
      const L = FIELD_LIMITS.coworker;
      const id = item.id || makeDocId('cw');
      const prevCoworker = latestStateRef.current.coworkers.find((cw) => cw.id === id);
      let cleaned: PulpitCoworker;
      try {
        const resolvedImage = item.image
          ? await persistLosslessImageIfNeeded(item.image, 50_000)
          : '';
        cleaned = {
          id,
          name: clampStr(item.name, L.name),
          title: clampStr(item.title, L.title),
          image: sanitizeImageRef(resolvedImage, L.image),
          sortOrder: clampSortOrder(item.sortOrder, 0),
        };
      } catch (error) {
        return handleWriteError(error, OperationType.WRITE, `coworkers/${id}`);
      }

      if (legacyCloudPastorIdsRef.current.size > 0) {
        try {
          const nextList = upsertSorted(latestStateRef.current.coworkers, cleaned);
          await migrateLegacyPastorsWithCoworkerList(nextList);
        } catch (error) {
          handleWriteError(error, OperationType.WRITE, `coworkers/${id}`);
        }
      } else {
        await saveSortedCollectionDoc('coworkers', 'coworkers', cleaned);
      }
      cleanupReplacedMediaUri(prevCoworker?.image, cleaned.image);
    },
    [handleWriteError, migrateLegacyPastorsWithCoworkerList, saveSortedCollectionDoc]
  );

  const deleteCoworker = useCallback(
    async (id: string) => {
      const prevCoworker = latestStateRef.current.coworkers.find((cw) => cw.id === id);
      if (legacyCloudPastorIdsRef.current.size > 0) {
        try {
          const nextList = removeById(latestStateRef.current.coworkers, id);
          if (prevCoworker && !legacyCloudPastorIdsRef.current.has(id)) {
            await deleteDoc(doc(db, 'coworkers', id));
          }
          await migrateLegacyPastorsWithCoworkerList(nextList);
        } catch (error) {
          handleWriteError(error, OperationType.DELETE, `coworkers/${id}`);
        }
      } else {
        await deleteSortedCollectionDoc<PulpitCoworker>('coworkers', 'coworkers', id);
      }
      cleanupReplacedMediaUri(prevCoworker?.image, '');
    },
    [deleteSortedCollectionDoc, handleWriteError, migrateLegacyPastorsWithCoworkerList]
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
      const prevMoment = latestStateRef.current.ministryRoster.find((m) => m.id === id);
      let cleaned: MinistryRosterItem = {
        id,
        category: normalizeMinistryCategory(item.category),
        title: clampStr(item.title, L.title),
        image: '',
        schedule: clampStr(item.schedule, L.schedule),
        description: clampStr(item.description, L.description),
        sortOrder: clampSortOrder(item.sortOrder, 0),
      };
      try {
        const resolvedImage = item.image
          ? await persistLosslessImageIfNeeded(item.image, 65_000)
          : '';
        cleaned = {
          ...cleaned,
          image: sanitizeImageRef(resolvedImage, L.image),
        };
      } catch (error) {
        handleWriteError(error, OperationType.WRITE, `ministry_roster/${id}`);
      }
      await saveSortedCollectionDoc('ministry_roster', 'ministryRoster', cleaned);
      cleanupReplacedMediaUri(prevMoment?.image, cleaned.image);
    },
    [handleWriteError, saveSortedCollectionDoc]
  );

  const deleteMinistryRoster = useCallback(
    async (id: string) => {
      const prevMoment = latestStateRef.current.ministryRoster.find((m) => m.id === id);
      await deleteSortedCollectionDoc<MinistryRosterItem>('ministry_roster', 'ministryRoster', id);
      cleanupReplacedMediaUri(prevMoment?.image, '');
    },
    [deleteSortedCollectionDoc]
  );

  const saveWeekdayMinistry = useCallback(
    async (item: WeekdayMinistry) => {
      const id = item.id || makeDocId('wm');
      const path = `weekday_ministries/${id}`;
      const cleaned = cleanWeekdayMinistry({ ...item, id }, 0);
      try {
        const legacyIds = legacyCloudWeekdayIdsRef.current;
        let nextList: WeekdayMinistry[];
        if (legacyIds.length > 0) {
          const baseList = latestStateRef.current.weekdayMinistries.map((wm, idx) =>
            cleanWeekdayMinistry(wm, idx + 1)
          );
          nextList = upsertSorted(baseList, cleaned);
          const nextIdSet = new Set(nextList.map((wm) => wm.id));
          const batch = writeBatch(db);
          for (const legacyId of legacyIds) {
            if (!nextIdSet.has(legacyId)) {
              batch.delete(doc(db, 'weekday_ministries', legacyId));
            }
          }
          for (const wm of nextList) {
            batch.set(doc(db, 'weekday_ministries', wm.id), toWeekdayFirestoreBody(wm));
          }
          await batch.commit();
          legacyCloudWeekdayIdsRef.current = [];
        } else {
          await setDoc(doc(db, 'weekday_ministries', id), toWeekdayFirestoreBody(cleaned));
          nextList = upsertSorted(latestStateRef.current.weekdayMinistries, cleaned);
        }
        latestStateRef.current = {
          ...latestStateRef.current,
          weekdayMinistries: nextList,
        };
        setWeekdayMinistries(nextList);
        setHasCloudData(true);
        await publishBundleSnapshot(latestStateRef.current);
        setQuotaExceeded(false);
      } catch (error) {
        handleWriteError(error, OperationType.WRITE, path);
      }
    },
    [handleWriteError, publishBundleSnapshot]
  );

  const deleteWeekdayMinistry = useCallback(
    async (id: string) => {
      try {
        const legacyIds = legacyCloudWeekdayIdsRef.current;
        let nextList: WeekdayMinistry[];
        if (legacyIds.length > 0) {
          const baseList = latestStateRef.current.weekdayMinistries.map((wm, idx) =>
            cleanWeekdayMinistry(wm, idx + 1)
          );
          nextList = removeById(baseList, id);
          const nextIdSet = new Set(nextList.map((wm) => wm.id));
          const batch = writeBatch(db);
          for (const legacyId of legacyIds) {
            if (!nextIdSet.has(legacyId)) {
              batch.delete(doc(db, 'weekday_ministries', legacyId));
            }
          }
          for (const wm of nextList) {
            batch.set(doc(db, 'weekday_ministries', wm.id), toWeekdayFirestoreBody(wm));
          }
          await batch.commit();
          legacyCloudWeekdayIdsRef.current = [];
        } else {
          await deleteDoc(doc(db, 'weekday_ministries', id));
          nextList = removeById(latestStateRef.current.weekdayMinistries, id);
        }
        latestStateRef.current = {
          ...latestStateRef.current,
          weekdayMinistries: nextList,
        };
        setWeekdayMinistries(nextList);
        await publishBundleSnapshot(latestStateRef.current);
        setQuotaExceeded(false);
      } catch (error) {
        handleWriteError(error, OperationType.DELETE, `weekday_ministries/${id}`);
      }
    },
    [handleWriteError, publishBundleSnapshot]
  );

  const saveAnnouncement = useCallback(
    async (item: AnnouncementItem) => {
      const L = FIELD_LIMITS.announcement;
      const id = item.id || makeDocId('ann');
      const prevAnnouncement = latestStateRef.current.announcements.find((ann) => ann.id === id);
      let cleaned: AnnouncementItem;
      try {
        const resolvedImage = item.image
          ? await persistLosslessImageIfNeeded(item.image, 60_000)
          : '';
        const cleanDate = clampStr(item.date, L.date);
        const cleanTime = clampStr(item.time, L.time);
        const cleanLocation = clampStr(item.location, L.location);
        const cleanContact = clampStr(item.contact, L.contact);
        cleaned = {
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
      } catch (error) {
        return handleWriteError(error, OperationType.WRITE, `announcements/${id}`);
      }
      await saveSortedCollectionDoc('announcements', 'announcements', cleaned);
      cleanupReplacedMediaUri(prevAnnouncement?.image, cleaned.image);
    },
    [handleWriteError, saveSortedCollectionDoc]
  );

  const deleteAnnouncement = useCallback(
    async (id: string) => {
      const prevAnnouncement = latestStateRef.current.announcements.find((ann) => ann.id === id);
      await deleteSortedCollectionDoc<AnnouncementItem>('announcements', 'announcements', id);
      cleanupReplacedMediaUri(prevAnnouncement?.image, '');
    },
    [deleteSortedCollectionDoc]
  );

  const submitVisitorRequest = useCallback(
    async (payload: { name: string; contact: string; intent?: string; message: string }) => {
      const L = FIELD_LIMITS.visitorRequest;
      const cleanName = clampStr(payload.name, L.name);
      const cleanContact = clampStr(payload.contact, L.contact);
      const cleanIntent = payload.intent ? clampStr(payload.intent, L.intent) : '';
      const cleanMessage = clampStr(payload.message, L.message);
      try {
        await addDoc(collection(db, 'visitor_requests'), {
          name: cleanName,
          contact: cleanContact,
          ...(cleanIntent ? { intent: cleanIntent } : {}),
          message: cleanMessage,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleWriteError(error, OperationType.CREATE, 'visitor_requests');
      }

      // Non-blocking server email push: Firestore persistence has already succeeded
      void fetch('/api/notify-visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          contact: cleanContact,
          ...(cleanIntent ? { intent: cleanIntent } : {}),
          message: cleanMessage,
        }),
      }).catch(() => {
        // Ignore network/notification errors so visitor submission experience stays seamless
      });
    },
    [handleWriteError]
  );

  const updateVisitorRequestStatus = useCallback(
    async (id: string, status: VisitorRequestItem['status'], adminNote: string) => {
      const cleanNote = clampStr(adminNote, FIELD_LIMITS.visitorRequest.adminNote);
      try {
        await updateDoc(doc(db, 'visitor_requests', id), {
          status,
          adminNote: cleanNote,
        });
        setVisitorRequests((prev) => {
          const next = prev.map((r) => (r.id === id ? { ...r, status, adminNote: cleanNote } : r));
          writeCachedVisitorRequests(activeAuthUidRef.current, next);
          return next;
        });
      } catch (error) {
        handleWriteError(error, OperationType.UPDATE, `visitor_requests/${id}`);
      }
    },
    [handleWriteError]
  );

  const deleteVisitorRequest = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'visitor_requests', id));
        setVisitorRequests((prev) => {
          const next = prev.filter((r) => r.id !== id);
          writeCachedVisitorRequests(activeAuthUidRef.current, next);
          return next;
        });
      } catch (error) {
        handleWriteError(error, OperationType.DELETE, `visitor_requests/${id}`);
      }
    },
    [handleWriteError]
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
      if (!/^[a-zA-Z0-9_\-]+$/.test(cleanUid)) {
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
      try {
        await setDoc(doc(db, 'admins', cleanUid), {
          email: cleanEmail,
          displayName: cleanDisplayName,
          canViewVisitorStats: allowStats,
          addedAt: serverTimestamp(),
        });
        setAdminUsers((prev) => {
          const next = [
            ...prev.filter((a) => a.uid !== cleanUid),
            {
              uid: cleanUid,
              email: cleanEmail,
              displayName: cleanDisplayName,
              canViewVisitorStats: allowStats,
            },
          ];
          writeCachedAdminUsers(activeAuthUidRef.current, next);
          return next;
        });
      } catch (error) {
        handleWriteError(error, OperationType.WRITE, `admins/${cleanUid}`);
      }
    },
    [handleWriteError]
  );

  const updateAdminVisitorStatsPermission = useCallback(
    async (uid: string, allowVisitorStats: boolean) => {
      const allowStats = Boolean(allowVisitorStats);
      try {
        await updateDoc(doc(db, 'admins', uid), {
          canViewVisitorStats: allowStats,
        });
        setAdminUsers((prev) => {
          const next = prev.map((a) =>
            a.uid === uid ? { ...a, canViewVisitorStats: allowStats } : a
          );
          writeCachedAdminUsers(activeAuthUidRef.current, next);
          return next;
        });
      } catch (error) {
        handleWriteError(error, OperationType.UPDATE, `admins/${uid}`);
      }
    },
    [handleWriteError]
  );

  const removeAdminUser = useCallback(
    async (uid: string) => {
      const activeUid = getCurrentAuthUid();
      if (activeUid && uid === activeUid) {
        throw new Error('为防止误锁定，无法在此撤销当前登录账号自身的权限。');
      }
      try {
        await deleteDoc(doc(db, 'admins', uid));
        setAdminUsers((prev) => {
          const next = prev.filter((a) => a.uid !== uid);
          writeCachedAdminUsers(activeAuthUidRef.current, next);
          return next;
        });
      } catch (error) {
        handleWriteError(error, OperationType.DELETE, `admins/${uid}`);
      }
    },
    [handleWriteError]
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
