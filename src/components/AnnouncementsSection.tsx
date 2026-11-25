import { useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, CalendarClock, MapPin, UserCheck, X } from 'lucide-react';
import { usePublicChurchData } from '../context/ChurchDataContext';
import type { AnnouncementItem } from '../data/churchData';
import { ModalDialog } from './ModalDialog';
import { SafeImage } from './SafeImage';

type CategoryFilter = '全部' | AnnouncementItem['category'];

const CATEGORIES: CategoryFilter[] = [
  '全部',
  '特别聚会',
  '洗礼与课程',
  '诗班与事奉',
  '社区关怀',
];

interface AnnouncementsSectionProps {
  selectedAnnouncementId?: string | null;
  onSelectAnnouncement?: (item: AnnouncementItem | null) => void;
}

export function AnnouncementsSection({
  selectedAnnouncementId,
  onSelectAnnouncement,
}: AnnouncementsSectionProps = {}) {
  const { announcements, cloudLoading } = usePublicChurchData();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('全部');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  const isControlled = typeof onSelectAnnouncement === 'function';
  const effectiveSelectedId = isControlled ? selectedAnnouncementId : localSelectedId;

  const activeAnnouncement = useMemo(
    () =>
      effectiveSelectedId
        ? announcements.find((item) => item.id === effectiveSelectedId) ?? null
        : null,
    [announcements, effectiveSelectedId]
  );

  const openAnnouncement = (item: AnnouncementItem) => {
    if (isControlled) {
      onSelectAnnouncement(item);
    } else {
      setLocalSelectedId(item.id);
    }
  };

  const closeAnnouncement = () => {
    if (isControlled) {
      onSelectAnnouncement(null);
    } else {
      setLocalSelectedId(null);
    }
  };

  const handleCardKeyDown = (e: KeyboardEvent<HTMLElement>, item: AnnouncementItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openAnnouncement(item);
    }
  };

  const visibleAnnouncements = useMemo(
    () =>
      selectedCategory === '全部'
        ? announcements
        : announcements.filter((item) => item.category === selectedCategory),
    [announcements, selectedCategory]
  );

  const featuredItem = useMemo(
    () =>
      selectedCategory === '全部'
        ? visibleAnnouncements.find((item) => item.isFeatured) || visibleAnnouncements[0]
        : visibleAnnouncements[0],
    [selectedCategory, visibleAnnouncements]
  );

  const remainingItems = useMemo(
    () => visibleAnnouncements.filter((item) => item.id !== featuredItem?.id),
    [visibleAnnouncements, featuredItem?.id]
  );

  const modalDescriptionParagraphs = useMemo(() => {
    if (!activeAnnouncement) return [];
    const summaryText = activeAnnouncement.summary.trim();
    const detailParagraphs = activeAnnouncement.details
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && p !== summaryText);
    return summaryText ? [summaryText, ...detailParagraphs] : detailParagraphs;
  }, [activeAnnouncement]);

  if (cloudLoading && announcements.length === 0) {
    return (
      <section id="announcements" className="py-12 md:py-14 border-b border-[var(--theme-border)]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-7">
            <div className="max-w-2xl">
              <div className="w-32 h-3 bg-[var(--theme-ink)]/10 rounded animate-pulse mb-2" />
              <div className="w-48 h-9 bg-[var(--theme-ink)]/15 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-20 h-8 bg-[var(--theme-ink)]/10 rounded-md animate-pulse" />
              ))}
            </div>
          </div>

          <div className="bg-[var(--theme-surface)]/80 border border-[var(--theme-border)] rounded-lg p-6 md:p-8 mb-8 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-16 h-3 bg-[var(--theme-ink)]/15 rounded" />
              <div className="w-3 h-3 rounded-full bg-[var(--theme-ink)]/10" />
              <div className="w-20 h-3 bg-[var(--theme-ink)]/15 rounded" />
            </div>
            <div className="w-3/4 h-8 bg-[var(--theme-ink)]/20 rounded mb-3" />
            <div className="w-full h-4 bg-[var(--theme-ink)]/15 rounded mb-2" />
            <div className="w-2/3 h-4 bg-[var(--theme-ink)]/15 rounded mb-4" />
            <div className="w-48 h-4 bg-[var(--theme-ink)]/10 rounded mb-6" />
            <div className="w-36 h-10 bg-[var(--theme-ink)]/20 rounded-md" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg p-6 animate-pulse">
                <div className="w-24 h-3 bg-[var(--theme-ink)]/15 rounded mb-3" />
                <div className="w-4/5 h-6 bg-[var(--theme-ink)]/20 rounded mb-2.5" />
                <div className="w-full h-4 bg-[var(--theme-ink)]/15 rounded mb-2" />
                <div className="w-3/4 h-4 bg-[var(--theme-ink)]/15 rounded mb-5" />
                <div className="pt-4 border-t border-[var(--theme-surface-alt)] flex items-center justify-between">
                  <div className="w-32 h-3 bg-[var(--theme-ink)]/10 rounded" />
                  <div className="w-16 h-3 bg-[var(--theme-ink)]/15 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="announcements" className="py-12 md:py-14 border-b border-[var(--theme-border)]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header + Category Filter */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-7">
          <div className="max-w-2xl">
            <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
              06. 近期动态与家事报道
            </p>
            <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
              最新聚会公告
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] ${
                  selectedCategory === category
                    ? 'bg-[var(--theme-accent)] text-white'
                    : 'bg-[var(--theme-surface)] text-[var(--theme-ink-muted)] hover:text-[var(--theme-ink)]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Tier 1: Lead Announcement */}
        {featuredItem && (
          <article
            role="button"
            tabIndex={0}
            aria-label={`查看公告详情：${featuredItem.title}`}
            onClick={() => openAnnouncement(featuredItem)}
            onKeyDown={(e) => handleCardKeyDown(e, featuredItem)}
            className="group bg-[var(--theme-surface)]/80 hover:bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)]/45 rounded-lg p-6 md:p-8 mb-8 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              <div className={featuredItem.image ? 'lg:col-span-7' : 'lg:col-span-8'}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--theme-ink-subtle)] mb-2">
                  <span className="font-medium text-[var(--theme-gold)]">重点公告</span>
                  <span aria-hidden="true">·</span>
                  <span>{featuredItem.category}</span>
                </div>

                <h3 className="font-editorial text-2xl md:text-3xl font-semibold text-[var(--theme-ink)] group-hover:text-[var(--theme-accent)] transition-colors mb-2">
                  {featuredItem.title}
                </h3>

                <p className="text-base text-[var(--theme-ink-body)] leading-relaxed mb-3 max-w-2xl">
                  {featuredItem.summary}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--theme-ink-muted)] mb-4">
                  <span className="tabular-nums">时间：{featuredItem.time}</span>
                  <span aria-hidden="true">·</span>
                  <span>地点：{featuredItem.location}</span>
                  <span aria-hidden="true">·</span>
                  <span>联系：{featuredItem.contact}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAnnouncement(featuredItem);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-[var(--theme-accent)] hover:bg-[var(--theme-accent-hover)] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2"
                >
                  <span>查看活动详情与日程</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>

              {featuredItem.image && (
                <div className="lg:col-span-5">
                  <div className="aspect-[16/10] w-full overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)]">
                    <SafeImage
                      src={featuredItem.image}
                      alt={featuredItem.title}
                      fallbackLabel={featuredItem.title}
                      fitMode="auto-contain-portrait"
                      className="w-full h-full group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                </div>
              )}
            </div>
          </article>
        )}

        {/* Tier 2: Secondary Announcements Grid */}
        {remainingItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {remainingItems.map((item) => (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`查看公告详情：${item.title}`}
                onClick={() => openAnnouncement(item)}
                onKeyDown={(e) => handleCardKeyDown(e, item)}
                className="group bg-[var(--theme-bg)] hover:bg-[var(--theme-surface)]/45 border border-[var(--theme-border)] hover:border-[var(--theme-accent)]/45 rounded-lg p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]"
              >
                <div>
                  {item.image && (
                    <div className="aspect-[16/9] w-full overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)]/45 mb-3">
                      <SafeImage
                        src={item.image}
                        alt={item.title}
                        fallbackLabel={item.title}
                        fitMode="auto-contain-portrait"
                        className="w-full h-full group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-[var(--theme-ink-subtle)] mb-1.5">
                    <span className="text-[var(--theme-accent)] font-medium">{item.category}</span>
                  </div>

                  <h3 className="font-editorial text-xl font-semibold text-[var(--theme-ink)] group-hover:text-[var(--theme-accent)] transition-colors mb-2">
                    {item.title}
                  </h3>

                  <p className="text-sm text-[var(--theme-ink-muted)] leading-relaxed mb-3">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-4 border-t border-[var(--theme-surface-alt)] flex items-center justify-between gap-4">
                  <span className="text-xs text-[var(--theme-ink-subtle)] truncate tabular-nums">
                    {item.time} · {item.location}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAnnouncement(item);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--theme-accent)] group-hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer py-1"
                  >
                    <span>查看详情</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Announcement Detail Modal */}
      {activeAnnouncement && (
        <ModalDialog
          labelledBy="announcement-modal-title"
          maxWidthClass="max-w-2xl"
          overlayClassName="bg-[#141210]/60 backdrop-blur-[2px]"
          containerClassName="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg max-h-[88vh] overflow-y-auto p-6 md:p-8 shadow-xl"
          onClose={closeAnnouncement}
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--theme-border)]">
            <div>
              <p className="text-xs text-[var(--theme-ink-subtle)] mb-1.5 flex flex-wrap items-center gap-2">
                {activeAnnouncement.isFeatured && (
                  <>
                    <span className="font-medium text-[var(--theme-gold)]">重点公告</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="font-medium text-[var(--theme-accent)]">
                  {activeAnnouncement.category}
                </span>
              </p>
              <h3
                id="announcement-modal-title"
                className="font-editorial text-2xl md:text-[1.75rem] font-semibold text-[var(--theme-ink)] leading-snug"
              >
                {activeAnnouncement.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeAnnouncement}
              aria-label="关闭公告详情"
              className="w-9 h-9 inline-flex items-center justify-center rounded-md text-[var(--theme-ink-muted)] hover:text-[var(--theme-ink)] hover:bg-[var(--theme-surface-alt)] transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Activity Photo */}
          <div className="mt-5 aspect-[16/9] w-full overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)]/45">
            <SafeImage
              src={activeAnnouncement.image || ''}
              alt={activeAnnouncement.title}
              fallbackLabel={activeAnnouncement.title}
              priority
              fitMode="auto-contain-portrait"
              className="w-full h-full"
            />
          </div>

          {/* Detailed Time & Venue Schedule */}
          <dl className="mt-5 bg-[var(--theme-surface)]/70 border border-[var(--theme-border)] rounded-md p-4 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3.5 text-xs">

            <div className="flex items-start gap-2.5">
              <CalendarClock
                aria-hidden="true"
                className="w-4 h-4 text-[var(--theme-gold)] shrink-0 mt-0.5"
              />
              <div>
                <dt className="text-[var(--theme-ink-subtle)] mb-0.5">具体时间安排</dt>
                <dd className="text-[var(--theme-ink)] font-medium tabular-nums">
                  {activeAnnouncement.time}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin
                aria-hidden="true"
                className="w-4 h-4 text-[var(--theme-accent)] shrink-0 mt-0.5"
              />
              <div>
                <dt className="text-[var(--theme-ink-subtle)] mb-0.5">聚会地点</dt>
                <dd className="text-[var(--theme-ink)] font-medium">
                  {activeAnnouncement.location}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <UserCheck
                aria-hidden="true"
                className="w-4 h-4 text-[var(--theme-accent)] shrink-0 mt-0.5"
              />
              <div>
                <dt className="text-[var(--theme-ink-subtle)] mb-0.5">负责联系人</dt>
                <dd className="text-[var(--theme-ink)] font-medium">
                  {activeAnnouncement.contact}
                </dd>
              </div>
            </div>
          </dl>

          {/* Full Description */}
          <div className="py-5 space-y-3 text-[15px] text-[var(--theme-ink-body)] leading-relaxed">
            {modalDescriptionParagraphs.map((paragraph, idx) => (
              <p key={idx} className={idx === 0 ? 'font-medium text-[var(--theme-ink)]' : undefined}>
                {paragraph}
              </p>
            ))}
          </div>

          <div className="pt-4 border-t border-[var(--theme-border)] flex items-center justify-end">
            <button
              type="button"
              onClick={closeAnnouncement}
              className="px-4 py-2 text-xs font-medium text-white bg-[var(--theme-accent)] hover:bg-[var(--theme-accent-hover)] rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </ModalDialog>
      )}
    </section>
  );
}
