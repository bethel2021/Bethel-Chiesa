import { useMemo } from 'react';
import { ArrowDownRight } from 'lucide-react';
import { usePublicChurchData } from '../context/ChurchDataContext';
import type { AnnouncementItem } from '../data/churchData';
import { handleAnchorClick } from '../utils/scroll';
import { SafeImage } from './SafeImage';

interface HeroSectionProps {
  onSelectAnnouncement?: (item: AnnouncementItem) => void;
}

export function HeroSection({ onSelectAnnouncement }: HeroSectionProps = {}) {
  const { churchInfo, announcements, cloudLoading, activeTheme } = usePublicChurchData();

  const normalizedChurchName = churchInfo.name.trim();
  const splitNameMatch = normalizedChurchName.match(/^(基督教意大利)\s*(伯特利华人教会.*)$/);
  const repeatPerHalf = useMemo(() => {
    if (announcements.length === 0) return 0;
    return Math.max(1, Math.ceil(4 / announcements.length));
  }, [announcements.length]);

  return (
    <section id="top" className="border-b border-[var(--theme-border)]">
      {/* Architectural Sanctuary Focal Hero */}
      <div
        className="relative w-full h-[540px] md:h-[620px] overflow-hidden"
        style={{ backgroundColor: 'var(--theme-hero-bg)' }}
      >
        <SafeImage
          src={churchInfo.heroImage}
          alt={`${normalizedChurchName}主堂清晨阳光`}
          fallbackLabel={`${normalizedChurchName}主堂建筑内景`}
          priority
          defer={cloudLoading}
          className="w-full h-full object-cover object-center"
        />

        {/* Subtle Frosted Privacy Veil (10% warm mist without darkening) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 backdrop-blur-[3px]"
          style={{ backgroundColor: 'var(--theme-hero-mist)' }}
        />

        {/* Measured Bottom Contrast Scrim + Localized Text-Zone Backdrop for High Readability */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to top, var(--theme-hero-scrim-from) 0%, var(--theme-hero-scrim-mid) 38%, var(--theme-hero-scrim-via) 68%, transparent 100%), radial-gradient(ellipse 75% 65% at 22% 86%, rgba(10, 9, 8, 0.45), transparent 72%)',
          }}
        />

        <div className="absolute inset-0 flex items-end">
          <div className="max-w-[1200px] w-full mx-auto px-6 pb-12 md:pb-16">
            <div className="max-w-2xl text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.65)]">
              <p className="text-xs md:text-sm tracking-widest text-white mb-3 font-medium flex items-center gap-1.5">
                {activeTheme === 'christmas' && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5 text-[#F4D58D] shrink-0 drop-shadow-xs"
                    fill="currentColor"
                  >
                    <path d="M12 1.5l2.15 7.35L21.5 11l-7.35 2.15L12 20.5l-2.15-7.35L2.5 11l7.35-2.15L12 1.5z" />
                  </svg>
                )}
                <span>
                  {churchInfo.founded} · {churchInfo.shortAddress}
                </span>
              </p>

              <h1 className="font-editorial text-[2rem] min-[360px]:text-4xl sm:text-5xl md:text-[3.5rem] font-semibold leading-[1.25] sm:leading-[1.15] tracking-tight text-white mb-4 [text-shadow:0_2px_14px_rgba(0,0,0,0.65)]">
                {splitNameMatch ? (
                  <>
                    <span className="block sm:inline">{splitNameMatch[1]}</span>
                    <span className="block sm:inline">{splitNameMatch[2]}</span>
                  </>
                ) : (
                  normalizedChurchName
                )}
              </h1>

              <p className="font-editorial text-base sm:text-lg text-white font-medium leading-relaxed mb-3">
                {churchInfo.scriptureQuote}
                <span className="text-sm text-white/90 font-normal ml-2">
                  —— {churchInfo.scriptureRef}
                </span>
              </p>

              <p className="text-sm sm:text-base text-white/95 leading-relaxed mb-7 max-w-xl lg:max-w-none lg:whitespace-nowrap">
                {churchInfo.heroSubtitle}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="#worship"
                  onClick={(e) => handleAnchorClick(e, '#worship')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--theme-ink)] bg-white hover:bg-[#FAF8F4] shadow-md rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 [text-shadow:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span>了解本周主日崇拜</span>
                  <ArrowDownRight className="w-4 h-4" />
                </a>
                <a
                  href="#contact"
                  onClick={(e) => handleAnchorClick(e, '#contact')}
                  className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white underline underline-offset-4 decoration-white/80 hover:decoration-white transition-colors whitespace-nowrap shrink-0"
                >
                  联系方式
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Scrolling Announcements Ribbon */}
      {announcements.length > 0 && (
        <div className="bg-[var(--theme-surface)] transition-colors duration-300">
          <div className="max-w-[1200px] mx-auto px-6 py-3.5 flex items-center gap-4 text-sm font-sans">
            <a
              href="#announcements"
              onClick={(e) => handleAnchorClick(e, '#announcements')}
              className="text-xs font-semibold tracking-wider text-[var(--theme-accent)] whitespace-nowrap shrink-0 pr-4 border-r border-[var(--theme-border-strong)] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] rounded-sm"
            >
              最新家事公告
            </a>

            <div className="marquee-viewport relative flex-1 min-w-0 overflow-hidden">
              <div
                className="animate-announcement-marquee flex w-max items-center"
                style={{
                  animationDuration: `${Math.max(24, announcements.length * repeatPerHalf * 7)}s`,
                }}
              >
                {[0, 1].map((halfIdx) => (
                  <div
                    key={halfIdx}
                    aria-hidden={halfIdx === 1}
                    className={`marquee-track-group flex items-center shrink-0 gap-6 pr-6 ${
                      halfIdx === 1 ? 'marquee-duplicate' : ''
                    }`}
                  >
                    {Array.from({ length: repeatPerHalf }, (_, repIdx) =>
                      announcements.map((item) => {
                        const isDup = halfIdx === 1 || repIdx > 0;
                        return (
                          <a
                            key={`${halfIdx}-${repIdx}-${item.id}`}
                            href="#announcements"
                            tabIndex={isDup ? -1 : undefined}
                            aria-hidden={isDup && halfIdx === 0 ? true : undefined}
                            onClick={(e) => {
                              if (onSelectAnnouncement) {
                                e.preventDefault();
                                onSelectAnnouncement(item);
                                return;
                              }
                              handleAnchorClick(e, '#announcements');
                            }}
                            className={`inline-flex items-center gap-6 text-sm font-medium text-[var(--theme-ink)] hover:text-[var(--theme-accent)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] rounded-sm ${
                              repIdx > 0 ? 'marquee-duplicate' : ''
                            }`}
                          >
                            <span className="inline-flex items-baseline gap-2">
                              {item.isFeatured && (
                                <span className="text-xs font-semibold text-[var(--theme-gold)]">
                                  重点
                                </span>
                              )}
                              <span>{item.title}</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="text-[var(--theme-ink-faint)] font-normal"
                            >
                              ·
                            </span>
                          </a>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
