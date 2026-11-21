import { useEffect, useState, type MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';
import { useChurchData } from '../context/ChurchDataContext';

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

const HEADER_OFFSET = 64;

interface NavbarProps {
  onOpenAdmin: () => void;
}

export function Navbar({ onOpenAdmin }: NavbarProps) {
  const { churchInfo } = useChurchData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('top');

  useEffect(() => {
    let ticking = false;

    const updateActiveSection = () => {
      ticking = false;
      const scrollPosition = window.scrollY + HEADER_OFFSET + 80;
      const docHeight = document.documentElement.scrollHeight;
      const winBottom = window.scrollY + window.innerHeight;

      if (winBottom >= docHeight - 32) {
        setActiveSection('contact');
        return;
      }

      let current = 'top';
      for (const id of TRACKED_SECTIONS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.offsetTop;
        if (scrollPosition >= top) {
          current = id;
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

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return;
    const targetId = href.slice(1);
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    e.preventDefault();
    setMobileOpen(false);
    setActiveSection(targetId);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetTop =
      targetId === 'top'
        ? 0
        : Math.max(0, targetEl.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET);

    window.scrollTo({
      top: targetTop,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });

    if (window.location.hash !== href) {
      window.history.replaceState(null, '', href);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-[#E5DFD3]">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => handleNavClick(e, '#top')}
          className="font-editorial text-xl font-semibold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded-sm"
        >
          {churchInfo.name}
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          aria-label="主导航"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E]"
        >
          {NAV_LINKS.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                aria-current={isActive ? 'location' : undefined}
                className={`relative py-1 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded-sm after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-[2px] after:bg-[#1E3A5F] after:transition-transform after:duration-200 after:origin-left ${
                  isActive
                    ? 'text-[#1E3A5F] font-semibold after:scale-x-100'
                    : 'text-[#57534E] hover:text-[#1E3A5F] after:scale-x-0 hover:after:scale-x-100'
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
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2"
          >
            后台管理
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 text-[#1C1917] hover:bg-[#EFEAE0] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-[#FAF8F4] border-b border-[#E5DFD3] px-6 py-4 space-y-2">
          <nav aria-label="移动端导航" className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`py-2.5 text-sm border-b border-[#EFEAE0] last:border-b-0 transition-colors ${
                    isActive
                      ? 'font-semibold text-[#1E3A5F]'
                      : 'font-medium text-[#1C1917] hover:text-[#1E3A5F]'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, '#contact')}
              className={`py-2.5 text-sm border-b border-[#EFEAE0] transition-colors ${
                activeSection === 'contact'
                  ? 'font-semibold text-[#1E3A5F]'
                  : 'font-medium text-[#1C1917] hover:text-[#1E3A5F]'
              }`}
            >
              来访与联系
            </a>
          </nav>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAdmin();
              }}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md transition-colors cursor-pointer"
            >
              后台管理
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
