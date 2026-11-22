import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ANNOUNCEMENTS,
  CHURCH_INFO,
  LITURGY_COMMUNION,
  LITURGY_STANDARD,
  normalizeMinistryCategory,
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
import {
  auth,
  db,
  fetchPublicBundleFromServer,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  DATA_IMAGE_URI_REGEX,
  isMediaUri,
  persistLosslessImageIfNeeded,
  preloadImageRef,
} from '../lib/mediaStorage';

const BOOTSTRAPPED_ADMIN_EMAIL = 'chinarenzhian@gmail.com';
const PUBLIC_CACHE_KEY = 'bethel_church_public_bundle_v3';
const PUBLIC_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes local cache TTL

export interface PublicBundleData {
  churchInfo: ChurchInfo;
  pastors: PastorProfile[];
  coworkers: PulpitCoworker[];
  worshipTimes: WorshipTimeSlot[];
  liturgySteps: LiturgyStep[];
  worshipSongs: WorshipSong[];
  ministryRoster: MinistryRosterItem[];
  weekdayMinistries: WeekdayMinistry[];
  announcements: AnnouncementItem[];
  version: number;
}

interface CachedBundleEnvelope {
  cachedAt: number;
  hasCloudBundle: boolean;
  bundle: PublicBundleData;
}

export type DataSourceMode = 'local-cache' | 'cloud-bundle' | 'admin-live' | 'default';

interface ChurchDataContextValue {
  // Live merged data
  churchInfo: ChurchInfo;
  pastors: PastorProfile[];
  coworkers: PulpitCoworker[];
  worshipTimes: WorshipTimeSlot[];
  liturgySteps: LiturgyStep[];
  worshipSongs: WorshipSong[];
  ministryRoster: MinistryRosterItem[];
  weekdayMinistries: WeekdayMinistry[];
  announcements: AnnouncementItem[];
  visitorRequests: VisitorRequestItem[];
  adminUsers: AdminUserItem[];

  // Auth, cache & readiness
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  hasCloudData: boolean;
  hasPublicBundle: boolean;
  cloudLoading: boolean;
  dataSource: DataSourceMode;
  lastSyncedAt: number | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  syncModifiedContentToCloud: () => Promise<void>;
  publishPublicBundle: () => Promise<void>;
  refreshPublicSnapshot: () => Promise<void>;

  // CRUD actions
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

  // Visitor & Admin management
  submitVisitorRequest: (payload: {
    name: string;
    contact: string;
    intent: string;
    message: string;
  }) => Promise<void>;
  updateVisitorRequestStatus: (
    id: string,
    status: VisitorRequestItem['status'],
    adminNote: string
  ) => Promise<void>;
  deleteVisitorRequest: (id: string) => Promise<void>;
  addAdminUser: (uid: string, email: string, displayName: string) => Promise<void>;
  removeAdminUser: (uid: string) => Promise<void>;
}

const ChurchDataContext = createContext<ChurchDataContextValue | null>(null);

