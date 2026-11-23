import { useChurchData } from '../context/ChurchDataContext';
import { handleAnchorClick } from '../utils/scroll';

interface FooterProps {
  onOpenAdmin: () => void;
}

export function Footer({ onOpenAdmin }: FooterProps) {
  const { churchInfo } = useChurchData();

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
