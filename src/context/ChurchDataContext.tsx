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
  getDocFromServer,
  getDocs,
  onSnapshot,
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
  PASTORS_TEAM,
  PULPIT_COWORKERS,
  SUNDAY_MINISTRY_ROSTER,
  SUNDAY_WORSHIP_TIMES,
  WEEKDAY_MINISTRIES,
  WORSHIP_SONGS,
  type AdminUserItem,
  type AnnouncementItem,
  type ChurchInfo,
  type LiturgyStep,
  type MinistryRosterItem,
  type PastorProfile,
  type PulpitCoworker,
  type VisitorRequestItem,
  type WeekdayMinistry,
  type WorshipSong,
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
  OperationType,
} from '../lib/firebase';
import {
  deleteMediaChunksByUri,
  isMediaUri,
  persistLosslessImageIfNeeded,
  preloadImageRef,
} from '../lib/mediaStorage';
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
  normalizeAnnouncements,
  normalizeChurchInfo,
  normalizeCoworkers,
  normalizeMinistryRoster,
  normalizePastors,
  normalizeWorshipSongs,
  removeById,
  sanitizeImageRef,
  sanitizeYoutubeUrl,
  toWeekdayFirestoreBody,
  upsertSorted,
} from '../utils/churchNormalization';
import { filterSafeYoutubeUrl } from '../utils/urlSafety';

export type { PublicBundleData };
export type DataSourceMode = 'local-cache' | 'cloud-bundle' | 'admin-live' | 'default';

export interface PublicChurchDataValue {
  churchInfo: ChurchInfo;
  pastors: PastorProfile[];
  coworkers: PulpitCoworker[];
  worshipTimes: WorshipTimeSlot[];
  liturgySteps: LiturgyStep[];
  worshipSongs: WorshipSong[];
  ministryRoster: MinistryRosterItem[];
  weekdayMinistries: WeekdayMinistry[];
  announcements: AnnouncementItem[];
  activeTheme: SiteThemeId;
  hasCloudData: boolean;
  hasPublicBundle: boolean;
  cloudLoading: boolean;
  dataSource: DataSourceMode;
  lastSyncedAt: number | null;
  submitVisitorRequest: (payload: {
    name: string;
    contact: string;
    intent: string;
    message: string;
  }) => Promise<void>;
  refreshPublicSnapshot: () => Promise<void>;
}

export interface ChurchAuthValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  isMainAdmin: boolean;
  visitorRequests: VisitorRequestItem[];
  adminUsers: AdminUserItem[];
  activateAdminSession: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

export interface ChurchAdminActionsValue {
  syncModifiedContentToCloud: () => Promise<void>;
  publishPublicBundle: () => Promise<void>;
  saveSiteTheme: (theme: SiteThemeId) => Promise<void>;
  saveChurchInfo: (info: ChurchInfo) => Promise<void>;
  savePastor: (item: PastorProfile) => Promise<void>;
  deletePastor: (id: string) => Promise<void>;
  saveCoworker: (item: PulpitCoworker) => Promise<void>;
  deleteCoworker: (id: string) => Promise<void>;
  saveWorshipTime: (item: WorshipTimeSlot) => Promise<void>;
  deleteWorshipTime: (id: string) => Promise<void>;
  saveLiturgyStep: (item: LiturgyStep) => Promise<void>;
  deleteLiturgyStep: (id: string) => Promise<void>;
  saveWorshipSong: (item: WorshipSong) => Promise<void>;
  deleteWorshipSong: (id: string) => Promise<void>;
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
  addAdminUser: (uid: string, email: string, displayName: string) => Promise<void>;
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

  const [cloudLoading, setCloudLoading] = useState(!freshCache && !initialEarlyBundle);
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

