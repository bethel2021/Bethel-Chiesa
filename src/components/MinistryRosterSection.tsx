import { useMemo, useState } from 'react';
import { usePublicChurchData } from '../context/ChurchDataContext';
import {
  MINISTRY_CATEGORY_LABELS,
  MINISTRY_CATEGORY_OPTIONS,
  type MinistryRosterCategory,
  type MinistryRosterItem,
} from '../data/churchData';

type MomentFilter = 'all' | MinistryRosterCategory;

const MOMENT_TABS: { id: MomentFilter; label: string }[] = [
  { id: 'all', label: '全部精彩瞬间' },
  ...MINISTRY_CATEGORY_OPTIONS,
];

export function MinistryRosterSection() {
  const { weekdayMinistries, ministryRoster } = usePublicChurchData();
  const [activeTab, setActiveTab] = useState<MomentFilter>('all');
  const [selectedMoment, setSelectedMoment] = useState<MinistryRosterItem | null>(null);

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
                    <p className="text-xs text-[var(--theme-ink-muted)]">
                      {wm.description}
                    </p>
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

        {/* Part 2: Church Life Gallery / Fellowship Moments (05) */}
        <div id="moments" className="pt-8 border-t border-[var(--theme-border)]/60">
          <div className="max-w-2xl mb-7 md:mb-8">
            <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
              05. 教会生活剪影
            </p>
            <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
              教会事工精彩瞬间
            </h2>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {MOMENT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-medium rounded-full transition-all cursor-pointer shadow-2xs ${
                  activeTab === tab.id
                    ? 'bg-[var(--theme-accent)] text-white shadow-xs scale-105'
                    : 'bg-[var(--theme-bg)] text-[var(--theme-ink-muted)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-ink)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Photo Moments Grid */}
          {filteredMoments.length === 0 ? (
            <div className="text-center py-12 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl text-sm text-[var(--theme-ink-subtle)]">
              当前分类暂无精彩瞬间照片，请在后台添加。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMoments.map((moment) => (
                <article
                  key={moment.id}
                  onClick={() => setSelectedMoment(moment)}
                  className="group bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-300 flex flex-col cursor-pointer"
                >
                  {/* Image Container */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-[var(--theme-surface-alt)]">
                    <img
                      src={moment.image}
                      alt={moment.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                    <span className="absolute top-3 left-3 px-2.5 py-1 text-[11px] font-medium bg-black/50 backdrop-blur-md text-white rounded-md tracking-wide">
                      {MINISTRY_CATEGORY_LABELS[moment.category] ?? '精彩瞬间'}
                    </span>
                    {moment.schedule && (
                      <div className="absolute bottom-3 left-4 right-4 text-white">
                        <p className="text-xs font-mono text-white/90 drop-shadow-xs">
                          {moment.schedule}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Content Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-editorial text-xl font-semibold text-[var(--theme-ink)] mb-2 group-hover:text-[var(--theme-accent)] transition-colors">
                        {moment.title}
                      </h3>
                      {moment.description && (
                        <p className="text-xs text-[var(--theme-ink-muted)] line-clamp-3 leading-relaxed">
                          {moment.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-[var(--theme-surface-alt)] flex items-center justify-between text-xs font-medium text-[var(--theme-accent)]">
                      <span>查看高清大图</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Moment Detail Modal */}
      {selectedMoment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="moment-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setSelectedMoment(null)}
        >
          <div
            className="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[16/9] bg-[var(--theme-surface-alt)]">
              <img
                src={selectedMoment.image}
                alt={selectedMoment.title}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedMoment(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                aria-label="关闭弹窗"
              >
                ✕
              </button>
              <span className="absolute bottom-4 left-4 px-3 py-1 text-xs font-medium bg-black/60 backdrop-blur-md text-white rounded-md">
                {MINISTRY_CATEGORY_LABELS[selectedMoment.category] ?? '精彩瞬间'}
              </span>
            </div>

            <div className="p-6 md:p-8">
              {selectedMoment.schedule && (
                <span className="inline-block font-mono text-xs text-[var(--theme-accent)] mb-2 font-medium">
                  {selectedMoment.schedule}
                </span>
              )}
              <h3
                id="moment-modal-title"
                className="font-editorial text-2xl md:text-3xl font-semibold text-[var(--theme-ink)] mb-4"
              >
                {selectedMoment.title}
              </h3>
              {selectedMoment.description && (
                <p className="text-sm md:text-base text-[var(--theme-ink-muted)] leading-relaxed mb-6">
                  {selectedMoment.description}
                </p>
              )}
              <div className="flex justify-end pt-4 border-t border-[var(--theme-border)]">
                <button
                  type="button"
                  onClick={() => setSelectedMoment(null)}
                  className="px-5 py-2 text-sm font-medium bg-[var(--theme-accent)] text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                >
                  关闭预览
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