function clampStr(val: string, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function sanitizeImageRef(val: string | undefined, maxLen: number): string {
  const trimmed = String(val ?? '').trim();
  if (!trimmed) return '';
  const isSafeUrlOrPath = /^(https?:\/\/|\/).+$/.test(trimmed);
  const isSafeMediaRef = isMediaUri(trimmed);
  const isSafeDataUri = DATA_IMAGE_URI_REGEX.test(trimmed);
  if (!isSafeUrlOrPath && !isSafeMediaRef && !isSafeDataUri) {
    throw new Error('图片地址格式无效：请上传 JPG/PNG/WebP 原图，或填写以 https:// 或 / 开头的有效路径。');
  }
  if (trimmed.length > maxLen) {
    throw new Error('图片地址长度超出单字段限制，请重新上传或填写外链图片地址。');
  }
  return trimmed;
}

function sanitizeYoutubeUrl(val: string | undefined): string {
  let trimmed = String(val ?? '').trim();
  if (!trimmed) return '';
  if (/^http:\/\//i.test(trimmed)) {
    trimmed = trimmed.replace(/^http:\/\//i, 'https://');
  } else if (/^([a-zA-Z0-9-]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  if (
    trimmed.length > 500 ||
    !/^https:\/\/([a-zA-Z0-9-]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/.+$/.test(
      trimmed
    )
  ) {
    throw new Error(
      '请输入有效的 YouTube 视频链接（例如 https://www.youtube.com/watch?v=... 或 https://youtu.be/...），或留空。'
    );
  }
  return trimmed;
}

function normalizeWorshipSongs(list: Partial<WorshipSong>[]): WorshipSong[] {
  return list.map((song, idx) => ({
    id: String(song.id || `song-${idx + 1}`),
    title: clampStr(song.title || '', 140),
    youtubeUrl: typeof song.youtubeUrl === 'string' ? song.youtubeUrl : '',
    youtubeUrl2: typeof song.youtubeUrl2 === 'string' ? song.youtubeUrl2 : '',
    sortOrder: Number(song.sortOrder) || idx + 1,
  }));
}

function normalizeCoworkers(list: Partial<PulpitCoworker>[]): PulpitCoworker[] {
  return list.map((cw, idx) => ({
    id: String(cw.id || `cw-${idx + 1}`),
    name: clampStr(cw.name || '', 80),
    title: clampStr(cw.title || '', 120),
    ...(typeof cw.image === 'string' && cw.image.trim() ? { image: cw.image.trim() } : {}),
    sortOrder: Number(cw.sortOrder) || idx + 1,
  }));
}

function normalizeMinistryRoster(list: Partial<MinistryRosterItem>[]): MinistryRosterItem[] {
  return list.map((item, idx) => ({
    id: String(item.id || `roster-${idx + 1}`),
    category: normalizeMinistryCategory(item.category),
    role: clampStr(item.role || '', 140),
    thisWeek: clampStr(item.thisWeek || '', 200),
    nextWeek: clampStr(item.nextWeek || '', 200),
    sortOrder: Number(item.sortOrder) || idx + 1,
  }));
}

function makeDocId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

function readLocalBundleCache(): CachedBundleEnvelope | null {
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

function writeLocalBundleCache(bundle: PublicBundleData, hasCloudBundle: boolean): number {
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

function upsertSorted<T extends { id: string; sortOrder: number }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  const next = idx >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
  return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

export function ChurchDataProvider({ children }: { children: ReactNode }) {
  const initialCache = typeof window !== 'undefined' ? readLocalBundleCache() : null;

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(!initialCache);
  const [hasCloudData, setHasCloudData] = useState(Boolean(initialCache?.hasCloudBundle));
  const [hasPublicBundle, setHasPublicBundle] = useState(Boolean(initialCache?.hasCloudBundle));
  const [dataSource, setDataSource] = useState<DataSourceMode>(
    initialCache ? 'local-cache' : 'default'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(
    initialCache ? initialCache.cachedAt : null
  );

  const [churchInfo, setChurchInfo] = useState<ChurchInfo>(
    initialCache?.bundle.churchInfo ? { ...CHURCH_INFO, ...initialCache.bundle.churchInfo } : CHURCH_INFO
  );
  const initialCachedHeroRef = useRef(initialCache?.bundle.churchInfo?.heroImage);

  useEffect(() => {
    if (initialCachedHeroRef.current) {
      preloadImageRef(initialCachedHeroRef.current, 'high');
    }
  }, []);
  const [pastors, setPastors] = useState<PastorProfile[]>(
    initialCache?.bundle.pastors?.length ? initialCache.bundle.pastors : PASTORS_TEAM
  );
  const [coworkers, setCoworkers] = useState<PulpitCoworker[]>(
    initialCache?.bundle.coworkers?.length
      ? normalizeCoworkers(initialCache.bundle.coworkers)
      : PULPIT_COWORKERS
  );
  const [worshipTimes, setWorshipTimes] = useState<WorshipTimeSlot[]>(
    initialCache?.bundle.worshipTimes?.length
      ? initialCache.bundle.worshipTimes
      : SUNDAY_WORSHIP_TIMES
  );
  const [liturgySteps, setLiturgySteps] = useState<LiturgyStep[]>(
    initialCache?.bundle.liturgySteps?.length
      ? initialCache.bundle.liturgySteps
      : [...LITURGY_STANDARD, ...LITURGY_COMMUNION]
  );
  const [worshipSongs, setWorshipSongs] = useState<WorshipSong[]>(
    initialCache?.bundle.worshipSongs?.length ? initialCache.bundle.worshipSongs : WORSHIP_SONGS
  );
  const [ministryRoster, setMinistryRoster] = useState<MinistryRosterItem[]>(
    initialCache?.bundle.ministryRoster?.length
      ? normalizeMinistryRoster(initialCache.bundle.ministryRoster)
      : SUNDAY_MINISTRY_ROSTER
  );
  const [weekdayMinistries, setWeekdayMinistries] = useState<WeekdayMinistry[]>(
    initialCache?.bundle.weekdayMinistries?.length
      ? initialCache.bundle.weekdayMinistries
      : WEEKDAY_MINISTRIES
  );
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(
    initialCache?.bundle.announcements?.length
      ? initialCache.bundle.announcements
      : ANNOUNCEMENTS
  );

  const [visitorRequests, setVisitorRequests] = useState<VisitorRequestItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);

  // Keep a mutable ref of latest state for atomic bundle publishing after Admin mutations
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
      const merged = { ...CHURCH_INFO, ...bundle.churchInfo };
      preloadImageRef(merged.heroImage, 'high');
      setChurchInfo(merged);
    }
    if (bundle.pastors?.length) setPastors(bundle.pastors);
    if (bundle.coworkers?.length) setCoworkers(normalizeCoworkers(bundle.coworkers));
    if (bundle.worshipTimes?.length) setWorshipTimes(bundle.worshipTimes);
    if (bundle.liturgySteps?.length) setLiturgySteps(bundle.liturgySteps);
    if (bundle.worshipSongs?.length) setWorshipSongs(normalizeWorshipSongs(bundle.worshipSongs));
    if (bundle.ministryRoster?.length) {
      setMinistryRoster(normalizeMinistryRoster(bundle.ministryRoster));
    }
    if (bundle.weekdayMinistries?.length) setWeekdayMinistries(bundle.weekdayMinistries);
    if (bundle.announcements?.length) setAnnouncements(bundle.announcements);
  }, []);

  const buildChurchInfoFields = (info: ChurchInfo) => ({
    name: clampStr(info.name, 100),
    founded: clampStr(info.founded, 100),
    scriptureQuote: clampStr(info.scriptureQuote, 400),
    scriptureRef: clampStr(info.scriptureRef, 100),
    heroSubtitle: clampStr(info.heroSubtitle, 400),
    heroImage: sanitizeImageRef(info.heroImage, 480000) || CHURCH_INFO.heroImage,
    fellowshipImage: sanitizeImageRef(info.fellowshipImage, 240000) || CHURCH_INFO.fellowshipImage,
    address: clampStr(info.address, 300),
    shortAddress: clampStr(info.shortAddress, 100),
    pastoralPhone: clampStr(info.pastoralPhone, 100),
    themeVerse: clampStr(info.themeVerse, 300),
    themeVerseRef: clampStr(info.themeVerseRef, 100),
    thisWeekLabel: clampStr(info.thisWeekLabel, 60),
    nextWeekLabel: clampStr(info.nextWeekLabel, 60),
    introParagraphs: info.introParagraphs
      .slice(0, 10)
      .map((s) => clampStr(s, 1000))
      .filter(Boolean),
    coreValues: info.coreValues.slice(0, 10).map((cv, idx) => ({
      index: clampStr(cv.index || String(idx + 1).padStart(2, '0'), 10),
      title: clampStr(cv.title, 60),
      description: clampStr(cv.description, 300),
    })),
  });

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
    }) => {
      const version = Date.now();
      return {
        churchInfo: buildChurchInfoFields(snapshot.churchInfo),
        pastors: snapshot.pastors.slice(0, 30),
        coworkers: normalizeCoworkers(snapshot.coworkers).slice(0, 50),
        worshipTimes: snapshot.worshipTimes.slice(0, 20),
        liturgySteps: snapshot.liturgySteps.slice(0, 40),
        worshipSongs: normalizeWorshipSongs(snapshot.worshipSongs).slice(0, 30),
        ministryRoster: normalizeMinistryRoster(snapshot.ministryRoster).slice(0, 80),
        weekdayMinistries: snapshot.weekdayMinistries.slice(0, 30),
        announcements: snapshot.announcements.slice(0, 50),
        version,
      };
    },
    []
  );

  const publishBundleSnapshot = useCallback(
    async (snapshot: {
      churchInfo: ChurchInfo;
      pastors: PastorProfile[];
      coworkers: PulpitCoworker[];
      worshipTimes: WorshipTimeSlot[];
      liturgySteps: LiturgyStep[];
      worshipSongs: WorshipSong[];
      ministryRoster: MinistryRosterItem[];
      weekdayMinistries: WeekdayMinistry[];
      announcements: AnnouncementItem[];
    }) => {
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
        if (cached && Date.now() - cached.cachedAt < PUBLIC_CACHE_TTL_MS) {
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
        // 1-Read public snapshot fetch (also validates Firestore server connection)
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

        // Backward compatibility: if public_bundle doesn't exist yet, check if legacy 'info' exists
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
            weekdayMinistries: weekdayList,
            announcements: annList,
            version: Date.now(),
          };
          applyBundleToState(legacyBundle);
          const syncedAt = writeLocalBundleCache(legacyBundle, false);
          setHasCloudData(true);
          setHasPublicBundle(false);
          setDataSource('cloud-bundle');
          setLastSyncedAt(syncedAt);
        } else {
          // Brand-new unseeded database: cache default data for 10 min so visitors make 0 extra reads
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

  // Auth listener & Admin RBAC resolution
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      const isBootstrapped =
        currentUser.emailVerified &&
        currentUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

      if (isBootstrapped) {
        setIsAdmin(true);
        setAuthReady(true);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        setIsAdmin(adminDoc.exists() && currentUser.emailVerified);
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Visitor Mode (1-read snapshot + 10m local cache) vs Admin Mode (live multi-collection sync)
  useEffect(() => {
    if (!authReady) return;

    if (!isAdmin) {
      setVisitorRequests([]);
      setAdminUsers([]);
      void loadSingleDocPublicBundle(false);
      return;
    }

    // Admin Mode: attach real-time listeners across source collections + PII collections
    setDataSource('admin-live');
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'church_sections', 'info'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as ChurchInfo;
            setChurchInfo({ ...CHURCH_INFO, ...data });
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

    subscribeSorted<PastorProfile>('pastors', setPastors, PASTORS_TEAM);
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
      setWeekdayMinistries,
      WEEKDAY_MINISTRIES
    );
    subscribeSorted<AnnouncementItem>('announcements', setAnnouncements, ANNOUNCEMENTS);

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

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, isAdmin, loadSingleDocPublicBundle]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
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
          persistLosslessImageIfNeeded(current.churchInfo.heroImage, 180000),
          persistLosslessImageIfNeeded(current.churchInfo.fellowshipImage, 180000),
        ]);
        const resolvedPastors = await Promise.all(
          current.pastors.map(async (p) => ({
            ...p,
            image: (await persistLosslessImageIfNeeded(p.image, 100000)) || PASTORS_TEAM[0].image,
          }))
        );
        const resolvedCoworkers = await Promise.all(
          normalizeCoworkers(current.coworkers).map(async (cw) => ({
            ...cw,
            ...(cw.image ? { image: await persistLosslessImageIfNeeded(cw.image, 50000) } : {}),
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

        const batch = writeBatch(db);
        batch.set(doc(db, 'church_sections', 'info'), {
          ...buildChurchInfoFields(normalizedSnapshot.churchInfo),
          updatedAt: serverTimestamp(),
        });

        for (const p of normalizedSnapshot.pastors) {
          batch.set(doc(db, 'pastors', p.id), {
            name: p.name,
            role: p.role,
            tenure: p.tenure,
            image: p.image,
            education: p.education,
            ministryFocus: p.ministryFocus,
            bio: p.bio,
            sortOrder: p.sortOrder,
            updatedAt: serverTimestamp(),
          });
        }

        for (const cw of normalizedSnapshot.coworkers) {
          batch.set(doc(db, 'coworkers', cw.id), {
            name: cw.name,
            title: cw.title,
            ...(cw.image ? { image: cw.image } : {}),
            sortOrder: cw.sortOrder,
            updatedAt: serverTimestamp(),
          });
        }

        for (const wt of current.worshipTimes) {
          batch.set(doc(db, 'worship_times', wt.id), {
            time: wt.time,
            title: wt.title,
            place: wt.place,
            desc: wt.desc,
            sortOrder: wt.sortOrder,
            updatedAt: serverTimestamp(),
          });
        }

        for (const ls of current.liturgySteps) {
          batch.set(doc(db, 'liturgy_steps', ls.id), {
            liturgyType: ls.liturgyType,
            time: ls.time,
            step: ls.step,
            scriptureOrHymn: ls.scriptureOrHymn,
            leader: ls.leader,
            note: ls.note,
            sortOrder: ls.sortOrder,
            updatedAt: serverTimestamp(),
          });
        }

        for (const song of current.worshipSongs) {
          batch.set(doc(db, 'worship_songs', song.id), {
            title: song.title,
            youtubeUrl: song.youtubeUrl,
            youtubeUrl2: song.youtubeUrl2 || '',
            sortOrder: song.sortOrder,
            updatedAt: serverTimestamp(),
          });
        }

        for (const r of normalizeMinistryRoster(current.ministryRoster)) {
          batch.set(doc(db, 'ministry_roster', r.id), {
            category: r.category,
            role: r.role,
            thisWeek: r.thisWeek,
            nextWeek: r.nextWeek,
            sortOrder: r.sortOrder,
            updatedAt: serverTimestamp(),
          });
        }

        for (const wm of current.weekdayMinistries) {
          batch.set(doc(db, 'weekday_ministries', wm.id), {
            day: wm.day,
            time: wm.time,
            title: wm.title,
            location: wm.location,
            leader: wm.leader,
            description: wm.description,
            sortOrder: wm.sortOrder,
            updatedAt: serverTimestamp(),
          });
        }

        for (const ann of current.announcements) {
          batch.set(doc(db, 'announcements', ann.id), {
            category: ann.category,
            date: ann.date,
            title: ann.title,
            summary: ann.summary,
            time: ann.time,
            location: ann.location,
            contact: ann.contact,
            isFeatured: ann.isFeatured,
            details: ann.details,
            sortOrder: ann.sortOrder,
            updatedAt: serverTimestamp(),
          });
        }

        const bundle = buildPublicBundlePayload(normalizedSnapshot);
        batch.set(doc(db, 'church_sections', 'public_bundle'), {
          ...bundle,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
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

  const saveChurchInfo = useCallback(
    async (info: ChurchInfo) => {
      const path = 'church_sections/info';
      try {
        const [resolvedHeroImage, resolvedFellowshipImage] = await Promise.all([
          persistLosslessImageIfNeeded(info.heroImage, 180000),
          persistLosslessImageIfNeeded(info.fellowshipImage, 180000),
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
        await publishBundleSnapshot({
          ...latestStateRef.current,
          churchInfo: cleaned,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
  );

  const savePastor = useCallback(
    async (item: PastorProfile) => {
      const id = item.id || makeDocId('pastor');
      const path = `pastors/${id}`;
      try {
        const resolvedImage = await persistLosslessImageIfNeeded(item.image, 100000);
        const cleaned: PastorProfile = {
          id,
          name: clampStr(item.name, 80),
          role: clampStr(item.role, 120),
          tenure: clampStr(item.tenure, 60),
          image: sanitizeImageRef(resolvedImage, 120000) || PASTORS_TEAM[0].image,
          education: clampStr(item.education, 200),
          ministryFocus: clampStr(item.ministryFocus, 200),
          bio: clampStr(item.bio, 1200),
          sortOrder: Number(item.sortOrder) || 0,
        };
        const { id: _ignored, ...docBody } = cleaned;
        await setDoc(doc(db, 'pastors', id), {
          ...docBody,
          updatedAt: serverTimestamp(),
        });
        await publishBundleSnapshot({
          ...latestStateRef.current,
          pastors: upsertSorted(latestStateRef.current.pastors, cleaned),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
  );

  const deletePastor = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'pastors', id));
        await publishBundleSnapshot({
          ...latestStateRef.current,
          pastors: removeById(latestStateRef.current.pastors, id),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `pastors/${id}`);
      }
    },
    [publishBundleSnapshot]
  );

  const saveCoworker = useCallback(
    async (item: PulpitCoworker) => {
      const id = item.id || makeDocId('cw');
      const path = `coworkers/${id}`;
      try {
        const resolvedImage = item.image
          ? await persistLosslessImageIfNeeded(item.image, 50000)
          : '';
        const cleanedImage = sanitizeImageRef(resolvedImage, 60000);
        const cleaned: PulpitCoworker = {
          id,
          name: clampStr(item.name, 80),
          title: clampStr(item.title, 120),
          image: cleanedImage,
          sortOrder: Number(item.sortOrder) || 0,
        };
        const { id: _ignored, ...docBody } = cleaned;
        await setDoc(doc(db, 'coworkers', id), {
          ...docBody,
          updatedAt: serverTimestamp(),
        });
        await publishBundleSnapshot({
          ...latestStateRef.current,
          coworkers: upsertSorted(latestStateRef.current.coworkers, cleaned),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
  );

  const deleteCoworker = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'coworkers', id));
        await publishBundleSnapshot({
          ...latestStateRef.current,
          coworkers: removeById(latestStateRef.current.coworkers, id),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `coworkers/${id}`);
      }
    },
    [publishBundleSnapshot]
  );

  const saveWorshipTime = useCallback(
    async (item: WorshipTimeSlot) => {
      const id = item.id || makeDocId('wt');
      const path = `worship_times/${id}`;
      const cleaned: WorshipTimeSlot = {
        id,
        time: clampStr(item.time, 60),
        title: clampStr(item.title, 120),
        place: clampStr(item.place, 120),
        desc: clampStr(item.desc, 300),
        sortOrder: Number(item.sortOrder) || 0,
      };
      try {
        const { id: _ignored, ...docBody } = cleaned;
        await setDoc(doc(db, 'worship_times', id), {
          ...docBody,
          updatedAt: serverTimestamp(),
        });
        await publishBundleSnapshot({
          ...latestStateRef.current,
          worshipTimes: upsertSorted(latestStateRef.current.worshipTimes, cleaned),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
  );

  const deleteWorshipTime = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'worship_times', id));
        await publishBundleSnapshot({
          ...latestStateRef.current,
          worshipTimes: removeById(latestStateRef.current.worshipTimes, id),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `worship_times/${id}`);
      }
    },
    [publishBundleSnapshot]
  );

  const saveLiturgyStep = useCallback(
    async (item: LiturgyStep) => {
      const id = item.id || makeDocId('ls');
      const path = `liturgy_steps/${id}`;
      const cleaned: LiturgyStep = {
        id,
        liturgyType: item.liturgyType,
        time: clampStr(item.time, 40),
        step: clampStr(item.step, 120),
        scriptureOrHymn: clampStr(item.scriptureOrHymn, 200),
        leader: clampStr(item.leader, 100),
        note: clampStr(item.note, 500),
        sortOrder: Number(item.sortOrder) || 0,
      };
      try {
        const { id: _ignored, ...docBody } = cleaned;
        await setDoc(doc(db, 'liturgy_steps', id), {
          ...docBody,
          updatedAt: serverTimestamp(),
        });
        await publishBundleSnapshot({
          ...latestStateRef.current,
          liturgySteps: upsertSorted(latestStateRef.current.liturgySteps, cleaned),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
  );

  const deleteLiturgyStep = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'liturgy_steps', id));
        await publishBundleSnapshot({
          ...latestStateRef.current,
          liturgySteps: removeById(latestStateRef.current.liturgySteps, id),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `liturgy_steps/${id}`);
      }
    },
    [publishBundleSnapshot]
  );

  const saveWorshipSong = useCallback(
    async (item: WorshipSong) => {
      const id = item.id || makeDocId('song');
      const path = `worship_songs/${id}`;
      const cleaned: WorshipSong = {
        id,
        title: clampStr(item.title, 140),
        youtubeUrl: sanitizeYoutubeUrl(item.youtubeUrl),
        youtubeUrl2: sanitizeYoutubeUrl(item.youtubeUrl2),
        sortOrder: Number(item.sortOrder) || 0,
      };
      try {
        const { id: _ignored, ...docBody } = cleaned;
        await setDoc(doc(db, 'worship_songs', id), {
          ...docBody,
          updatedAt: serverTimestamp(),
        });
        await publishBundleSnapshot({
          ...latestStateRef.current,
          worshipSongs: upsertSorted(latestStateRef.current.worshipSongs, cleaned),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
  );

  const deleteWorshipSong = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'worship_songs', id));
        await publishBundleSnapshot({
          ...latestStateRef.current,
          worshipSongs: removeById(latestStateRef.current.worshipSongs, id),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `worship_songs/${id}`);
      }
    },
    [publishBundleSnapshot]
  );

  const saveMinistryRoster = useCallback(
    async (item: MinistryRosterItem) => {
      const id = item.id || makeDocId('roster');
      const path = `ministry_roster/${id}`;
      const cleaned: MinistryRosterItem = {
        id,
        category: normalizeMinistryCategory(item.category),
        role: clampStr(item.role, 140),
        thisWeek: clampStr(item.thisWeek, 200),
        nextWeek: clampStr(item.nextWeek, 200),
        sortOrder: Number(item.sortOrder) || 0,
      };
      try {
        const { id: _ignored, ...docBody } = cleaned;
        await setDoc(doc(db, 'ministry_roster', id), {
          ...docBody,
          updatedAt: serverTimestamp(),
        });
        await publishBundleSnapshot({
          ...latestStateRef.current,
          ministryRoster: upsertSorted(latestStateRef.current.ministryRoster, cleaned),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
  );

  const deleteMinistryRoster = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'ministry_roster', id));
        await publishBundleSnapshot({
          ...latestStateRef.current,
          ministryRoster: removeById(latestStateRef.current.ministryRoster, id),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `ministry_roster/${id}`);
      }
    },
    [publishBundleSnapshot]
  );

  const saveWeekdayMinistry = useCallback(
    async (item: WeekdayMinistry) => {
      const id = item.id || makeDocId('wm');
      const path = `weekday_ministries/${id}`;
      const cleaned: WeekdayMinistry = {
        id,
        day: clampStr(item.day, 20),
        time: clampStr(item.time, 60),
        title: clampStr(item.title, 120),
        location: clampStr(item.location, 160),
        leader: clampStr(item.leader, 120),
        description: clampStr(item.description, 400),
        sortOrder: Number(item.sortOrder) || 0,
      };
      try {
        const { id: _ignored, ...docBody } = cleaned;
        await setDoc(doc(db, 'weekday_ministries', id), {
          ...docBody,
          updatedAt: serverTimestamp(),
        });
        await publishBundleSnapshot({
          ...latestStateRef.current,
          weekdayMinistries: upsertSorted(latestStateRef.current.weekdayMinistries, cleaned),
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
        await deleteDoc(doc(db, 'weekday_ministries', id));
        await publishBundleSnapshot({
          ...latestStateRef.current,
          weekdayMinistries: removeById(latestStateRef.current.weekdayMinistries, id),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `weekday_ministries/${id}`);
      }
    },
    [publishBundleSnapshot]
  );

  const saveAnnouncement = useCallback(
    async (item: AnnouncementItem) => {
      const id = item.id || makeDocId('ann');
      const path = `announcements/${id}`;
      const cleaned: AnnouncementItem = {
        id,
        category: item.category,
        date: clampStr(item.date, 80),
        title: clampStr(item.title, 160),
        summary: clampStr(item.summary, 400),
        time: clampStr(item.time, 100),
        location: clampStr(item.location, 160),
        contact: clampStr(item.contact, 120),
        isFeatured: Boolean(item.isFeatured),
        details: item.details.slice(0, 20).map((d) => clampStr(d, 800)).filter(Boolean),
        sortOrder: Number(item.sortOrder) || 0,
      };
      try {
        const { id: _ignored, ...docBody } = cleaned;
        await setDoc(doc(db, 'announcements', id), {
          ...docBody,
          updatedAt: serverTimestamp(),
        });
        await publishBundleSnapshot({
          ...latestStateRef.current,
          announcements: upsertSorted(latestStateRef.current.announcements, cleaned),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [publishBundleSnapshot]
  );

  const deleteAnnouncement = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'announcements', id));
        await publishBundleSnapshot({
          ...latestStateRef.current,
          announcements: removeById(latestStateRef.current.announcements, id),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `announcements/${id}`);
      }
    },
    [publishBundleSnapshot]
  );

  const submitVisitorRequest = useCallback(
    async (payload: { name: string; contact: string; intent: string; message: string }) => {
      try {
        await addDoc(collection(db, 'visitor_requests'), {
          name: clampStr(payload.name, 80),
          contact: clampStr(payload.contact, 140),
          intent: clampStr(payload.intent, 100),
          message: clampStr(payload.message, 1000),
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
          adminNote: clampStr(adminNote, 500),
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
      const cleanUid = clampStr(uid, 128);
      if (!/^[a-zA-Z0-9_\-]+$/.test(cleanUid)) {
        throw new Error('管理员 UID 格式无效（仅支持字母、数字、下划线或连字符）。');
      }
      try {
        await setDoc(doc(db, 'admins', cleanUid), {
          email: clampStr(email, 160),
          displayName: clampStr(displayName, 80),
          addedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `admins/${cleanUid}`);
      }
    },
    []
  );

  const removeAdminUser = useCallback(async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'admins', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
    }
  }, []);

  return (
    <ChurchDataContext.Provider
      value={{
        churchInfo,
        pastors,
        coworkers,
        worshipTimes,
        liturgySteps,
        worshipSongs,
        ministryRoster,
        weekdayMinistries,
        announcements,
        visitorRequests,
        adminUsers,
        user,
        authReady,
        isAdmin,
        hasCloudData,
        hasPublicBundle,
        cloudLoading,
        dataSource,
        lastSyncedAt,
        signInWithGoogle,
        signOutUser,
        syncModifiedContentToCloud,
        publishPublicBundle,
        refreshPublicSnapshot,
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
        submitVisitorRequest,
        updateVisitorRequestStatus,
        deleteVisitorRequest,
        addAdminUser,
        removeAdminUser,
      }}
    >
      {children}
    </ChurchDataContext.Provider>
  );
}

export function useChurchData() {
  const ctx = useContext(ChurchDataContext);
  if (!ctx) {
    throw new Error('useChurchData must be used inside ChurchDataProvider');
  }
  return ctx;
}
