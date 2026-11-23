import { useState } from 'react';
import { useChurchData } from '../context/ChurchDataContext';
import {
  MINISTRY_CATEGORY_LABELS,
  MINISTRY_CATEGORY_OPTIONS,
  MINISTRY_CATEGORY_ORDER,
  type MinistryRosterCategory,
} from '../data/churchData';

type RosterFilter = 'all' | MinistryRosterCategory;
type WeekMode = 'thisWeek' | 'nextWeek';

const FILTER_TABS: { id: RosterFilter; label: string }[] = [
  { id: 'all', label: '全部事工岗位' },
  ...MINISTRY_CATEGORY_OPTIONS,
];

export function MinistryRosterSection() {
  const { churchInfo, ministryRoster, weekdayMinistries } = useChurchData();
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [weekMode, setWeekMode] = useState<WeekMode>('thisWeek');

  const sortedRoster = [...ministryRoster].sort((a, b) => {
    const catDiff =
      (MINISTRY_CATEGORY_ORDER[a.category] ?? 99) -
      (MINISTRY_CATEGORY_ORDER[b.category] ?? 99);
    return catDiff !== 0 ? catDiff : a.sortOrder - b.sortOrder;
  });

  const filteredRoster =
    filter === 'all'
      ? sortedRoster
      : sortedRoster.filter((item) => item.category === filter);

  return (
    <section
      id="ministry"
      className="py-12 md:py-14 bg-[var(--theme-surface)]/55 border-b border-[var(--theme-border)] transition-colors duration-300"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Part 1: Sunday Ministry Roster */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-7">
          <div className="max-w-2xl">
            <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
              04. 肢体服事与周间聚会
            </p>
            <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
              主日事工岗位安排（含主日学及团契）
            </h2>
          </div>

          {/* Week Switcher */}
          <div
            role="group"
            aria-label="切换本周与下周轮值安排"
            className="inline-flex items-center gap-1 p-1 bg-[var(--theme-surface-strong)] rounded-md self-start lg:self-auto shrink-0"
          >
            <button
              type="button"
              onClick={() => setWeekMode('thisWeek')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                weekMode === 'thisWeek'
                  ? 'bg-[var(--theme-bg)] text-[var(--theme-ink)] shadow-xs'
                  : 'text-[var(--theme-ink-muted)] hover:text-[var(--theme-ink)]'
              }`}
            >
              {churchInfo.thisWeekLabel}
            </button>
            <button
              type="button"
              onClick={() => setWeekMode('nextWeek')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                weekMode === 'nextWeek'
                  ? 'bg-[var(--theme-bg)] text-[var(--theme-ink)] shadow-xs'
                  : 'text-[var(--theme-ink-muted)] hover:text-[var(--theme-ink)]'
              }`}
            >
              {churchInfo.nextWeekLabel}
            </button>
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 mb-6">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] ${
                filter === tab.id
                  ? 'bg-[var(--theme-accent)] text-white'
                  : 'bg-[var(--theme-bg)] text-[var(--theme-ink-muted)] border border-[var(--theme-border)] hover:text-[var(--theme-ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Clean Institutional Roster Table */}
        <div className="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg overflow-hidden mb-10">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-[var(--theme-surface-alt)]/70 border-b border-[var(--theme-border)] text-xs font-medium text-[var(--theme-ink-muted)]">
            <div className="col-span-3">事工分类</div>
            <div className="col-span-4">岗位 / 课程名称</div>
            <div className="col-span-5">
              {weekMode === 'thisWeek'
                ? `本周值班同工（${churchInfo.thisWeekLabel}）`
                : `下周值班同工（${churchInfo.nextWeekLabel}）`}
            </div>
          </div>

          <div className="divide-y divide-[var(--theme-surface-alt)]">
            {filteredRoster.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[var(--theme-ink-subtle)]">
                当前分类暂无排班记录。
              </div>
            ) : (
              filteredRoster.map((item) => {
                const assignee = weekMode === 'thisWeek' ? item.thisWeek : item.nextWeek;
                return (
                  <div
                    key={item.id}
                    className="px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-baseline text-sm hover:bg-[var(--theme-surface)]/45 transition-colors"
                  >
                    <div className="md:col-span-3 text-xs text-[var(--theme-ink-subtle)]">
                      {MINISTRY_CATEGORY_LABELS[item.category] ?? '讲台与敬拜'}
                    </div>
                    <div className="md:col-span-4 font-medium text-[var(--theme-ink)]">
                      {item.role}
                    </div>
                    <div className="md:col-span-5 font-medium text-[var(--theme-accent)]">
                      {assignee}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Part 2: Weekday Ministries */}
        <div className="pt-2">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
            <div className="max-w-2xl">
              <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
                05. 平日牧养与社区守望
              </p>
              <h3 className="font-editorial text-2xl md:text-3xl font-semibold text-[var(--theme-ink)] tracking-tight">
                周间事工安排
              </h3>
            </div>
            <p className="text-sm text-[var(--theme-ink-muted)] max-w-md">
              除主日崇拜外，教会于周二至周六持续开展查经祷告、诗班排练、小组查经与社区长者探访。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
            {weekdayMinistries.map((wm) => (
              <article
                key={wm.id}
                className="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2 pb-3 mb-3 border-b border-[var(--theme-surface-alt)]">
                    <span className="font-editorial text-xl font-semibold text-[var(--theme-accent)]">
                      {wm.day}
                    </span>
                    <span className="font-mono text-xs text-[var(--theme-ink-muted)] tabular-nums">
                      {wm.time}
                    </span>
                  </div>

                  <h4 className="font-editorial text-base font-semibold text-[var(--theme-ink)] mb-2">
                    {wm.title}
                  </h4>

                  <p className="text-xs text-[var(--theme-ink-muted)] leading-relaxed mb-4">
                    {wm.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--theme-surface-alt)] space-y-1 text-xs text-[var(--theme-ink-subtle)]">
                  <p>地点：{wm.location}</p>
                  <p>负责：{wm.leader}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
