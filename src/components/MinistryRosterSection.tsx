import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from 'react';
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { usePublicChurchData } from '../context/ChurchDataContext';
import {
  MINISTRY_CATEGORY_LABELS,
  MINISTRY_CATEGORY_OPTIONS,
  type MinistryRosterCategory,
  type MinistryRosterItem,
} from '../data/churchData';
import { filterSafeImageSrc } from '../utils/urlSafety';
import { SafeImage } from './SafeImage';

type MomentFilter = 'all' | MinistryRosterCategory;

const MOMENT_TABS: { id: MomentFilter; label: string }[] = [
  { id: 'all', label: '全部专题相册' },
  ...MINISTRY_CATEGORY_OPTIONS,
];

const INITIAL_VISIBLE_ALBUMS = 7;

function getAlbumPhotos(item: MinistryRosterItem): string[] {
  const rawList = [item.image, ...(item.galleryImages ?? [])];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of rawList) {
    const safe = filterSafeImageSrc(src, '');
    if (!safe || seen.has(safe)) continue;
    seen.add(safe);
    out.push(safe);
  }
  return out;
}

function computeMagazineSpans(remainingCount: number): number[] {
  if (remainingCount <= 0) return [];
  if (remainingCount === 1) return [12];
  if (remainingCount === 3) return [4, 4, 4];

  const spans: number[] = [];
  let left = remainingCount;
  let pairIndex = 0;

  while (left > 0) {
    if (left === 3) {
      spans.push(4, 4, 4);
      left = 0;
    } else if (left >= 2) {
      if (pairIndex % 2 === 0) {
        spans.push(7, 5);
      } else {
        spans.push(5, 7);
      }
      left -= 2;
      pairIndex += 1;
    } else {
      spans.push(12);
      left = 0;
    }
  }
  return spans;
}

function spanToColClass(span: number): string {
  switch (span) {
    case 12:
      return 'md:col-span-2 lg:col-span-12';
    case 7:
      return 'md:col-span-1 lg:col-span-7';
    case 5:
      return 'md:col-span-1 lg:col-span-5';
    default:
      return 'md:col-span-1 lg:col-span-4';
  }
}

interface AlbumCollageProps {
  title: string;
  photos: string[];
  variant: 'lead' | 'wide' | 'compact';
  onOpenAt: (photoIndex: number) => void;
}

