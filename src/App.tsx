/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { AnnouncementsSection } from './components/AnnouncementsSection';
import { BackToTopButton } from './components/BackToTopButton';
import { ChristmasSnowfall } from './components/ChristmasSnowfall';
import { ChurchIntroSection } from './components/ChurchIntroSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { MinistryRosterSection } from './components/MinistryRosterSection';
import { Navbar } from './components/Navbar';
import { PastorsSection } from './components/PastorsSection';
import { WorshipSection } from './components/WorshipSection';
import { ChurchDataProvider } from './context/ChurchDataContext';

const AdminDashboard = lazy(() =>
  import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

function resolveInitialView(): 'public' | 'admin' {
  if (typeof window === 'undefined') return 'public';
  return window.location.pathname === '/admin' || window.location.hash === '#admin'
    ? 'admin'
    : 'public';
}

function BethelChurchApp() {
  const [view, setView] = useState<'public' | 'admin'>(resolveInitialView);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);

  useEffect(() => {
    document.title =
      view === 'admin'
        ? '同工管理后台 · 基督教意大利伯特利华人教会'
        : '基督教意大利伯特利华人教会';
  }, [view]);

  useEffect(() => {
    const handlePopState = () => {
      setView(resolveInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const openAdmin = () => {
    setView('admin');
    if (window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin');
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const openPublic = () => {
    setView('public');
    if (window.location.pathname !== '/' || window.location.hash === '#admin') {
      window.history.pushState(null, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (view === 'admin') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center p-6">
            <div className="text-sm text-[#57534E]">正在载入管理后台…</div>
          </div>
        }
      >
        <AdminDashboard onBackToSite={openPublic} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--theme-bg)] text-[var(--theme-ink)] transition-colors duration-300">
      <ChristmasSnowfall />
      <Navbar onOpenAdmin={openAdmin} />
      <main className="flex-1">
        <HeroSection onSelectAnnouncement={(item) => setSelectedAnnouncementId(item.id)} />
        <ChurchIntroSection />
        <PastorsSection />
        <WorshipSection />
        <MinistryRosterSection />
        <AnnouncementsSection
          selectedAnnouncementId={selectedAnnouncementId}
          onSelectAnnouncement={(item) => setSelectedAnnouncementId(item ? item.id : null)}
        />
        <ContactSection />
      </main>
      <Footer />
      <BackToTopButton />
    </div>
  );
}

export default function App() {
  return (
    <ChurchDataProvider>
      <BethelChurchApp />
    </ChurchDataProvider>
  );
}
