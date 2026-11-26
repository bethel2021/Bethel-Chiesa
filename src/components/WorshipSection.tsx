import { useMemo, useState } from 'react';
import { usePublicChurchData } from '../context/ChurchDataContext';

export function WorshipSection() {
  const { worshipTimes, liturgySteps } = usePublicChurchData();
  const [liturgyType, setLiturgyType] = useState<'standard' | 'communion'>('standard');

  const steps = useMemo(
    () => liturgySteps.filter((step) => step.liturgyType === liturgyType),
    [liturgySteps, liturgyType]
  );

  return (
    <section id="worship" className="py-12 md:py-14 border-b border-[var(--theme-border)]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-7 md:mb-8">
          <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
            03. 礼拜堂与敬拜生活
          </p>
          <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
            主日崇拜时间、流程
          </h2>
        </div>

        {/* Part A: Sunday Schedule Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {worshipTimes.map((slot) => (
            <div
              key={slot.id}
              className="bg-[var(--theme-surface)]/70 border border-[var(--theme-border)] rounded-lg p-5 flex flex-col justify-between transition-colors duration-300"
            >
              <div>
                <p className="font-mono text-xs font-medium text-[var(--theme-accent)] tabular-nums mb-1.5">
                  {slot.time}
                </p>
                <h3 className="font-editorial text-lg font-semibold text-[var(--theme-ink)] mb-2">
                  {slot.title}
                </h3>
                <p className="text-xs text-[var(--theme-ink-muted)] leading-relaxed mb-3">
                  {slot.desc}
                </p>
              </div>
              <p className="text-xs text-[var(--theme-ink-subtle)] pt-3 border-t border-[var(--theme-border-strong)]">
                地点：{slot.place}
              </p>
            </div>
          ))}
        </div>

        {/* Part B: Order of Worship */}
        <div className="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--theme-border)]">
            <div>
              <h3 className="font-editorial text-2xl font-semibold text-[var(--theme-ink)]">
                主日崇拜流程
              </h3>
              <p className="text-xs text-[var(--theme-ink-subtle)] mt-1">
                每月第一主日为圣餐主日，其余主日采用常规崇拜礼仪
              </p>
            </div>

            {/* Segmented Filter Control */}
            <div
              role="tablist"
              aria-label="选择主日崇拜流程类型"
              className="inline-flex items-center gap-1 p-1 bg-[var(--theme-surface-alt)] rounded-md self-start sm:self-auto shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={liturgyType === 'standard'}
                onClick={() => setLiturgyType('standard')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] ${
                  liturgyType === 'standard'
                    ? 'bg-[var(--theme-bg)] text-[var(--theme-ink)] shadow-xs'
                    : 'text-[var(--theme-ink-muted)] hover:text-[var(--theme-ink)]'
                }`}
              >
                常规主日流程
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={liturgyType === 'communion'}
                onClick={() => setLiturgyType('communion')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] ${
                  liturgyType === 'communion'
                    ? 'bg-[var(--theme-bg)] text-[var(--theme-ink)] shadow-xs'
                    : 'text-[var(--theme-ink-muted)] hover:text-[var(--theme-ink)]'
                }`}
              >
                圣餐主日流程
              </button>
            </div>
          </div>

          <div
            key={liturgyType}
            className="divide-y divide-[var(--theme-surface-alt)] animate-liturgy-in"
          >
            {steps.map((item) => (
              <div
                key={item.id}
                className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-start"
              >
                <div className="sm:col-span-2 font-mono text-sm font-medium text-[var(--theme-accent)] tabular-nums pt-0.5">
                  {item.time}
                </div>
                <div className="sm:col-span-10">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
                    <h4 className="font-medium text-base text-[var(--theme-ink)]">
                      {item.step}
                    </h4>
                    <span className="text-xs text-[var(--theme-ink-subtle)]">{item.leader}</span>
                  </div>
                  <p className="text-xs text-[var(--theme-ink-muted)] leading-relaxed">
                    {item.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
