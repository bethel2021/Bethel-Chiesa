import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const SCROLL_THRESHOLD_PX = 420;

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > SCROLL_THRESHOLD_PX);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateVisibility);
    };
  }, []);

  const handleBackToTop = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <button
      type="button"
      onClick={handleBackToTop}
      aria-label="返回顶部"
      title="返回顶部"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-40 w-11 h-11 rounded-full flex items-center justify-center bg-[var(--theme-card)]/75 hover:bg-[var(--theme-card)]/95 text-[var(--theme-accent)] border border-[var(--theme-border-strong)]/85 hover:border-[var(--theme-accent)]/60 backdrop-blur-md shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2 ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto cursor-pointer'
          : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <ArrowUp className="w-4 h-4" strokeWidth={2.2} />
    </button>
  );
}
