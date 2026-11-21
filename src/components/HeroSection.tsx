import { ArrowDownRight } from 'lucide-react';
import { useChurchData } from '../context/ChurchDataContext';
import { SafeImage } from './SafeImage';

export function HeroSection() {
  const { churchInfo } = useChurchData();

  return (
    <section id="top" className="border-b border-[#E5DFD3]">
      {/* Architectural Sanctuary Focal Hero */}
      <div className="relative w-full h-[540px] md:h-[620px] overflow-hidden bg-[#1C1917]">
        <SafeImage
          src={churchInfo.heroImage}
          alt={`${churchInfo.name}主堂清晨阳光`}
          fallbackLabel={`${churchInfo.name}主堂建筑内景`}
          className="w-full h-full object-cover object-center"
        />

        {/* Measured Contrast Scrim */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#141210]/85 via-[#141210]/45 to-[#141210]/20"
        />

        <div className="absolute inset-0 flex items-end">
          <div className="max-w-[1200px] w-full mx-auto px-6 pb-12 md:pb-16">
            <div className="max-w-2xl text-white">
              <p className="text-xs md:text-sm tracking-widest text-[#E5DFD3] mb-3 font-medium">
                {churchInfo.founded} · {churchInfo.englishName} · {churchInfo.shortAddress}
              </p>

              <h1 className="font-editorial text-4xl sm:text-5xl md:text-[3.5rem] font-semibold leading-[1.15] tracking-tight text-white mb-4">
                {churchInfo.name}
              </h1>

              <p className="font-editorial text-base sm:text-lg text-[#F3EFE6] leading-relaxed mb-3">
                {churchInfo.scriptureQuote}
                <span className="text-sm text-[#D6CFC2] ml-2">—— {churchInfo.scriptureRef}</span>
              </p>

              <p className="text-sm sm:text-base text-[#E5DFD3]/90 leading-relaxed mb-7 max-w-xl">
                {churchInfo.heroSubtitle}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="#worship"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-[#1C1917] bg-[#FAF8F4] hover:bg-white rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span>了解本周主日崇拜</span>
                  <ArrowDownRight className="w-4 h-4" />
                </a>
                <a
                  href="#contact"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-[#F3EFE6] hover:text-white underline underline-offset-4 decoration-white/40 transition-colors whitespace-nowrap shrink-0"
                >
                  新朋友来访与联系
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Operational Utility Ribbon */}
      <div className="bg-[#F3EFE6]">
        <div className="max-w-[1200px] mx-auto px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 text-sm">
          <div className="flex flex-col gap-0.5 lg:border-r lg:border-[#DFD8C8] lg:pr-4">
            <span className="text-xs text-[#78716C]">主日崇拜</span>
            <span className="font-medium text-[#1C1917] tabular-nums">每周日 09:30 – 11:15（一楼大堂）</span>
          </div>
          <div className="flex flex-col gap-0.5 lg:border-r lg:border-[#DFD8C8] lg:pr-4">
            <span className="text-xs text-[#78716C]">分龄主日学</span>
            <span className="font-medium text-[#1C1917] tabular-nums">每周日 13:00 – 14:15（成人 · 少儿）</span>
          </div>
          <div className="flex flex-col gap-0.5 lg:border-r lg:border-[#DFD8C8] lg:pr-4">
            <span className="text-xs text-[#78716C]">周间查经祷告会</span>
            <span className="font-medium text-[#1C1917] tabular-nums">每周二晚 19:30 – 21:00</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-[#78716C]">教会堂址</span>
            <a
              href="#contact"
              className="font-medium text-[#1E3A5F] hover:underline underline-offset-4 truncate"
            >
              {churchInfo.shortAddress}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
