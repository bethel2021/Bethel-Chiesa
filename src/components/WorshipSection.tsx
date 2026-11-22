import { useRef, useState } from 'react';
import { ExternalLink, PlayCircle } from 'lucide-react';
import { AnimatePresence, motion, useInView, useReducedMotion, type Variants } from 'motion/react';
import { useChurchData } from '../context/ChurchDataContext';

export function WorshipSection() {
  const { worshipTimes, liturgySteps, worshipSongs } = useChurchData();
  const [liturgyType, setLiturgyType] = useState<'standard' | 'communion'>('standard');
  const liturgyListRef = useRef<HTMLDivElement>(null);
  const isLiturgyInView = useInView(liturgyListRef, {
    once: true,
    margin: '0px 0px -60px 0px',
  });
  const shouldReduceMotion = useReducedMotion();

  const steps = liturgySteps.filter((step) => step.liturgyType === liturgyType);

  const listVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.25,
        staggerChildren: shouldReduceMotion ? 0 : 0.055,
        delayChildren: shouldReduceMotion ? 0 : 0.04,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: shouldReduceMotion ? 0.01 : 0.16, ease: 'easeOut' },
    },
  };

  const stepItemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 12,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.42,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <section id="worship" className="py-12 md:py-14 border-b border-[#E5DFD3]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-7 md:mb-8">
          <p className="text-xs tracking-widest text-[#78716C] mb-2">
            03. 礼拜堂与敬拜生活
          </p>
          <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[#1C1917] tracking-tight">
            主日崇拜时间、流程与敬拜诗歌
          </h2>
        </div>

        {/* Part A: Sunday Schedule Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {worshipTimes.map((slot) => (
            <div
              key={slot.id}
              className="bg-[#F3EFE6]/70 border border-[#E5DFD3] rounded-lg p-5 flex flex-col justify-between"
            >
              <div>
                <p className="font-mono text-xs font-medium text-[#1E3A5F] tabular-nums mb-1.5">
                  {slot.time}
                </p>
                <h3 className="font-editorial text-lg font-semibold text-[#1C1917] mb-2">
                  {slot.title}
                </h3>
                <p className="text-xs text-[#57534E] leading-relaxed mb-3">
                  {slot.desc}
                </p>
              </div>
              <p className="text-xs text-[#78716C] pt-3 border-t border-[#DFD8C8]">
                地点：{slot.place}
              </p>
            </div>
          ))}
        </div>

        {/* Part B: 2-Column Split — Liturgy Order & Worship Songs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left 7 cols: Order of Worship */}
          <div className="lg:col-span-7 bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5DFD3]">
              <div>
                <h3 className="font-editorial text-2xl font-semibold text-[#1C1917]">
                  主日崇拜流程
                </h3>
                <p className="text-xs text-[#78716C] mt-1">
                  每月第一主日为圣餐主日，其余主日采用常规崇拜礼仪
                </p>
              </div>

              {/* Segmented Filter Control */}
              <div
                role="tablist"
                aria-label="选择主日崇拜流程类型"
                className="inline-flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-md self-start sm:self-auto shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={liturgyType === 'standard'}
                  onClick={() => setLiturgyType('standard')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                    liturgyType === 'standard'
                      ? 'bg-[#FAF8F4] text-[#1C1917] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  常规主日流程
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={liturgyType === 'communion'}
                  onClick={() => setLiturgyType('communion')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                    liturgyType === 'communion'
                      ? 'bg-[#FAF8F4] text-[#1C1917] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  圣餐主日流程
                </button>
              </div>
            </div>

            <div ref={liturgyListRef}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={liturgyType}
                  variants={listVariants}
                  initial="hidden"
                  animate={isLiturgyInView ? 'visible' : 'hidden'}
                  exit="exit"
                  className="divide-y divide-[#EFEAE0]"
                >
                  {steps.map((item) => (
                    <motion.div
                      key={item.id}
                      variants={stepItemVariants}
                      className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-start"
                    >
                      <div className="sm:col-span-2 font-mono text-sm font-medium text-[#1E3A5F] tabular-nums pt-0.5">
                        {item.time}
                      </div>
                      <div className="sm:col-span-10">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
                          <h4 className="font-medium text-base text-[#1C1917]">
                            {item.step}
                          </h4>
                          <span className="text-xs text-[#78716C]">{item.leader}</span>
                        </div>
                        <p className="text-xs font-medium text-[#8B5E34] mb-1">
                          {item.scriptureOrHymn}
                        </p>
                        <p className="text-xs text-[#57534E] leading-relaxed">
                          {item.note}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right 5 cols: Sunday Worship Songs (Title + YouTube Link) */}
          <div className="lg:col-span-5 bg-[#F3EFE6]/70 border border-[#E5DFD3] rounded-lg p-6 md:p-8">
            <div className="pb-6 border-b border-[#DFD8C8]">
              <p className="text-xs tracking-widest text-[#78716C] mb-1">
                本周主日敬拜曲目
              </p>
              <h3 className="font-editorial text-2xl font-semibold text-[#1C1917]">
                主日崇拜歌曲
              </h3>
              <p className="text-xs text-[#57534E] mt-1">
                点击下方诗歌对应的 YouTube 链接即可提前聆听与预备敬拜
              </p>
            </div>

            <div className="divide-y divide-[#DFD8C8]">
              {worshipSongs.map((song, idx) => {
                const links = [song.youtubeUrl, song.youtubeUrl2].filter(
                  (url): url is string =>
                    typeof url === 'string' &&
                    /^https:\/\/([a-zA-Z0-9-]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/.+$/.test(
                      url.trim()
                    )
                );
                return (
                  <div
                    key={song.id}
                    className="py-5 first:pt-4 last:pb-2 flex flex-col gap-2"
                  >
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-xs text-[#8B5E34] tabular-nums shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <h4 className="font-editorial text-lg font-semibold text-[#1C1917] leading-snug">
                        {song.title}
                      </h4>
                    </div>

                    <div className="pl-6">
                      {links.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                          {links.map((url, linkIdx) => (
                            <a
                              key={`${song.id}-yt-${linkIdx}`}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] hover:text-[#162C49] hover:underline underline-offset-4 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] rounded-sm"
                            >
                              <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {links.length > 1
                                  ? `在 YouTube 观看视频 ${linkIdx + 1}`
                                  : '在 YouTube 观看视频'}
                              </span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[#78716C]">暂未添加 YouTube 链接</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