function AlbumCoverCollage({ title, photos, variant, onOpenAt }: AlbumCollageProps) {
  const aspectHeightClass =
    variant === 'lead'
      ? 'aspect-[16/10] lg:aspect-auto lg:min-h-[340px] lg:h-full'
      : variant === 'wide'
      ? 'aspect-[16/10]'
      : 'aspect-[4/3]';

  if (photos.length <= 1) {
    const src = photos[0] ?? '';
    return (
      <button
        type="button"
        onClick={() => onOpenAt(0)}
        className={`group/img relative block w-full ${aspectHeightClass} overflow-hidden bg-[var(--theme-surface-alt)] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]`}
        aria-label={`打开「${title}」照片预览`}
      >
        <SafeImage
          src={src}
          alt={title}
          className="w-full h-full object-cover object-top group-hover/img:scale-[1.03] transition-transform duration-500"
        />
      </button>
    );
  }

  if (photos.length === 2) {
    return (
      <div
        className={`grid grid-cols-12 gap-1 bg-[var(--theme-surface-alt)] ${aspectHeightClass} overflow-hidden`}
      >
        <button
          type="button"
          onClick={() => onOpenAt(0)}
          className="col-span-7 relative h-full overflow-hidden group/p0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--theme-accent)]"
          aria-label={`查看「${title}」第 1 张照片`}
        >
          <SafeImage
            src={photos[0]}
            alt={`${title} 封面`}
            className="w-full h-full object-cover object-top group-hover/p0:scale-[1.03] transition-transform duration-500"
          />
        </button>
        <button
          type="button"
          onClick={() => onOpenAt(1)}
          className="col-span-5 relative h-full overflow-hidden group/p1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--theme-accent)]"
          aria-label={`查看「${title}」第 2 张照片`}
        >
          <SafeImage
            src={photos[1]}
            alt={`${title} 照片 2`}
            className="w-full h-full object-cover object-top group-hover/p1:scale-[1.03] transition-transform duration-500"
          />
        </button>
      </div>
    );
  }

  const extraCount = photos.length - 3;

  return (
    <div
      className={`grid grid-cols-12 gap-1 bg-[var(--theme-surface-alt)] ${aspectHeightClass} overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => onOpenAt(0)}
        className="col-span-8 relative h-full overflow-hidden group/p0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--theme-accent)]"
        aria-label={`查看「${title}」主封面照片`}
      >
        <SafeImage
          src={photos[0]}
          alt={`${title} 主封面`}
          className="w-full h-full object-cover object-top group-hover/p0:scale-[1.03] transition-transform duration-500"
        />
      </button>
      <div className="col-span-4 grid grid-rows-2 gap-1 h-full">
        <button
          type="button"
          onClick={() => onOpenAt(1)}
          className="relative w-full h-full overflow-hidden group/p1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--theme-accent)]"
          aria-label={`查看「${title}」第 2 张照片`}
        >
          <SafeImage
            src={photos[1]}
            alt={`${title} 照片 2`}
            className="w-full h-full object-cover object-top group-hover/p1:scale-[1.04] transition-transform duration-500"
          />
        </button>
        <button
          type="button"
          onClick={() => onOpenAt(2)}
          className="relative w-full h-full overflow-hidden group/p2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--theme-accent)]"
          aria-label={`查看「${title}」第 3 张照片，共 ${photos.length} 张`}
        >
          <SafeImage
            src={photos[2]}
            alt={`${title} 照片 3`}
            className="w-full h-full object-cover object-top group-hover/p2:scale-[1.04] transition-transform duration-500"
          />
          {extraCount > 0 && (
            <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-xs font-mono font-semibold tracking-wide tabular-nums">
              +{extraCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export function MinistryRosterSection() {
  const { weekdayMinistries, ministryRoster } = usePublicChurchData();
  const [activeTab, setActiveTab] = useState<MomentFilter>('all');
  const [showAllAlbums, setShowAllAlbums] = useState(false);

  const [lightboxState, setLightboxState] = useState<{
    album: MinistryRosterItem;
    photos: string[];
    index: number;
  } | null>(null);

  const touchStartXRef = useRef<number | null>(null);

  const sortedMoments = useMemo(
    () => [...ministryRoster].sort((a, b) => a.sortOrder - b.sortOrder),
    [ministryRoster]
  );

  const filteredMoments = useMemo(
    () =>
      activeTab === 'all'
        ? sortedMoments
        : sortedMoments.filter((m) => m.category === activeTab),
    [activeTab, sortedMoments]
  );

  const visibleMoments = useMemo(
    () =>
      showAllAlbums ? filteredMoments : filteredMoments.slice(0, INITIAL_VISIBLE_ALBUMS),
    [filteredMoments, showAllAlbums]
  );

  const openLightbox = useCallback((album: MinistryRosterItem, startIndex = 0) => {
    const photos = getAlbumPhotos(album);
    if (photos.length === 0) return;
    const bounded = Math.max(0, Math.min(startIndex, photos.length - 1));
    setLightboxState({ album, photos, index: bounded });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxState(null);
  }, []);

  const stepLightbox = useCallback((delta: -1 | 1) => {
    setLightboxState((prev) => {
      if (!prev || prev.photos.length <= 1) return prev;
      const total = prev.photos.length;
      const nextIndex = (prev.index + delta + total) % total;
      return { ...prev, index: nextIndex };
    });
  }, []);

  useEffect(() => {
    if (!lightboxState) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepLightbox(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepLightbox(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [Boolean(lightboxState), closeLightbox, stepLightbox]);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (typeof endX !== 'number') return;
    const diff = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(diff) >= 45) {
      stepLightbox(diff > 0 ? -1 : 1);
    }
  };

  const hasLeadSpread = visibleMoments.length >= 3;
  const leadAlbum = hasLeadSpread ? visibleMoments[0] : null;
  const gridAlbums = hasLeadSpread ? visibleMoments.slice(1) : visibleMoments;
  const gridSpans = computeMagazineSpans(gridAlbums.length);

  return (
    <section
      id="ministry"
      className="py-14 md:py-20 bg-[var(--theme-surface)]/40 border-b border-[var(--theme-border)] transition-colors duration-300"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Part 1: Weekday Ministries & Gatherings (04) */}
        <div className="mb-16">
          <div className="max-w-2xl mb-7 md:mb-8">
            <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
              04. 周间牧养与守望时间表
            </p>
            <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
              周间事工安排
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {weekdayMinistries.map((wm) => (
              <div
                key={wm.id}
                className="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg px-6 py-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 hover:border-[var(--theme-accent)] transition-all"
              >
                <div>
                  <h4 className="font-editorial text-lg font-semibold text-[var(--theme-ink)] mb-0.5">
                    {wm.title}
                  </h4>
                  {wm.description && (
                    <p className="text-xs text-[var(--theme-ink-muted)]">{wm.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-[var(--theme-surface-alt)] text-[var(--theme-accent)] rounded-md tabular-nums">
                    {wm.day} {wm.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Part 2: Magazine Editorial Album Grid (05) */}
        <div id="moments" className="pt-10 border-t border-[var(--theme-border)]/70">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
                05. 教会生活剪影
              </p>
              <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
                教会事工精彩瞬间
              </h2>
            </div>
            {filteredMoments.length > 0 && (
              <p className="text-xs text-[var(--theme-ink-subtle)] tabular-nums">
                共收录 {filteredMoments.length} 个活动专题相册 · 点击封面可翻页浏览大图
              </p>
            )}
          </div>

          {/* Interactive Category Filter Controls */}
          <div
            role="tablist"
            aria-label="事工精彩瞬间分类"
            className="flex flex-wrap items-center gap-2 mb-9"
          >
            {MOMENT_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowAllAlbums(false);
                  }}
                  className={`min-h-[40px] px-4 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)] ${
                    active
                      ? 'bg-[var(--theme-accent)] text-white shadow-xs'
                      : 'bg-[var(--theme-bg)] text-[var(--theme-ink-muted)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-ink)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Staggered Editorial Album Grid */}
          {visibleMoments.length === 0 ? (
            <div className="text-center py-12 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl text-sm text-[var(--theme-ink-subtle)]">
              当前分类暂无活动专题相册，请在后台管理中添加。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-7">
              {/* Featured Magazine Lead Spread (when 3+ albums exist) */}
              {leadAlbum && (() => {
                const leadPhotos = getAlbumPhotos(leadAlbum);
                const categoryName = MINISTRY_CATEGORY_LABELS[leadAlbum.category] ?? '精彩瞬间';
                const metaParts = [
                  categoryName,
                  leadAlbum.schedule || undefined,
                  `共 ${leadPhotos.length} 张`,
                ].filter(Boolean);

                return (
                  <article
                    key={leadAlbum.id}
                    className="md:col-span-2 lg:col-span-12 group bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-shadow duration-300 grid grid-cols-1 lg:grid-cols-12"
                  >
                    <div className="lg:col-span-7">
                      <AlbumCoverCollage
                        title={leadAlbum.title}
                        photos={leadPhotos}
                        variant="lead"
                        onOpenAt={(idx) => openLightbox(leadAlbum, idx)}
                      />
                    </div>
                    <div className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between">
                      <div>
                        <p className="text-xs tracking-wide text-[var(--theme-ink-subtle)] mb-3 tabular-nums">
                          {metaParts.join(' · ')}
                        </p>
                        <h3 className="font-editorial text-2xl md:text-3xl font-semibold text-[var(--theme-ink)] leading-snug mb-4">
                          <button
                            type="button"
                            onClick={() => openLightbox(leadAlbum, 0)}
                            className="text-left hover:text-[var(--theme-accent)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]"
                          >
                            {leadAlbum.title}
                          </button>
                        </h3>
                        {leadAlbum.description && (
                          <p className="text-sm text-[var(--theme-ink-muted)] leading-relaxed line-clamp-5">
                            {leadAlbum.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-6 pt-4 border-t border-[var(--theme-border)]/70 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => openLightbox(leadAlbum, 0)}
                          className="inline-flex items-center gap-2 min-h-[40px] text-xs font-medium text-[var(--theme-accent)] hover:underline underline-offset-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]"
                        >
                          <Images className="w-4 h-4" />
                          <span>
                            {leadPhotos.length > 1
                              ? `浏览完整专题相册（${leadPhotos.length} 张）`
                              : '查看高清大图'}
                          </span>
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })()}

              {/* Staggered Asymmetric Grid Rows */}
              {gridAlbums.map((moment, idx) => {
                const span = gridSpans[idx] ?? 4;
                const colClass = spanToColClass(span);
                const photos = getAlbumPhotos(moment);
                const categoryName = MINISTRY_CATEGORY_LABELS[moment.category] ?? '精彩瞬间';
                const metaParts = [
                  categoryName,
                  moment.schedule || undefined,
                  photos.length > 1 ? `共 ${photos.length} 张` : undefined,
                ].filter(Boolean);

                return (
                  <article
                    key={moment.id}
                    className={`${colClass} group bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-shadow duration-300 flex flex-col`}
                  >
                    <AlbumCoverCollage
                      title={moment.title}
                      photos={photos}
                      variant={span >= 7 ? 'wide' : 'compact'}
                      onOpenAt={(photoIdx) => openLightbox(moment, photoIdx)}
                    />
                    <div className="p-5 md:p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs tracking-wide text-[var(--theme-ink-subtle)] mb-2 tabular-nums">
                          {metaParts.join(' · ')}
                        </p>
                        <h3 className="font-editorial text-xl font-semibold text-[var(--theme-ink)] leading-snug mb-2">
                          <button
                            type="button"
                            onClick={() => openLightbox(moment, 0)}
                            className="text-left hover:text-[var(--theme-accent)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]"
                          >
                            {moment.title}
                          </button>
                        </h3>
                        {moment.description && (
                          <p className="text-xs md:text-sm text-[var(--theme-ink-muted)] line-clamp-3 leading-relaxed">
                            {moment.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-[var(--theme-surface-alt)] flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => openLightbox(moment, 0)}
                          className="inline-flex items-center gap-1.5 min-h-[36px] text-xs font-medium text-[var(--theme-accent)] hover:underline underline-offset-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]"
                        >
                          <span>{photos.length > 1 ? '打开相册预览' : '查看高清大图'}</span>
                          <span
                            aria-hidden="true"
                            className="group-hover:translate-x-0.5 transition-transform"
                          >
                            →
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Load More Albums Toggle */}
          {filteredMoments.length > INITIAL_VISIBLE_ALBUMS && !showAllAlbums && (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setShowAllAlbums(true)}
                className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 text-xs font-medium text-[var(--theme-ink)] bg-[var(--theme-bg)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] rounded-full transition-colors cursor-pointer"
              >
                展开更多活动相册（剩余 {filteredMoments.length - INITIAL_VISIBLE_ALBUMS} 个）
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Carousel Modal */}
      {lightboxState && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-album-title"
          className="fixed inset-0 z-50 flex flex-col bg-[#0E1014]/95 text-white backdrop-blur-sm animate-fade-in"
          onClick={closeLightbox}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between gap-4 px-4 md:px-8 py-4 border-b border-white/10 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <p className="text-xs text-white/70 truncate tabular-nums">
                {[
                  MINISTRY_CATEGORY_LABELS[lightboxState.album.category] ?? '精彩瞬间',
                  lightboxState.album.schedule || undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h3
                id="lightbox-album-title"
                className="font-editorial text-lg md:text-xl font-semibold text-white truncate"
              >
                {lightboxState.album.title}
              </h3>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <span className="font-mono text-xs md:text-sm text-white/80 tabular-nums">
                {lightboxState.index + 1} / {lightboxState.photos.length}
              </span>
              <button
                type="button"
                onClick={closeLightbox}
                aria-label="关闭相册预览"
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Photo Stage */}
          <div
            className="relative flex-1 min-h-0 flex items-center justify-center px-3 md:px-16 py-4 select-none"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {lightboxState.photos.length > 1 && (
              <button
                type="button"
                onClick={() => stepLightbox(-1)}
                aria-label="上一张照片"
                className="absolute left-2 md:left-5 z-10 w-11 h-11 rounded-full bg-black/55 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="max-w-5xl max-h-full w-full h-full flex items-center justify-center">
              <img
                key={lightboxState.photos[lightboxState.index]}
                src={lightboxState.photos[lightboxState.index]}
                alt={`${lightboxState.album.title} - 第 ${lightboxState.index + 1} 张`}
                referrerPolicy="no-referrer"
                className="max-h-[62vh] md:max-h-[68vh] max-w-full w-auto h-auto object-contain rounded-sm shadow-2xl"
              />
            </div>

            {lightboxState.photos.length > 1 && (
              <button
                type="button"
                onClick={() => stepLightbox(1)}
                aria-label="下一张照片"
                className="absolute right-2 md:right-5 z-10 w-11 h-11 rounded-full bg-black/55 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Caption + Thumbnail Strip Footer */}
          <div
            className="px-4 md:px-8 pb-5 pt-3 border-t border-white/10 space-y-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxState.album.description && (
              <p className="text-xs md:text-sm text-white/80 max-w-3xl mx-auto text-center leading-relaxed line-clamp-2">
                {lightboxState.album.description}
              </p>
            )}

            {lightboxState.photos.length > 1 && (
              <div
                aria-label="相册缩略图导航"
                className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto py-1"
              >
                {lightboxState.photos.map((photoSrc, idx) => {
                  const isCurrent = idx === lightboxState.index;
                  return (
                    <button
                      key={`${idx}-${photoSrc.slice(0, 24)}`}
                      type="button"
                      onClick={() =>
                        setLightboxState((prev) => (prev ? { ...prev, index: idx } : prev))
                      }
                      aria-label={`切换到第 ${idx + 1} 张照片`}
                      aria-current={isCurrent ? 'true' : undefined}
                      className={`relative w-14 h-10 md:w-16 md:h-12 rounded-sm overflow-hidden shrink-0 cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                        isCurrent
                          ? 'ring-2 ring-white opacity-100 scale-105'
                          : 'opacity-50 hover:opacity-85'
                      }`}
                    >
                      <SafeImage
                        src={photoSrc}
                        alt={`缩略图 ${idx + 1}`}
                        className="w-full h-full object-cover object-top"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
