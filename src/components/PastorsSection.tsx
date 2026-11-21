import { useChurchData } from '../context/ChurchDataContext';
import { SafeImage } from './SafeImage';

export function PastorsSection() {
  const { pastors, coworkers } = useChurchData();

  return (
    <section id="pastors" className="py-20 md:py-24 bg-[#F3EFE6]/55 border-b border-[#E5DFD3]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div className="max-w-2xl">
            <p className="text-xs tracking-widest text-[#78716C] mb-2">
              02. 牧养与讲台团队
            </p>
            <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[#1C1917] tracking-tight">
              牧者及讲台同工介绍
            </h2>
          </div>
          <p className="text-sm text-[#57534E] max-w-md">
            教牧同工团队与长执会同心同行，在圣道宣讲、圣礼施行与日常牧养关怀中忠心服事教会。
          </p>
        </div>

        {/* 3-Column Editorial Portrait Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {pastors.map((pastor) => (
            <article
              key={pastor.id}
              className="flex flex-col bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg overflow-hidden"
            >
              <div className="aspect-[3/4] w-full overflow-hidden bg-[#EFEAE0]">
                <SafeImage
                  src={pastor.image}
                  alt={`${pastor.name}肖像`}
                  fallbackLabel={pastor.name}
                  className="w-full h-full object-cover object-top"
                />
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-xs text-[#78716C] mb-2">
                  <span>{pastor.role}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{pastor.tenure}</span>
                </div>

                <h3 className="font-editorial text-2xl font-semibold text-[#1C1917] mb-3">
                  {pastor.name}
                </h3>

                <p className="text-sm text-[#57534E] leading-relaxed mb-5 flex-1">
                  {pastor.bio}
                </p>

                <dl className="pt-4 border-t border-[#E5DFD3] space-y-2 text-xs">
                  <div>
                    <dt className="text-[#78716C] inline">神学装备：</dt>
                    <dd className="text-[#1C1917] inline">{pastor.education}</dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C] inline">主要负担：</dt>
                    <dd className="text-[#1C1917] inline">{pastor.ministryFocus}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>

        {/* Pulpit Coworkers Directory */}
        <div className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-5 border-b border-[#E5DFD3]">
            <h3 className="font-editorial text-xl font-semibold text-[#1C1917]">
              讲台轮值同工与圣乐事奉负责
            </h3>
            <span className="text-xs text-[#78716C]">
              按月度讲台编排轮值证道及查经带领
            </span>
          </div>

          <div className="divide-y divide-[#EFEAE0]">
            {coworkers.map((worker) => (
              <div
                key={worker.id}
                className="py-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-6 items-center text-sm"
              >
                <div className="md:col-span-3 flex items-center gap-3">
                  {worker.image ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E5DFD3] bg-[#EFEAE0] shrink-0">
                      <SafeImage
                        src={worker.image}
                        alt={`${worker.name}头像`}
                        fallbackLabel={worker.name.slice(0, 1)}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="w-10 h-10 rounded-full border border-[#DFD8C8] bg-[#F3EFE6] flex items-center justify-center font-editorial text-sm font-semibold text-[#1E3A5F] shrink-0"
                    >
                      {worker.name.slice(0, 1)}
                    </div>
                  )}
                  <span className="font-medium text-[#1C1917]">{worker.name}</span>
                </div>
                <div className="md:col-span-3 text-xs text-[#78716C]">
                  {worker.title}
                </div>
                <div className="md:col-span-3 text-[#292524]">
                  {worker.responsibility}
                </div>
                <div className="md:col-span-3 text-xs text-[#1E3A5F]">
                  近期焦点：{worker.sermonTopic}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
