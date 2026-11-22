import { useChurchData } from '../context/ChurchDataContext';
import { SafeImage } from './SafeImage';

export function PastorsSection() {
  const { pastors, coworkers } = useChurchData();

  const seniorPastor =
    pastors.find((p) => p.role.includes('主任牧师')) ?? pastors[0] ?? null;
  const otherPastors = seniorPastor
    ? pastors.filter((p) => p.id !== seniorPastor.id)
    : [];

  return (
    <section id="pastors" className="py-12 md:py-14 bg-[#F3EFE6]/55 border-b border-[#E5DFD3]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7 md:mb-8">
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

        {/* Unified Pastors & Pulpit Coworkers Module */}
        <div className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left 8 cols: Senior Pastor (portrait left, bio right) + Associate Pastors & Elders */}
            <div className="lg:col-span-8 p-6 md:p-8 flex flex-col">
              {seniorPastor && (
                <article className="flex flex-col sm:flex-row gap-6 md:gap-7 items-start">
                  <div className="w-full sm:w-52 md:w-56 aspect-[3/4] rounded-md overflow-hidden bg-[#EFEAE0] shrink-0">
                    <SafeImage
                      src={seniorPastor.image}
                      alt={`${seniorPastor.name}肖像`}
                      fallbackLabel={seniorPastor.name}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col self-stretch">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#78716C] mb-1.5">
                      <span>{seniorPastor.role}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{seniorPastor.tenure}</span>
                    </div>

                    <h3 className="font-editorial text-2xl font-semibold text-[#1C1917] mb-3">
                      {seniorPastor.name}
                    </h3>

                    <p className="text-sm text-[#57534E] leading-relaxed mb-5 flex-1">
                      {seniorPastor.bio}
                    </p>

                    <dl className="pt-4 border-t border-[#E5DFD3] space-y-2 text-xs">
                      <div>
                        <dt className="text-[#78716C] inline">神学装备：</dt>
                        <dd className="text-[#1C1917] inline">{seniorPastor.education}</dd>
                      </div>
                      <div>
                        <dt className="text-[#78716C] inline">主要负担：</dt>
                        <dd className="text-[#1C1917] inline">{seniorPastor.ministryFocus}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              )}

              {otherPastors.length > 0 && (
                <div
                  className={`${
                    seniorPastor ? 'pt-7 mt-7 border-t border-[#E5DFD3]' : ''
                  } grid ${
                    otherPastors.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-1 md:grid-cols-2'
                  } gap-7`}
                >
                  {otherPastors.map((pastor) => (
                    <article key={pastor.id} className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="w-full sm:w-28 aspect-[3/4] rounded-md overflow-hidden bg-[#EFEAE0] shrink-0">
                        <SafeImage
                          src={pastor.image}
                          alt={`${pastor.name}肖像`}
                          fallbackLabel={pastor.name}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#78716C] mb-1">
                          <span>{pastor.role}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{pastor.tenure}</span>
                        </div>

                        <h3 className="font-editorial text-xl font-semibold text-[#1C1917] mb-2">
                          {pastor.name}
                        </h3>

                        <p className="text-xs text-[#57534E] leading-relaxed mb-3">
                          {pastor.bio}
                        </p>

                        <dl className="pt-3 border-t border-[#E5DFD3] space-y-1 text-xs">
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
              )}
            </div>

            {/* Right 4 cols: Integrated Pulpit Coworkers Sidebar */}
            <aside className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[#E5DFD3] bg-[#F3EFE6]/35 p-6 md:p-7 flex flex-col">
              <div className="pb-4 border-b border-[#E5DFD3]">
                <h3 className="font-editorial text-xl font-semibold text-[#1C1917]">
                  讲台轮值同工
                </h3>
                <p className="text-xs text-[#78716C] mt-1">
                  按月度讲台编排轮值证道及查经带领
                </p>
              </div>

              <div className="divide-y divide-[#E5DFD3]/75 flex-1">
                {coworkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="py-4 last:pb-0 flex items-center gap-3.5"
                  >
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
                        className="w-10 h-10 rounded-full border border-[#DFD8C8] bg-[#FAF8F4] flex items-center justify-center font-editorial text-sm font-semibold text-[#1E3A5F] shrink-0"
                      >
                        {worker.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium text-[#1C1917] leading-snug">
                        {worker.name}
                      </p>
                      <p className="text-xs text-[#78716C] leading-snug">
                        {worker.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