  const [pastors, setPastors] = useState<PastorProfile[]>(
    initialBundle?.pastors?.length ? normalizePastors(initialBundle.pastors) : PASTORS_TEAM
  );
  const [coworkers, setCoworkers] = useState<PulpitCoworker[]>(
    initialBundle?.coworkers?.length
      ? normalizeCoworkers(initialBundle.coworkers)
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
  const [worshipSongs, setWorshipSongs] = useState<WorshipSong[]>(
    initialBundle?.worshipSongs?.length
      ? normalizeWorshipSongs(initialBundle.worshipSongs)
      : WORSHIP_SONGS
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
    initialBundle?.announcements?.length ? initialBundle.announcements : ANNOUNCEMENTS
  );

  const [visitorRequests, setVisitorRequests] = useState<VisitorRequestItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);

  const latestStateRef = useRef({
    churchInfo,
    pastors,
    coworkers,
    worshipTimes,
    liturgySteps,
    worshipSongs,
    ministryRoster,
    weekdayMinistries,
    announcements,
  });

  useEffect(() => {
    latestStateRef.current = {
      churchInfo,
      pastors,
      coworkers,
      worshipTimes,
      liturgySteps,
      worshipSongs,
      ministryRoster,
      weekdayMinistries,
      announcements,
    };
  }, [
    churchInfo,
    pastors,
    coworkers,
    worshipTimes,
    liturgySteps,
    worshipSongs,
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
    if (bundle.pastors?.length) setPastors(normalizePastors(bundle.pastors));
    if (bundle.coworkers?.length) setCoworkers(normalizeCoworkers(bundle.coworkers));
    if (bundle.worshipTimes?.length) setWorshipTimes(bundle.worshipTimes);
    if (bundle.liturgySteps?.length) setLiturgySteps(bundle.liturgySteps);
    if (bundle.worshipSongs?.length) setWorshipSongs(normalizeWorshipSongs(bundle.worshipSongs));
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
      pastors: PastorProfile[];
      coworkers: PulpitCoworker[];
      worshipTimes: WorshipTimeSlot[];
      liturgySteps: LiturgyStep[];
      worshipSongs: WorshipSong[];
      ministryRoster: MinistryRosterItem[];
      weekdayMinistries: WeekdayMinistry[];
      announcements: AnnouncementItem[];
    }) => ({
      churchInfo: buildChurchInfoFields(snapshot.churchInfo),
      pastors: snapshot.pastors.slice(0, 30),
      coworkers: normalizeCoworkers(snapshot.coworkers).slice(0, 50),
      worshipTimes: snapshot.worshipTimes.slice(0, 20),
      liturgySteps: snapshot.liturgySteps.slice(0, 40),
      worshipSongs: normalizeWorshipSongs(snapshot.worshipSongs).slice(0, 30),
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
          setDataSource('cloud-bundle');
          setLastSyncedAt(syncedAt);
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

          const [
            pastorsList,
            coworkersList,
            worshipTimesList,
            liturgyList,
            songsList,
            rosterList,
            weekdayList,
            annList,
          ] = await Promise.all([
            fetchSorted<PastorProfile>('pastors', PASTORS_TEAM),
            fetchSorted<PulpitCoworker>('coworkers', PULPIT_COWORKERS),
            fetchSorted<WorshipTimeSlot>('worship_times', SUNDAY_WORSHIP_TIMES),
            fetchSorted<LiturgyStep>('liturgy_steps', [...LITURGY_STANDARD, ...LITURGY_COMMUNION]),
            fetchSorted<WorshipSong>('worship_songs', WORSHIP_SONGS),
            fetchSorted<MinistryRosterItem>('ministry_roster', SUNDAY_MINISTRY_ROSTER),
            fetchSorted<WeekdayMinistry>('weekday_ministries', WEEKDAY_MINISTRIES),
            fetchSorted<AnnouncementItem>('announcements', ANNOUNCEMENTS),
          ]);

          const legacyBundle: PublicBundleData = {
            churchInfo: { ...CHURCH_INFO, ...(infoSnap.data() as ChurchInfo) },
            pastors: pastorsList,
            coworkers: coworkersList,
            worshipTimes: worshipTimesList,
            liturgySteps: liturgyList,
            worshipSongs: songsList,
            ministryRoster: normalizeMinistryRoster(rosterList),
            weekdayMinistries: normalizeWeekdayMinistries(weekdayList),
            announcements: normalizeAnnouncements(annList),
            version: Date.now(),
          };
          applyBundleToState(legacyBundle);
          const syncedAt = writeLocalBundleCache(legacyBundle, false);
          setHasCloudData(true);
          setHasPublicBundle(false);
          setDataSource('cloud-bundle');
          setLastSyncedAt(syncedAt);
        } else {
          const defaultBundle: PublicBundleData = {
            churchInfo: CHURCH_INFO,
            pastors: PASTORS_TEAM,
            coworkers: PULPIT_COWORKERS,
            worshipTimes: SUNDAY_WORSHIP_TIMES,
            liturgySteps: [...LITURGY_STANDARD, ...LITURGY_COMMUNION],
            worshipSongs: WORSHIP_SONGS,
            ministryRoster: SUNDAY_MINISTRY_ROSTER,
            weekdayMinistries: WEEKDAY_MINISTRIES,
            announcements: ANNOUNCEMENTS,
            version: 0,
          };
          const syncedAt = writeLocalBundleCache(defaultBundle, false);
          setHasCloudData(false);
          setHasPublicBundle(false);
          setDataSource('default');
          setLastSyncedAt(syncedAt);
        }
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.GET, 'church_sections/public_bundle');
        } catch {
          // Keep local cache / default fallback rendered smoothly
        }
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
          setAuthReady(state.authReady);
        });
      })
      .catch(() => {
        if (!active) return;
        setIsAdmin(false);
        setIsMainAdmin(false);
        setAuthReady(true);
      });

    return () => {
      active = false;
      unsub?.();
    };
  }, [adminSessionRequested]);

  // Visitor Mode boot: immediately load or apply public snapshot without waiting for Firebase Auth
  useEffect(() => {
    if (publicBootStartedRef.current) return;
    publicBootStartedRef.current = true;

    if (earlyPrefetchBundleRef.current) {
      const syncedAt = writeLocalBundleCache(earlyPrefetchBundleRef.current, true);
      setLastSyncedAt(syncedAt);
      return;
    }

    void loadSingleDocPublicBundle(false);
  }, [loadSingleDocPublicBundle]);

  // Admin Mode live multi-collection sync after Auth & RBAC verification
  useEffect(() => {
    if (!authReady) return;

    if (!isAdmin) {
      legacyCloudWeekdayIdsRef.current = [];
      setVisitorRequests([]);
      setAdminUsers([]);
      if (wasAdminRef.current) {
        wasAdminRef.current = false;
        void loadSingleDocPublicBundle(false);
      }
      return;
    }

    wasAdminRef.current = true;
    setDataSource('admin-live');
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'church_sections', 'info'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as ChurchInfo;
            setChurchInfo(normalizeChurchInfo(data));
            setHasCloudData(true);
          } else {
            setHasCloudData(false);
          }
          setCloudLoading(false);
        },
        (error) => {
          setCloudLoading(false);
          try {
            handleFirestoreError(error, OperationType.GET, 'church_sections/info');
          } catch {
            // Logged
          }
        }
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'church_sections', 'public_bundle'),
        (snap) => {
          setHasPublicBundle(snap.exists());
          if (snap.exists()) {
            const data = snap.data() as PublicBundleData;
            const syncedAt = writeLocalBundleCache(data, true);
            setLastSyncedAt(syncedAt);
          }
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.GET, 'church_sections/public_bundle');
          } catch {
            // Logged
          }
        }
      )
    );

    const subscribeSorted = <T extends { sortOrder: number }>(
      colName: string,
      setter: (items: T[]) => void,
      fallback: T[]
    ) => {
      const q = query(collection(db, colName), orderBy('sortOrder', 'asc'));
      unsubs.push(
        onSnapshot(
          q,
          (snap) => {
            if (!snap.empty) {
              const rows = snap.docs.map((d) => ({
                ...(d.data() as Omit<T, 'id'>),
                id: d.id,
              })) as unknown as T[];
              setter(rows);
            } else {
              setter(fallback);
            }
          },
          (error) => {
            try {
              handleFirestoreError(error, OperationType.LIST, colName);
            } catch {
              // Logged
            }
          }
        )
      );
    };

    subscribeSorted<PastorProfile>(
      'pastors',
      (items) => setPastors(normalizePastors(items)),
      PASTORS_TEAM
    );
    subscribeSorted<PulpitCoworker>(
      'coworkers',
      (items) => setCoworkers(normalizeCoworkers(items)),
      PULPIT_COWORKERS
    );
    subscribeSorted<WorshipTimeSlot>('worship_times', setWorshipTimes, SUNDAY_WORSHIP_TIMES);
    subscribeSorted<LiturgyStep>('liturgy_steps', setLiturgySteps, [
      ...LITURGY_STANDARD,
      ...LITURGY_COMMUNION,
    ]);
    subscribeSorted<WorshipSong>(
      'worship_songs',
      (items) => setWorshipSongs(normalizeWorshipSongs(items)),
      WORSHIP_SONGS
    );
    subscribeSorted<MinistryRosterItem>(
      'ministry_roster',
      (items) => setMinistryRoster(normalizeMinistryRoster(items)),
      SUNDAY_MINISTRY_ROSTER
    );
    subscribeSorted<WeekdayMinistry>(
      'weekday_ministries',
      (items) => {
        if (isLegacySeededWeekdayMinistries(items)) {
          legacyCloudWeekdayIdsRef.current = items.map((item) => item.id);
          setWeekdayMinistries(WEEKDAY_MINISTRIES);
        } else {
          legacyCloudWeekdayIdsRef.current = [];
          setWeekdayMinistries(normalizeWeekdayMinistries(items));
        }
      },
      WEEKDAY_MINISTRIES
    );
    subscribeSorted<AnnouncementItem>(
      'announcements',
      (items) => setAnnouncements(normalizeAnnouncements(items)),
      ANNOUNCEMENTS
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'visitor_requests'), orderBy('createdAt', 'desc')),
        (snap) => {
          const items: VisitorRequestItem[] = snap.docs.map((d) => ({
            ...(d.data() as Omit<VisitorRequestItem, 'id'>),
            id: d.id,
          }));
          setVisitorRequests(items);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, 'visitor_requests');
          } catch {
            // Logged
          }
        }
      )
    );

    if (isMainAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'admins'),
          (snap) => {
            const items: AdminUserItem[] = snap.docs.map((d) => ({
              ...(d.data() as Omit<AdminUserItem, 'uid'>),
              uid: d.id,
            }));
            setAdminUsers(items);
          },
          (error) => {
            try {
              handleFirestoreError(error, OperationType.LIST, 'admins');
            } catch {
              // Logged
            }
          }
        )
      );
    } else {
      setAdminUsers([]);
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, isAdmin, isMainAdmin, loadSingleDocPublicBundle]);

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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'church_sections/public_bundle');
    }
  }, [publishBundleSnapshot]);

  const refreshPublicSnapshot = useCallback(async () => {
    await loadSingleDocPublicBundle(true);
  }, [loadSingleDocPublicBundle]);

  const syncModifiedContentToCloud = useCallback(async () => {
    const current = latestStateRef.current;
    try {
      if (!hasCloudData) {
        const [resolvedHeroImage, resolvedFellowshipImage] = await Promise.all([
          persistLosslessImageIfNeeded(current.churchInfo.heroImage, 180_000),
          persistLosslessImageIfNeeded(current.churchInfo.fellowshipImage, 180_000),
        ]);
        const resolvedPastors = await Promise.all(
          current.pastors.map(async (p) => ({
            ...p,
            image:
              (await persistLosslessImageIfNeeded(p.image, 100_000)) || PASTORS_TEAM[0].image,
          }))
        );
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
          },
          pastors: resolvedPastors,
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

        for (const p of normalizedSnapshot.pastors) {
          const { id, ...body } = p;
          ops.push({
            ref: doc(db, 'pastors', id),
            data: { ...body, updatedAt: serverTimestamp() },
          });
        }

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

        for (const song of current.worshipSongs) {
          ops.push({
            ref: doc(db, 'worship_songs', song.id),
            data: {
              title: clampStr(song.title, FIELD_LIMITS.worshipSong.title),
              youtubeUrl: filterSafeYoutubeUrl(song.youtubeUrl),
              youtubeUrl2: filterSafeYoutubeUrl(song.youtubeUrl2),
              sortOrder: clampSortOrder(song.sortOrder, 0),
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
        setLastSyncedAt(syncedAt);
        return;
      }

      await publishBundleSnapshot(current);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'syncModifiedContentToCloud');
    }
  }, [hasCloudData, buildPublicBundlePayload, publishBundleSnapshot]);

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
        await publishBundleSnapshot({
          ...latestStateRef.current,
          [bundleKey]: upsertSorted(currentList, cleaned),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
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
        await publishBundleSnapshot({
          ...latestStateRef.current,
          [bundleKey]: removeById(currentList, id),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [publishBundleSnapshot]
  );

  const saveChurchInfo = useCallback(
    async (info: ChurchInfo) => {
      const path = 'church_sections/info';
      const prevInfo = latestStateRef.current.churchInfo;
      try {
        const [resolvedHeroImage, resolvedFellowshipImage] = await Promise.all([
          persistLosslessImageIfNeeded(info.heroImage, 180_000),
          persistLosslessImageIfNeeded(info.fellowshipImage, 180_000),
        ]);
        const cleaned = buildChurchInfoFields({
          ...info,
          heroImage: resolvedHeroImage,
          fellowshipImage: resolvedFellowshipImage,
        });
        await setDoc(doc(db, 'church_sections', 'info'), {
          ...cleaned,
          updatedAt: serverTimestamp(),
        });
        setChurchInfo(cleaned);
        await publishBundleSnapshot({
          ...latestStateRef.current,
          churchInfo: cleaned,
        });

        cleanupReplacedMediaUri(prevInfo.heroImage, cleaned.heroImage);
        cleanupReplacedMediaUri(prevInfo.fellowshipImage, cleaned.fellowshipImage);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
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

  const savePastor = useCallback(
    async (item: PastorProfile) => {
      const L = FIELD_LIMITS.pastor;
      const id = item.id || makeDocId('pastor');
      const prevPastor = latestStateRef.current.pastors.find((p) => p.id === id);
      let cleaned: PastorProfile;
      try {
        const resolvedImage = await persistLosslessImageIfNeeded(item.image, 100_000);
        cleaned = {
          id,
          name: clampStr(item.name, L.name),
          role: clampStr(item.role, L.role),
          tenure: clampStr(item.tenure, L.tenure),
          image: sanitizeImageRef(resolvedImage, L.image) || PASTORS_TEAM[0].image,
          education: clampStr(item.education, L.education),
          ministryFocus: clampStr(item.ministryFocus, L.ministryFocus),
          bio: clampStr(item.bio, L.bio),
          sortOrder: clampSortOrder(item.sortOrder, 0),
        };
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `pastors/${id}`);
      }
      await saveSortedCollectionDoc('pastors', 'pastors', cleaned);
      cleanupReplacedMediaUri(prevPastor?.image, cleaned.image);
    },
    [saveSortedCollectionDoc]
  );

  const deletePastor = useCallback(
    async (id: string) => {
      const prevPastor = latestStateRef.current.pastors.find((p) => p.id === id);
      await deleteSortedCollectionDoc<PastorProfile>('pastors', 'pastors', id);
      cleanupReplacedMediaUri(prevPastor?.image, '');
    },
    [deleteSortedCollectionDoc]
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
        handleFirestoreError(error, OperationType.WRITE, `coworkers/${id}`);
      }
      await saveSortedCollectionDoc('coworkers', 'coworkers', cleaned);
      cleanupReplacedMediaUri(prevCoworker?.image, cleaned.image);
    },
    [saveSortedCollectionDoc]
  );

  const deleteCoworker = useCallback(
    async (id: string) => {
      const prevCoworker = latestStateRef.current.coworkers.find((cw) => cw.id === id);
      await deleteSortedCollectionDoc<PulpitCoworker>('coworkers', 'coworkers', id);
      cleanupReplacedMediaUri(prevCoworker?.image, '');
    },
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

  const saveWorshipSong = useCallback(
    async (item: WorshipSong) => {
      const L = FIELD_LIMITS.worshipSong;
      const id = item.id || makeDocId('song');
      await saveSortedCollectionDoc('worship_songs', 'worshipSongs', {
        id,
        title: clampStr(item.title, L.title),
        youtubeUrl: sanitizeYoutubeUrl(item.youtubeUrl),
        youtubeUrl2: sanitizeYoutubeUrl(item.youtubeUrl2),
        sortOrder: clampSortOrder(item.sortOrder, 0),
      });
    },
    [saveSortedCollectionDoc]
  );

  const deleteWorshipSong = useCallback(
    (id: string) => deleteSortedCollectionDoc<WorshipSong>('worship_songs', 'worshipSongs', id),
    [deleteSortedCollectionDoc]
  );

  const saveMinistryRoster = useCallback(
    async (item: MinistryRosterItem) => {
      const L = FIELD_LIMITS.ministryRoster;
      const id = item.id || makeDocId('roster');
      await saveSortedCollectionDoc('ministry_roster', 'ministryRoster', {
        id,
        category: normalizeMinistryCategory(item.category),
        role: clampStr(item.role, L.role),
        thisWeek: clampStr(item.thisWeek, L.thisWeek),
        nextWeek: clampStr(item.nextWeek, L.nextWeek),
        sortOrder: clampSortOrder(item.sortOrder, 0),
      });
    },
    [saveSortedCollectionDoc]
  );

  const deleteMinistryRoster = useCallback(
    (id: string) =>
      deleteSortedCollectionDoc<MinistryRosterItem>('ministry_roster', 'ministryRoster', id),
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
        setWeekdayMinistries(nextList);
        await publishBundleSnapshot({
          ...latestStateRef.current,
          weekdayMinistries: nextList,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
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
        setWeekdayMinistries(nextList);
        await publishBundleSnapshot({
          ...latestStateRef.current,
          weekdayMinistries: nextList,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `weekday_ministries/${id}`);
      }
    },
    [publishBundleSnapshot]
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
        cleaned = {
          id,
          category: item.category,
          date: clampStr(item.date, L.date),
          title: clampStr(item.title, L.title),
          summary: clampStr(item.summary, L.summary),
          time: clampStr(item.time, L.time),
          location: clampStr(item.location, L.location),
          contact: clampStr(item.contact, L.contact),
          image: sanitizeImageRef(resolvedImage, L.image),
          isFeatured: Boolean(item.isFeatured),
          details: item.details
            .slice(0, L.detailsMaxCount)
            .map((d) => clampStr(d, L.detailLen))
            .filter(Boolean),
          sortOrder: clampSortOrder(item.sortOrder, 0),
        };
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `announcements/${id}`);
      }
      await saveSortedCollectionDoc('announcements', 'announcements', cleaned);
      cleanupReplacedMediaUri(prevAnnouncement?.image, cleaned.image);
    },
    [saveSortedCollectionDoc]
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
    async (payload: { name: string; contact: string; intent: string; message: string }) => {
      const L = FIELD_LIMITS.visitorRequest;
      try {
        await addDoc(collection(db, 'visitor_requests'), {
          name: clampStr(payload.name, L.name),
          contact: clampStr(payload.contact, L.contact),
          intent: clampStr(payload.intent, L.intent),
          message: clampStr(payload.message, L.message),
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'visitor_requests');
      }
    },
    []
  );

  const updateVisitorRequestStatus = useCallback(
    async (id: string, status: VisitorRequestItem['status'], adminNote: string) => {
      try {
        await updateDoc(doc(db, 'visitor_requests', id), {
          status,
          adminNote: clampStr(adminNote, FIELD_LIMITS.visitorRequest.adminNote),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `visitor_requests/${id}`);
      }
    },
    []
  );

  const deleteVisitorRequest = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'visitor_requests', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `visitor_requests/${id}`);
    }
  }, []);

  const addAdminUser = useCallback(
    async (uid: string, email: string, displayName: string) => {
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
      try {
        await setDoc(doc(db, 'admins', cleanUid), {
          email: cleanEmail,
          displayName: cleanDisplayName,
          addedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `admins/${cleanUid}`);
      }
    },
    []
  );

  const removeAdminUser = useCallback(async (uid: string) => {
    const activeUid = getCurrentAuthUid();
    if (activeUid && uid === activeUid) {
      throw new Error('为防止误锁定，无法在此撤销当前登录账号自身的权限。');
    }
    try {
      await deleteDoc(doc(db, 'admins', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
    }
  }, []);

  const publicValue = useMemo<PublicChurchDataValue>(
    () => ({
      churchInfo,
      pastors,
      coworkers,
      worshipTimes,
      liturgySteps,
      worshipSongs,
      ministryRoster,
      weekdayMinistries,
      announcements,
      activeTheme,
      hasCloudData,
      hasPublicBundle,
      cloudLoading,
      dataSource,
      lastSyncedAt,
      submitVisitorRequest,
      refreshPublicSnapshot,
    }),
    [
      churchInfo,
      pastors,
      coworkers,
      worshipTimes,
      liturgySteps,
      worshipSongs,
      ministryRoster,
      weekdayMinistries,
      announcements,
      activeTheme,
      hasCloudData,
      hasPublicBundle,
      cloudLoading,
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
      visitorRequests,
      adminUsers,
      activateAdminSession,
      signInWithGoogle,
      signOutUser,
    }),
    [
      user,
      authReady,
      isAdmin,
      isMainAdmin,
      visitorRequests,
      adminUsers,
      activateAdminSession,
      signInWithGoogle,
      signOutUser,
    ]
  );

  const adminActionsValue = useMemo<ChurchAdminActionsValue>(
    () => ({
      syncModifiedContentToCloud,
      publishPublicBundle,
      saveSiteTheme,
      saveChurchInfo,
      savePastor,
      deletePastor,
      saveCoworker,
      deleteCoworker,
      saveWorshipTime,
      deleteWorshipTime,
      saveLiturgyStep,
      deleteLiturgyStep,
      saveWorshipSong,
      deleteWorshipSong,
      saveMinistryRoster,
      deleteMinistryRoster,
      saveWeekdayMinistry,
      deleteWeekdayMinistry,
      saveAnnouncement,
      deleteAnnouncement,
      updateVisitorRequestStatus,
      deleteVisitorRequest,
      addAdminUser,
      removeAdminUser,
    }),
    [
      syncModifiedContentToCloud,
      publishPublicBundle,
      saveSiteTheme,
      saveChurchInfo,
      savePastor,
      deletePastor,
      saveCoworker,
      deleteCoworker,
      saveWorshipTime,
      deleteWorshipTime,
      saveLiturgyStep,
      deleteLiturgyStep,
      saveWorshipSong,
      deleteWorshipSong,
      saveMinistryRoster,
      deleteMinistryRoster,
      saveWeekdayMinistry,
      deleteWeekdayMinistry,
      saveAnnouncement,
      deleteAnnouncement,
      updateVisitorRequestStatus,
      deleteVisitorRequest,
      addAdminUser,
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
