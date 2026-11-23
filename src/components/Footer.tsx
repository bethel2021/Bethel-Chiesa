import { useChurchData } from '../context/ChurchDataContext';
import { SITE_THEMES } from '../data/themes';
import { handleAnchorClick } from '../utils/scroll';

interface FooterProps {
  onOpenAdmin: () => void;
}

export function Footer({ onOpenAdmin }: FooterProps) {
  const { churchInfo, activeTheme, setPreviewTheme } = useChurchData();

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
            <p className="tabular-nums">主日崇拜：周日 09:30 – 11:15</p>
            <p className="tabular-nums">主日学：周日 13:00 – 14:15</p>
            <p className="tabular-nums">祷告会：周二 19:30 – 21:00</p>
          </div>

          <div className="md:col-span-4 space-y-2 text-xs text-[var(--theme-ink-muted)]">
            <p className="font-medium text-[var(--theme-ink)] mb-2">堂址与联系</p>
            <p>{churchInfo.address}</p>
            <p className="tabular-nums">联系电话：{churchInfo.pastoralPhone}</p>
          </div>
        </div>

        <div className="py-4 border-b border-[var(--theme-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-[var(--theme-ink-subtle)]">网页主题样式预览：</span>
          <div
            role="group"
            aria-label="选择网页主题样式"
            className="flex flex-wrap items-center gap-1.5"
          >
            {SITE_THEMES.map((option) => {
              const selected = option.id === activeTheme;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPreviewTheme(option.id)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] ${
                    selected
                      ? 'bg-[var(--theme-accent)] text-white border-[var(--theme-accent)]'
                      : 'bg-[var(--theme-surface)]/70 text-[var(--theme-ink-muted)] border-[var(--theme-border)] hover:text-[var(--theme-ink)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-full border border-white/70 shrink-0"
                    style={{ backgroundColor: option.swatches[1] }}
                  />
                  <span>{option.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--theme-ink-subtle)]">
          <p>© 2026 {churchInfo.name}</p>
          <nav aria-label="页脚快速导航" className="flex flex-wrap items-center gap-5">
            <a
              href="#intro"
              onClick={(e) => handleAnchorClick(e, '#intro')}
              className="hover:text-[var(--theme-ink)] transition-colors"
            >
              教会简介
            </a>
            <a
              href="#pastors"
              onClick={(e) => handleAnchorClick(e, '#pastors')}
              className="hover:text-[var(--theme-ink)] transition-colors"
            >
              牧者同工
            </a>
            <a
              href="#worship"
              onClick={(e) => handleAnchorClick(e, '#worship')}
              className="hover:text-[var(--theme-ink)] transition-colors"
            >
              主日崇拜
            </a>
            <a
              href="#ministry"
              onClick={(e) => handleAnchorClick(e, '#ministry')}
              className="hover:text-[var(--theme-ink)] transition-colors"
            >
              事工岗位
            </a>
            <a
              href="#announcements"
              onClick={(e) => handleAnchorClick(e, '#announcements')}
              className="hover:text-[var(--theme-ink)] transition-colors"
            >
              聚会公告
            </a>
            <a
              href="#contact"
              onClick={(e) => handleAnchorClick(e, '#contact')}
              className="hover:text-[var(--theme-ink)] transition-colors"
            >
              联系方式
            </a>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-[var(--theme-accent)] hover:underline underline-offset-4 cursor-pointer font-medium"
            >
              后台管理
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
