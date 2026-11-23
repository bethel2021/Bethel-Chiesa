import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Check, Menu, Palette, X } from 'lucide-react';
import { useChurchData } from '../context/ChurchDataContext';
import { SITE_THEMES } from '../data/themes';
import { getStickyHeaderHeight, handleAnchorClick } from '../utils/scroll';

const NAV_LINKS = [
  { id: 'intro', label: '教会简介', href: '#intro' },
  { id: 'pastors', label: '牧者同工', href: '#pastors' },
  { id: 'worship', label: '主日崇拜', href: '#worship' },
  { id: 'ministry', label: '事工岗位', href: '#ministry' },
  { id: 'announcements', label: '聚会公告', href: '#announcements' },
];

const TRACKED_SECTIONS = [
  'top',
  'intro',
  'pastors',
  'worship',
  'ministry',
  'announcements',
  'contact',
];

interface NavbarProps {
  onOpenAdmin: () => void;
}

export function Navbar({ onOpenAdmin }: NavbarProps) {
  const { churchInfo, activeTheme, setPreviewTheme } = useChurchData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('top');
  const headerRef = useRef<HTMLElement | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const scrollLockRef = useRef<{ targetId: string; until: number } | null>(null);

  const currentThemeOption =
    SITE_THEMES.find((item) => item.id === activeTheme) ?? SITE_THEMES[0];

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
    if (!mobileOpen && !themeMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setThemeMenuOpen(false);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (mobileOpen && headerRef.current && !headerRef.current.contains(target)) {
        setMobileOpen(false);
      }
      if (themeMenuOpen && themeMenuRef.current && !themeMenuRef.current.contains(target)) {
        setThemeMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [mobileOpen, themeMenuOpen]);

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    handleAnchorClick(e, href, (targetId) => {
      setMobileOpen(false);
      setThemeMenuOpen(false);
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

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          aria-label="主导航"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--theme-ink-muted)]"
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

        {/* Zone 3: Theme switcher popover + Admin button + mobile menu trigger */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div ref={themeMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((prev) => !prev)}
              aria-label={`切换网页主题样式（当前：${currentThemeOption.name}）`}
              aria-expanded={themeMenuOpen}
              aria-haspopup="menu"
              title={`切换主题（当前：${currentThemeOption.name}）`}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-[var(--theme-ink-muted)] hover:text-[var(--theme-ink)] bg-[var(--theme-surface)]/75 hover:bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]"
            >
              <Palette className="w-3.5 h-3.5 text-[var(--theme-accent)] shrink-0" />
              <span className="hidden lg:inline">{currentThemeOption.name}</span>
            </button>

            {themeMenuOpen && (
              <div
                role="menu"
                aria-label="选择网页主题样式"
                className="absolute right-0 mt-2 w-64 bg-[var(--theme-card)] border border-[var(--theme-border-strong)] rounded-lg shadow-xl p-2 z-50"
              >
                <div className="px-2.5 py-1.5 border-b border-[var(--theme-border)] mb-1.5">
                  <p className="text-xs font-semibold text-[var(--theme-ink)]">
                    网页节日与季节主题
                  </p>
                  <p className="text-[11px] text-[var(--theme-ink-subtle)] mt-0.5">
                    切换全站配色氛围，不改变版块结构
                  </p>
                </div>

                <div className="space-y-1">
                  {SITE_THEMES.map((option) => {
                    const selected = option.id === activeTheme;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => {
                          setPreviewTheme(option.id);
                          setThemeMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[var(--theme-surface)] text-[var(--theme-ink)]'
                            : 'hover:bg-[var(--theme-surface)]/55 text-[var(--theme-ink-body)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="inline-flex items-center -space-x-1 shrink-0" aria-hidden="true">
                            {option.swatches.map((hex, idx) => (
                              <span
                                key={`${option.id}-dot-${idx}`}
                                className="w-3 h-3 rounded-full border border-white shadow-xs"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-tight truncate">
                              {option.name}
                            </p>
                            <p className="text-[11px] text-[var(--theme-ink-subtle)] truncate mt-0.5">
                              {option.subtitle}
                            </p>
                          </div>
                        </div>
                        {selected && (
                          <Check className="w-3.5 h-3.5 text-[var(--theme-accent)] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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
