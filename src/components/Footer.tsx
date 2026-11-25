import { useEffect, useMemo, useState } from 'react';
import { usePublicChurchData } from '../context/ChurchDataContext';
import { SUNDAY_SUMMARY_SCHEDULE } from '../data/cacheConfig';
import { parsePastoralPhoneEntries } from '../utils/phone';
import { trackUniqueVisitor } from '../utils/visitorCounter';

export function Footer() {
  const { churchInfo } = usePublicChurchData();
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const phoneEntries = useMemo(
    () => parsePastoralPhoneEntries(churchInfo.pastoralPhone),
    [churchInfo.pastoralPhone]
  );

  useEffect(() => {
    let active = true;
    trackUniqueVisitor().then((count) => {
      if (active && typeof count === 'number') {
        setVisitorCount(count);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <footer className="bg-[var(--theme-bg)] border-t border-[var(--theme-border)] transition-colors duration-300">
      <div className="max-w-[1200px] mx-auto px-6 py-8 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-7 border-b border-[var(--theme-border)]">
          <div className="md:col-span-5">
            <p className="font-editorial text-xl font-semibold text-[var(--theme-ink)] mb-2">
              {churchInfo.name}
            </p>
            <p className="text-xs text-[var(--theme-ink-muted)] leading-relaxed max-w-sm">
              {churchInfo.scriptureQuote} —— {churchInfo.scriptureRef}
            </p>
          </div>

          <div className="md:col-span-3 space-y-2 text-xs text-[var(--theme-ink-muted)]">
            <p className="font-medium text-[var(--theme-ink)] mb-2">聚会时间</p>
            {SUNDAY_SUMMARY_SCHEDULE.map((slot) => (
              <p key={slot.label} className="tabular-nums">
                {slot.label}：{slot.time}
              </p>
            ))}
          </div>

          <div className="md:col-span-4 space-y-2 text-xs text-[var(--theme-ink-muted)]">
            <p className="font-medium text-[var(--theme-ink)] mb-2">堂址与联系</p>
            <p>{churchInfo.address}</p>
            <div className="tabular-nums flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
              <span className="shrink-0">联系电话：</span>
              <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
                {phoneEntries.map((entry, idx) => (
                  <span key={`${entry.raw}-${idx}`} className="inline-flex items-center gap-2">
                    {idx > 0 && (
                      <span aria-hidden="true" className="hidden sm:inline opacity-60">
                        /
                      </span>
                    )}
                    <span>
                      {entry.prefix}
                      {entry.phone &&
                        (entry.telHref ? (
                          <a
                            href={entry.telHref}
                            className="whitespace-nowrap hover:text-[var(--theme-ink)] hover:underline underline-offset-2"
                          >
                            {entry.phone}
                          </a>
                        ) : (
                          <span className="whitespace-nowrap">{entry.phone}</span>
                        ))}
                      {entry.suffix}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 text-center text-xs text-[var(--theme-ink-subtle)] space-y-1.5">
          {visitorCount !== null && (
            <p className="text-[var(--theme-ink-muted)] tabular-nums">
              您是第<span className="font-semibold text-[var(--theme-ink)]">{visitorCount}</span>位访客！
            </p>
          )}
          <p>© 2026 基督教意大利伯特利华人教会</p>
        </div>
      </div>
    </footer>
  );
}
