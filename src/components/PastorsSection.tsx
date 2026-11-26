import { usePublicChurchData } from '../context/ChurchDataContext';
import { CHURCH_IMAGES } from '../data/churchData';
import { SafeImage } from './SafeImage';

export function PastorsSection() {
  const { churchInfo, coworkers, cloudLoading } = usePublicChurchData();

  return (
    <section
      id="pastors"
      className="py-12 md:py-14 bg-[var(--theme-surface)]/55 border-b border-[var(--theme-border)] transition-colors duration-300"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div className="mb-7 md:mb-8">
          <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
            02. 牧养与事工团队
          </p>
          <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
            教会服事同工团队
          </h2>
        </div>

        {/* Unified Layout: Left Team Photo, Right Unified "讲台同工" Module */}
        <div className="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg overflow-hidden p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left 7 cols: Whole Church Coworker Team Group Photo Banner */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              <div className="w-full aspect-[16/10] rounded-md overflow-hidden bg-[var(--theme-surface-alt)] shadow-sm">
                <SafeImage
                  src={churchInfo.churchTeamImage || CHURCH_IMAGES.churchTeam}
                  alt="教会同工团队合影"
                  fallbackLabel="教会同工团队合影"
                  defer={cloudLoading}
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <div className="space-y-2.5">
                <div className="inline-block px-2.5 py-1 bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-accent)] font-medium">
                  同心同行 · 广传福音
                </div>
                <p className="text-sm text-[var(--theme-ink-muted)] leading-relaxed">
                  本教会服事同工团队不仅包含牧者、长老与讲台同工，也涵盖主日敬拜小组成员、祷告守望组成员、后勤卫生执勤及各项事工服事人员。众人各按恩赐彼此配搭，在圣道宣讲、敬拜赞美与日常关怀中忠心服事主所托付的群羊。
                </p>
              </div>
            </div>

            {/* Right 5 cols: Unified "讲台同工" Module with unified display style */}
            <div className="lg:col-span-5 bg-[var(--theme-surface)]/30 border border-[var(--theme-border)] rounded-md p-6 space-y-6">
              <div className="pb-3 border-b border-[var(--theme-border)]">
                <h3 className="font-editorial text-xl font-semibold text-[var(--theme-ink)] flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[var(--theme-accent)] rounded-full" />
                  讲台同工
                </h3>
                <p className="text-xs text-[var(--theme-ink-subtle)] mt-1">
                  牧师、长老、传道及讲台同工名录
                </p>
              </div>

              {/* Unified List of all pulpit coworkers (including pastors) */}
              <div className="space-y-3 divide-y divide-[var(--theme-border)]/75">
                {coworkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="pt-3 first:pt-0 flex items-center gap-3.5"
                  >
                    {worker.image ? (
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-[var(--theme-border)] bg-[var(--theme-surface-alt)] shrink-0">
                        <SafeImage
                          src={worker.image}
                          alt={`${worker.name}头像`}
                          fallbackLabel={worker.name.slice(0, 1)}
                          defer={cloudLoading}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                    ) : (
                      <div
                        aria-hidden="true"
                        className="w-9 h-9 rounded-full border border-[var(--theme-border-strong)] bg-[var(--theme-bg)] flex items-center justify-center font-editorial text-xs font-semibold text-[var(--theme-accent)] shrink-0"
                      >
                        {worker.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium text-[var(--theme-ink)] leading-snug">
                        {worker.name}
                      </p>
                      <p className="text-xs text-[var(--theme-ink-subtle)] leading-snug">
                        {worker.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
