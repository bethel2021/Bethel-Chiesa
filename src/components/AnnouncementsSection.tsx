import { useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { useChurchData } from '../context/ChurchDataContext';
import type { AnnouncementItem } from '../data/churchData';
import { handleAnchorClick } from '../utils/scroll';

type CategoryFilter = '全部' | AnnouncementItem['category'];

const CATEGORIES: CategoryFilter[] = [
  '全部',
  '特别聚会',
  '洗礼与课程',
  '诗班与事奉',
  '社区关怀',
];

export function AnnouncementsSection() {
  const { announcements } = useChurchData();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('全部');
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementItem | null>(null);

  const visibleAnnouncements =
    selectedCategory === '全部'
      ? announcements
      : announcements.filter((item) => item.category === selectedCategory);

  const featuredItem =
    selectedCategory === '全部'
      ? visibleAnnouncements.find((item) => item.isFeatured) || visibleAnnouncements[0]
      : visibleAnnouncements[0];

  const remainingItems = visibleAnnouncements.filter((item) => item.id !== featuredItem?.id);

  return (
    <section id="announcements" className="py-12 md:py-14 border-b border-[#E5DFD3]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header + Category Filter */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-7">
          <div className="max-w-2xl">
            <p className="text-xs tracking-widest text-[#78716C] mb-2">
              06. 近期动态与家事报道
            </p>
            <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[#1C1917] tracking-tight">
              最新聚会公告
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                  selectedCategory === category
                    ? 'bg-[#1E3A5F] text-white'
                    : 'bg-[#F3EFE6] text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Tier 1: Lead Announcement */}
        {featuredItem && (
          <article className="bg-[#F3EFE6]/80 border border-[#E5DFD3] rounded-lg p-7 md:p-9 mb-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C] mb-3">
              <span className="font-medium text-[#8B5E34]">重点公告</span>
              <span aria-hidden="true">·</span>
              <span>{featuredItem.category}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{featuredItem.date}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
              <div className="lg:col-span-8">
                <h3 className="font-editorial text-2xl md:text-3xl font-semibold text-[#1C1917] mb-3">
                  {featuredItem.title}
                </h3>
                <p className="text-base text-[#292524] leading-relaxed mb-4 max-w-2xl">
                  {featuredItem.summary}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#57534E]">
                  <span className="tabular-nums">时间：{featuredItem.time}</span>
                  <span aria-hidden="true">·</span>
                  <span>地点：{featuredItem.location}</span>
                  <span aria-hidden="true">·</span>
                  <span>联系：{featuredItem.contact}</span>
                </div>
              </div>

              <div className="lg:col-span-4 flex lg:justify-end">
                <button
                  type="button"
                  onClick={() => setActiveAnnouncement(featuredItem)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2"
                >
                  <span>阅读详情与报名须知</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </article>
        )}

        {/* Tier 2: Secondary Announcements Grid */}
        {remainingItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {remainingItems.map((item) => (
              <article
                key={item.id}
                className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#78716C] mb-2">
                    <span className="text-[#1E3A5F] font-medium">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{item.date}</span>
                  </div>

                  <h3 className="font-editorial text-xl font-semibold text-[#1C1917] mb-2.5">
                    {item.title}
                  </h3>

                  <p className="text-sm text-[#57534E] leading-relaxed mb-4">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#EFEAE0] flex items-center justify-between gap-4">
                  <span className="text-xs text-[#78716C] truncate">
                    {item.time} · {item.location}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveAnnouncement(item)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer py-1"
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141210]/55 backdrop-blur-[2px]"
          onClick={() => setActiveAnnouncement(null)}
        >
          <div
            className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5DFD3]">
              <div>
                <p className="text-xs text-[#78716C] mb-1">
                  {activeAnnouncement.category} · {activeAnnouncement.date}
                </p>
                <h3
                  id="announcement-modal-title"
                  className="font-editorial text-2xl font-semibold text-[#1C1917]"
                >
                  {activeAnnouncement.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveAnnouncement(null)}
                aria-label="关闭公告详情"
                className="w-9 h-9 inline-flex items-center justify-center rounded-md text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFEAE0] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <dl className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-b border-[#EFEAE0]">
              <div>
                <dt className="text-[#78716C] mb-0.5">聚会时间</dt>
                <dd className="text-[#1C1917] font-medium tabular-nums">{activeAnnouncement.time}</dd>
              </div>
              <div>
                <dt className="text-[#78716C] mb-0.5">聚会地点</dt>
                <dd className="text-[#1C1917] font-medium">{activeAnnouncement.location}</dd>
              </div>
              <div>
                <dt className="text-[#78716C] mb-0.5">负责联系人</dt>
                <dd className="text-[#1C1917] font-medium">{activeAnnouncement.contact}</dd>
              </div>
            </dl>

            <div className="py-5 space-y-3 text-sm text-[#292524] leading-relaxed">
              {activeAnnouncement.details.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            <div className="pt-4 border-t border-[#E5DFD3] flex items-center justify-end gap-3">
              <a
                href="#contact"
                onClick={(e) => handleAnchorClick(e, '#contact', () => setActiveAnnouncement(null))}
                className="px-4 py-2 text-xs font-medium text-[#1E3A5F] border border-[#1E3A5F]/30 hover:bg-[#1E3A5F]/5 rounded-md transition-colors whitespace-nowrap"
              >
                前往来访登记咨询
              </a>
              <button
                type="button"
                onClick={() => setActiveAnnouncement(null)}
                className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
