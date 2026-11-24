import { useMemo, useState } from 'react';
import { usePublicChurchData } from '../context/ChurchDataContext';
import { CHURCH_IMAGES } from '../data/churchData';

interface FellowshipMoment {
  id: string;
  category: 'choir' | 'small-group' | 'youth' | 'sunday-school' | 'fellowship' | 'care';
  categoryLabel: string;
  title: string;
  description: string;
  image: string;
  schedule: string;
}

const MOMENT_CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: '全部精彩瞬间' },
  { id: 'choir', label: '敬拜诗班' },
  { id: 'small-group', label: '查经小组' },
  { id: 'youth', label: '青年团契' },
  { id: 'sunday-school', label: '主日学' },
  { id: 'fellowship', label: '爱宴交通' },
  { id: 'care', label: '社区关怀' },
];

const FELLOWSHIP_MOMENTS: FellowshipMoment[] = [
  {
    id: 'moment-1',
    category: 'choir',
    categoryLabel: '敬拜诗班',
    title: '诗班献诗与声部排练',
    description: '主日崇拜前，诗班弟兄姊妹同心合意进行声部练习与灵命预备，用歌声与赞美荣耀主圣名，带领会众进入神至圣的同在。',
    image: CHURCH_IMAGES.annChoir,
    schedule: '每周主日 13:15 圣殿诗班排练室',
  },
  {
    id: 'moment-2',
    category: 'small-group',
    categoryLabel: '查经小组',
    title: '恩典查经与生命交通',
    description: '周间晚上，弟兄姊妹围坐在一起深入查考圣经话语，结合生活实际分享信仰领悟，彼此代祷、互相担当。',
    image: CHURCH_IMAGES.annSeekers,
    schedule: '每周三 / 周五晚 20:00 线上与副堂',
  },
  {
    id: 'moment-3',
    category: 'youth',
    categoryLabel: '青年团契',
    title: '青年团契信仰分享会',
    description: '年轻一代在基督里畅谈信仰与人生抉择，在真道上互相造就，建立充满活力与属灵支持的青春伙伴关系。',
    image: CHURCH_IMAGES.fellowshipIntro,
    schedule: '隔周六下午 16:30 青年活动中心',
  },
  {
    id: 'moment-4',
    category: 'sunday-school',
    categoryLabel: '主日学',
    title: '主日学儿童圣经课堂',
    description: '在活泼生动的圣经故事、诗歌与手工活动中，引导下一代从小认识创造宇宙真神，在主爱中扎根成长。',
    image: CHURCH_IMAGES.annBaptism,
    schedule: '每周主日 14:30 幼小部教室',
  },
  {
    id: 'moment-5',
    category: 'fellowship',
    categoryLabel: '爱宴交通',
    title: '主日爱宴与肢体交谊',
    description: '主日崇拜结束后，大家一同留步享用丰盛爱宴，在轻松喜乐的氛围中嘘寒问暖，增进基督里一灵同体的深厚情谊。',
    image: CHURCH_IMAGES.annThanksgiving,
    schedule: '每周主日崇拜后 16:00 餐厅',
  },
  {
    id: 'moment-6',
    category: 'care',
    categoryLabel: '社区关怀',
    title: '社区关怀与爱心探访',
    description: '践行基督舍己的爱心，教会定期组织探访队关怀社区长者与有需要的家庭，送去祝福与切实的帮助。',
    image: CHURCH_IMAGES.annCare,
    schedule: '每月第四周六爱心行动',
  },
];

export function MinistryRosterSection() {
  const { weekdayMinistries } = usePublicChurchData();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedMoment, setSelectedMoment] = useState<FellowshipMoment | null>(null);

  const filteredMoments = useMemo(
    () =>
      activeTab === 'all'
        ? FELLOWSHIP_MOMENTS
        : FELLOWSHIP_MOMENTS.filter((m) => m.category === activeTab),
    [activeTab]
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
              常规聚会时间安排
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
        <div className="pt-8 border-t border-[var(--theme-border)]/60">
          <div className="max-w-2xl mb-7 md:mb-8">
            <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
              05. 教会生活剪影
            </p>
            <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
              教会小组、诗班与团契活动精彩瞬间
            </h2>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {MOMENT_CATEGORIES.map((tab) => (
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
                    {moment.categoryLabel}
                  </span>
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <p className="text-xs font-mono text-white/90 drop-shadow-xs">
                      {moment.schedule}
                    </p>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-editorial text-xl font-semibold text-[var(--theme-ink)] mb-2 group-hover:text-[var(--theme-accent)] transition-colors">
                      {moment.title}
                    </h3>
                    <p className="text-xs text-[var(--theme-ink-muted)] line-clamp-3 leading-relaxed">
                      {moment.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[var(--theme-surface-alt)] flex items-center justify-between text-xs font-medium text-[var(--theme-accent)]">
                    <span>查看高清大图</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
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
                {selectedMoment.categoryLabel}
              </span>
            </div>

            <div className="p-6 md:p-8">
              <span className="inline-block font-mono text-xs text-[var(--theme-accent)] mb-2 font-medium">
                {selectedMoment.schedule}
              </span>
              <h3
                id="moment-modal-title"
                className="font-editorial text-2xl md:text-3xl font-semibold text-[var(--theme-ink)] mb-4"
              >
                {selectedMoment.title}
              </h3>
              <p className="text-sm md:text-base text-[var(--theme-ink-muted)] leading-relaxed mb-6">
                {selectedMoment.description}
              </p>
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
