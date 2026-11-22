import { useChurchData } from '../context/ChurchDataContext';
import { SafeImage } from './SafeImage';

export function ChurchIntroSection() {
  const { churchInfo } = useChurchData();

  return (
    <section id="intro" className="py-12 md:py-14 border-b border-[#E5DFD3]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-7 md:mb-8">
          <p className="text-xs tracking-widest text-[#78716C] mb-2">
            01. 认识我们 · {churchInfo.founded}
          </p>
          <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[#1C1917] tracking-tight">
            教会简介与异象使命
          </h2>
        </div>

        {/* Two-column balanced editorial grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Column: Prose & Image */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-8">
            <div className="space-y-5 max-w-prose">
              {churchInfo.introParagraphs.map((paragraph, idx) => (
                <p
                  key={idx}
                  className={`text-base text-[#292524] leading-[1.8] ${
                    idx === 0
                      ? 'first-letter:text-4xl first-letter:font-editorial first-letter:font-semibold first-letter:text-[#1E3A5F] first-letter:float-left first-letter:mr-2.5 first-letter:leading-none first-letter:mt-1'
                      : ''
                  }`}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-2 aspect-[4/3] w-full overflow-hidden rounded-lg border border-[#E5DFD3] bg-[#F3EFE6]">
              <SafeImage
                src={churchInfo.fellowshipImage}
                alt="主日崇拜后弟兄姊妹在伯特利教会交谊厅围坐读经与茶叙"
                fallbackLabel="伯特利教会肢体团契交流"
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>

          {/* Right Column: Core Values List separated by hairline dividers */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#F3EFE6]/70 border border-[#E5DFD3] rounded-lg p-7 md:p-8">
            <div>
              <p className="text-xs tracking-widest text-[#78716C] mb-1">
                信仰根基与教会生活
              </p>
              <h3 className="font-editorial text-2xl font-semibold text-[#1C1917] mb-6">
                四项核心异象
              </h3>

              <div className="divide-y divide-[#DFD8C8]">
                {churchInfo.coreValues.map((item) => (
                  <div key={item.index} className="py-5 first:pt-2 last:pb-2">
                    <div className="flex items-baseline gap-3 mb-1.5">
                      <span className="font-mono text-xs font-medium text-[#8B5E34] tabular-nums">
                        {item.index}.
                      </span>
                      <h4 className="font-editorial text-lg font-semibold text-[#1C1917]">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-sm text-[#57534E] leading-relaxed pl-7">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quiet Pull Quote */}
            <div className="mt-8 pt-6 border-t border-[#DFD8C8]">
              <p className="font-editorial text-base italic text-[#1C1917] leading-relaxed">
                {churchInfo.themeVerse}
              </p>
              <p className="text-xs text-[#78716C] mt-2">{churchInfo.themeVerseRef}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
