import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';
import { usePublicChurchData } from '../context/ChurchDataContext';
import { getStickyHeaderHeight, handleAnchorClick } from '../utils/scroll';

const NAV_LINKS = [
  { id: 'intro', label: '教会简介', href: '#intro' },
  { id: 'pastors', label: '服事同工', href: '#pastors' },
  { id: 'worship', label: '主日崇拜', href: '#worship' },
  { id: 'ministry', label: '周间事工', href: '#ministry' },
  { id: 'moments', label: '精彩瞬间', href: '#moments' },
  { id: 'announcements', label: '家事公告', href: '#announcements' },
];

const TRACKED_SECTIONS = [
  'top',
  'intro',
  'pastors',
  'worship',
  'ministry',
  'moments',
  'announcements',
  'contact',
];

interface NavbarProps {
  onOpenAdmin: () => void;
}

export function Navbar({ onOpenAdmin }: NavbarProps) {
  const { churchInfo } = usePublicChurchData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('top');
  const headerRef = useRef<HTMLElement | null>(null);
  const scrollLockRef = useRef<{ targetId: string; until: number } | null>(null);

  useEffect(() => {
    let ticking = false;

    const updateActiveSection = () => {
      ticking = false;
      const now = Date.now();
      const lock = scrollLockRef.current;
      if (lock && now < lock.until) {
        return;
      }

      const headerHeight = headerRef.current
        ? Math.round(headerRef.current.getBoundingClientRect().height)
        : getStickyHeaderHeight();
      const triggerY = headerHeight + 36;
      const docHeight = document.documentElement.scrollHeight;
      const winBottom = window.scrollY + window.innerHeight;

      let current = 'top';
      for (const id of TRACKED_SECTIONS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= triggerY) {
          current = id;
        }
      }

      if (winBottom >= docHeight - 16) {
        const contactEl = document.getElementById('contact');
        const announcementsEl = document.getElementById('announcements');
        const contactTop = contactEl?.getBoundingClientRect().top ?? Infinity;
        const announcementsTop = announcementsEl?.getBoundingClientRect().top ?? -Infinity;

        if (contactTop <= triggerY + 120 || announcementsTop < headerHeight - 20) {
          current = 'contact';
        }
      }

      setActiveSection(current);
    };

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateActiveSection);
      }
    };

    updateActiveSection();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [mobileOpen]);

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    handleAnchorClick(e, href, (targetId) => {
      setMobileOpen(false);
      setActiveSection(targetId);
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scrollLockRef.current = {
        targetId,
        until: Date.now() + (prefersReducedMotion ? 50 : 750),
      };
    });
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-[var(--theme-bg)]/95 backdrop-blur-sm border-b border-[var(--theme-border)] transition-colors duration-300"
    >
      {/* Zero-height-shift seasonal top accent hairline */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] pointer-events-none"
        style={{ background: 'var(--theme-top-bar)' }}
      />

      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => handleNavClick(e, '#top')}
          className="font-editorial text-lg sm:text-xl font-semibold tracking-tight text-[var(--theme-ink)] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] rounded-sm"
        >
          {churchInfo.name}
        </a>

        {/* Zone 2: 6 concise single-line text navigation links */}
        <nav
          aria-label="主导航"
          className="hidden md:flex items-center gap-4 lg:gap-7 text-sm font-medium text-[var(--theme-ink-muted)]"
        >
          {NAV_LINKS.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                aria-current={isActive ? 'location' : undefined}
                className={`relative py-1 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] rounded-sm after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-[2px] after:bg-[var(--theme-accent)] after:transition-transform after:duration-200 after:origin-left ${
                  isActive
                    ? 'text-[var(--theme-accent)] font-semibold after:scale-x-100'
                    : 'text-[var(--theme-ink-muted)] hover:text-[var(--theme-accent)] after:scale-x-0 hover:after:scale-x-100'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action + mobile menu trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAdmin}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-white bg-[var(--theme-accent)] hover:bg-[var(--theme-accent-hover)] rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2"
          >
            后台管理
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 text-[var(--theme-ink)] hover:bg-[var(--theme-surface-alt)] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer (out-of-flow overlay so opening/closing never shifts page scroll targets) */}
      {mobileOpen && (
        <div className="md:hidden absolute left-0 right-0 top-full bg-[var(--theme-bg)] border-b border-[var(--theme-border)] px-6 py-4 space-y-2 shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
          <nav aria-label="移动端导航" className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`py-2.5 text-sm border-b border-[var(--theme-surface-alt)] last:border-b-0 transition-colors ${
                    isActive
                      ? 'font-semibold text-[var(--theme-accent)]'
                      : 'font-medium text-[var(--theme-ink)] hover:text-[var(--theme-accent)]'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, '#contact')}
              className={`py-2.5 text-sm border-b border-[var(--theme-surface-alt)] transition-colors ${
                activeSection === 'contact'
                  ? 'font-semibold text-[var(--theme-accent)]'
                  : 'font-medium text-[var(--theme-ink)] hover:text-[var(--theme-accent)]'
              }`}
            >
              联系方式
            </a>
          </nav>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAdmin();
              }}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-[var(--theme-accent)] hover:bg-[var(--theme-accent-hover)] rounded-md transition-colors cursor-pointer"
            >
              后台管理
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
