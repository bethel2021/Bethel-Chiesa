import { useState } from 'react';
import { useChurchData } from '../context/ChurchDataContext';

type RosterFilter = 'all' | 'worship' | 'sunday-school' | 'fellowship';
type WeekMode = 'thisWeek' | 'nextWeek';

const FILTER_TABS: { id: RosterFilter; label: string }[] = [
  { id: 'all', label: '全部事工岗位' },
  { id: 'worship', label: '敬拜与后勤服事' },
  { id: 'sunday-school', label: '儿童主日学' },
  { id: 'fellowship', label: '主日及周末团契' },
];

const CATEGORY_LABELS: Record<'worship' | 'sunday-school' | 'fellowship', string> = {
  worship: '敬拜与后勤',
  'sunday-school': '主日学',
  fellowship: '团契聚会',
};

export function MinistryRosterSection() {
  const { churchInfo, ministryRoster, weekdayMinistries } = useChurchData();
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [weekMode, setWeekMode] = useState<WeekMode>('thisWeek');

  const filteredRoster =
    filter === 'all'
      ? ministryRoster
      : ministryRoster.filter((item) => item.category === filter);

  return (
    <section id="ministry" className="py-12 md:py-14 bg-[#F3EFE6]/55 border-b border-[#E5DFD3]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Part 1: Sunday Ministry Roster */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-7">
          <div className="max-w-2xl">
            <p className="text-xs tracking-widest text-[#78716C] mb-2">
              04. 肢体服事与周间聚会
            </p>
            <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[#1C1917] tracking-tight">
              主日事工岗位安排（含主日学及团契）
            </h2>
          </div>

          {/* Week Switcher */}
          <div
            role="group"
            aria-label="切换本周与下周轮值安排"
            className="inline-flex items-center gap-1 p-1 bg-[#E7E0D3] rounded-md self-start lg:self-auto shrink-0"
          >
            <button
              type="button"
              onClick={() => setWeekMode('thisWeek')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                weekMode === 'thisWeek'
                  ? 'bg-[#FAF8F4] text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {churchInfo.thisWeekLabel}
            </button>
            <button
              type="button"
              onClick={() => setWeekMode('nextWeek')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                weekMode === 'nextWeek'
                  ? 'bg-[#FAF8F4] text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
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
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                filter === tab.id
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-[#FAF8F4] text-[#57534E] border border-[#E5DFD3] hover:text-[#1C1917]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Clean Institutional Roster Table */}
        <div className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg overflow-hidden mb-10">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-[#EFEAE0]/70 border-b border-[#E5DFD3] text-xs font-medium text-[#57534E]">
            <div className="col-span-2">事工分类</div>
            <div className="col-span-3">岗位 / 课程名称</div>
            <div className="col-span-2">时间与地点</div>
            <div className="col-span-3">
              {weekMode === 'thisWeek'
                ? `本周值班同工（${churchInfo.thisWeekLabel}）`
                : `下周值班同工（${churchInfo.nextWeekLabel}）`}
            </div>
            <div className="col-span-2">备忘说明</div>
          </div>

          <div className="divide-y divide-[#EFEAE0]">
            {filteredRoster.map((item) => {
              const assignee = weekMode === 'thisWeek' ? item.thisWeek : item.nextWeek;
              return (
                <div
                  key={item.id}
                  className="px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-baseline text-sm hover:bg-[#F3EFE6]/45 transition-colors"
                >
                  <div className="md:col-span-2 text-xs text-[#78716C]">
                    {CATEGORY_LABELS[item.category]}
                  </div>
                  <div className="md:col-span-3 font-medium text-[#1C1917]">
                    {item.role}
                  </div>
                  <div className="md:col-span-2 text-xs text-[#57534E] tabular-nums">
                    {item.timeOrPlace}
                  </div>
                  <div className="md:col-span-3 font-medium text-[#1E3A5F]">
                    {assignee}
                  </div>
                  <div className="md:col-span-2 text-xs text-[#78716C] leading-relaxed">
                    {item.note}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Part 2: Weekday Ministries */}
        <div className="pt-2">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
            <div className="max-w-2xl">
              <p className="text-xs tracking-widest text-[#78716C] mb-2">
                05. 平日牧养与社区守望
              </p>
              <h3 className="font-editorial text-2xl md:text-3xl font-semibold text-[#1C1917] tracking-tight">
                周间事工安排
              </h3>
            </div>
            <p className="text-sm text-[#57534E] max-w-md">
              除主日崇拜外，教会于周二至周六持续开展查经祷告、诗班排练、小组查经与社区长者探访。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
            {weekdayMinistries.map((wm) => (
              <article
                key={wm.id}
                className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2 pb-3 mb-3 border-b border-[#EFEAE0]">
                    <span className="font-editorial text-xl font-semibold text-[#1E3A5F]">
                      {wm.day}
                    </span>
                    <span className="font-mono text-xs text-[#57534E] tabular-nums">
                      {wm.time}
                    </span>
                  </div>

                  <h4 className="font-editorial text-base font-semibold text-[#1C1917] mb-2">
                    {wm.title}
                  </h4>

                  <p className="text-xs text-[#57534E] leading-relaxed mb-4">
                    {wm.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#EFEAE0] space-y-1 text-xs text-[#78716C]">
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
