import type { MouseEvent } from 'react';

export function getStickyHeaderHeight(): number {
  if (typeof document === 'undefined') return 65;
  const header = document.querySelector('header');
  if (!header) return 65;
  return Math.round(header.getBoundingClientRect().height);
}

export function scrollToSection(href: string): string | null {
  if (typeof window === 'undefined' || !href.startsWith('#')) return null;
  const targetId = href.slice(1);
  if (!targetId) return null;

  const targetEl = document.getElementById(targetId);
  if (!targetEl) return null;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const headerHeight = getStickyHeaderHeight();
  const targetTop =
    targetId === 'top'
      ? 0
      : Math.max(0, Math.round(targetEl.getBoundingClientRect().top + window.scrollY - headerHeight));

  window.scrollTo({
    top: targetTop,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });

  if (window.location.hash !== href) {
    window.history.replaceState(null, '', href);
  }

  return targetId;
}

export function handleAnchorClick(
  e: MouseEvent<HTMLAnchorElement>,
  href: string,
  afterNavigate?: (targetId: string) => void,
): void {
  if (!href.startsWith('#')) return;
  const targetId = href.slice(1);
  if (!targetId || !document.getElementById(targetId)) return;

  e.preventDefault();
  const resolvedId = scrollToSection(href);
  if (resolvedId && afterNavigate) {
    afterNavigate(resolvedId);
  }
}
