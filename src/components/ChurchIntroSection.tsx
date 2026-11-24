import { usePublicChurchData } from '../context/ChurchDataContext';
import { SafeImage } from './SafeImage';

export function ChurchIntroSection() {
  const { churchInfo, cloudLoading } = usePublicChurchData();

  return (
    <section id="intro" className="py-12 md:py-14 border-b border-[var(--theme-border)]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-7 md:mb-8">
          <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
            01. 认识我们
          </p>
          <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
            教会简介与异象使命
          </h2>
        </div>

        {/* Two-column balanced editorial grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Column: Prose & Image */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-8">
            <div className="space-y-5 max-w-prose">
              {churchInfo.introParagraphs.map((paragraph, idx) => (
                <p
                  key={idx}
                  className={`text-base text-[var(--theme-ink-body)] leading-[1.8] ${
                    idx === 0
                      ? 'first-letter:text-4xl first-letter:font-editorial first-letter:font-semibold first-letter:text-[var(--theme-accent)] first-letter:float-left first-letter:mr-2.5 first-letter:leading-none first-letter:mt-1'
                      : ''
                  }`}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-2 aspect-[4/3] w-full overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]">
              <SafeImage
                src={churchInfo.fellowshipImage}
                alt="主日崇拜后弟兄姊妹在伯特利教会交谊厅围坐读经与茶叙"
                fallbackLabel="伯特利教会肢体团契交流"
                defer={cloudLoading}
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>

          {/* Right Column: Core Values List separated by hairline dividers */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[var(--theme-surface)]/70 border border-[var(--theme-border)] rounded-lg p-7 md:p-8 transition-colors duration-300">
            <div>
              <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-1">
                信仰根基与教会生活
              </p>
              <h3 className="font-editorial text-2xl font-semibold text-[var(--theme-ink)] mb-6">
                四项核心异象
              </h3>

              <div className="divide-y divide-[var(--theme-border-strong)]">
                {churchInfo.coreValues.map((item) => (
                  <div key={item.index} className="py-5 first:pt-2 last:pb-2">
                    <div className="flex items-baseline gap-3 mb-1.5">
                      <span className="font-mono text-xs font-medium text-[var(--theme-gold)] tabular-nums">
                        {item.index}.
                      </span>
                      <h4 className="font-editorial text-lg font-semibold text-[var(--theme-ink)]">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-sm text-[var(--theme-ink-muted)] leading-relaxed pl-7">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quiet Pull Quote */}
            <div className="mt-8 pt-6 border-t border-[var(--theme-border-strong)]">
              <p className="font-editorial text-base italic text-[var(--theme-ink)] leading-relaxed text-justify">
                {churchInfo.themeVerse}
              </p>
              {(() => {
                const refParts = churchInfo.themeVerseRef
                  .split('·')
                  .map((part) => part.trim())
                  .filter(Boolean);
                if (refParts.length >= 2) {
                  return (
                    <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-[var(--theme-ink-subtle)]">
                      <span>{refParts[0]}</span>
                      <span>{refParts.slice(1).join(' · ')}</span>
                    </p>
                  );
                }
                return (
                  <p className="text-xs text-[var(--theme-ink-subtle)] mt-2 text-justify">
                    {churchInfo.themeVerseRef}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
