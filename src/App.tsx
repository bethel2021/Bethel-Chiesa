/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AnnouncementsSection } from './components/AnnouncementsSection';
import { ChurchIntroSection } from './components/ChurchIntroSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { MinistryRosterSection } from './components/MinistryRosterSection';
import { Navbar } from './components/Navbar';
import { PastorsSection } from './components/PastorsSection';
import { WorshipSection } from './components/WorshipSection';
import { ChurchDataProvider } from './context/ChurchDataContext';

function resolveInitialView(): 'public' | 'admin' {
  if (typeof window === 'undefined') return 'public';
  return window.location.pathname === '/admin' || window.location.hash === '#admin'
    ? 'admin'
    : 'public';
}

function BethelChurchApp() {
  const [view, setView] = useState<'public' | 'admin'>(resolveInitialView);

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
    return <AdminDashboard onBackToSite={openPublic} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--theme-bg)] text-[var(--theme-ink)] transition-colors duration-300">
      <Navbar onOpenAdmin={openAdmin} />
      <main className="flex-1">
        <HeroSection />
        <ChurchIntroSection />
        <PastorsSection />
        <WorshipSection />
        <MinistryRosterSection />
        <AnnouncementsSection />
        <ContactSection />
      </main>
      <Footer onOpenAdmin={openAdmin} />
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
