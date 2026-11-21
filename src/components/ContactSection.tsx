import { useState, type FormEvent } from 'react';
import { CheckCircle2, Mail, MapPin, Phone, Train } from 'lucide-react';
import { useChurchData } from '../context/ChurchDataContext';

interface FormState {
  name: string;
  contact: string;
  intent: string;
  message: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  contact: '',
  intent: '主日初次来访',
  message: '',
};

export function ContactSection() {
  const { churchInfo, submitVisitorRequest } = useChurchData();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('请填写您的姓名或称呼。');
      return;
    }
    if (!form.contact.trim() || form.contact.trim().length < 5) {
      setError('请填写有效的联系电话或电子邮箱，以便同工与您联系。');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await submitVisitorRequest({
        name: form.name,
        contact: form.contact,
        intent: form.intent,
        message: form.message,
      });
      setSubmitted(true);
    } catch {
      setError('提交留言时遇到网络问题，请稍后重试或直接致电教会办公室。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-20 md:py-24 bg-[#F3EFE6]/55">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-xs tracking-widest text-[#78716C] mb-2">
            07. 欢迎来到神的殿
          </p>
          <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[#1C1917] tracking-tight">
            联系方式与主日来访指引
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left 6 cols: Address, Phone, Transit */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg p-6 md:p-8 space-y-6">
              <div className="flex items-start gap-3.5">
                <MapPin className="w-5 h-5 text-[#1E3A5F] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#1C1917] mb-1">教会堂址</h3>
                  <p className="text-sm text-[#292524] leading-relaxed">
                    {churchInfo.address}
                  </p>
                  <p className="text-xs text-[#78716C] mt-1 tabular-nums">
                    办公开放时间：{churchInfo.officeHours}
                  </p>
                </div>
              </div>

              <div className="border-t border-[#EFEAE0] pt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-1" />
                  <div>
                    <h4 className="text-xs font-medium text-[#78716C] mb-1">办公室与教牧电话</h4>
                    <p className="text-sm font-medium text-[#1C1917] tabular-nums">
                      {churchInfo.phone}
                    </p>
                    <p className="text-xs text-[#57534E] mt-0.5 tabular-nums">
                      {churchInfo.pastoralPhone}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-1" />
                  <div>
                    <h4 className="text-xs font-medium text-[#78716C] mb-1">邮箱与公众号</h4>
                    <p className="text-sm font-medium text-[#1C1917] break-all">
                      {churchInfo.email}
                    </p>
                    <p className="text-xs text-[#57534E] mt-0.5">
                      微信服务号：{churchInfo.wechatId}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#EFEAE0] pt-5 flex items-start gap-3.5">
                <Train className="w-5 h-5 text-[#1E3A5F] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#1C1917] mb-2">公共交通指引</h3>
                  <ul className="space-y-1.5 text-xs text-[#57534E] leading-relaxed">
                    {churchInfo.transitGuide.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right 6 cols: Interactive Visitor / Prayer Request Form */}
          <div className="lg:col-span-6 bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg p-6 md:p-8">
            <div className="pb-5 mb-6 border-b border-[#E5DFD3]">
              <h3 className="font-editorial text-2xl font-semibold text-[#1C1917]">
                新朋友来访登记与代祷联系
              </h3>
              <p className="text-xs text-[#57534E] mt-1">
                若您计划本主日初次来访、希望参加慕道班/小组，或有需要牧者守望代祷的事项，欢迎在此留言。
              </p>
            </div>

            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-[#1E3A5F] mx-auto" strokeWidth={1.6} />
                <h4 className="font-editorial text-xl font-semibold text-[#1C1917]">
                  已收到您的来访留言
                </h4>
                <p className="text-sm text-[#57534E] max-w-md mx-auto leading-relaxed">
                  感谢「{form.name}」，教会迎新与教牧同工已记录您的「{form.intent}」信息，将于两个工作日内与您联系，主日欢迎您来到伯特利堂！
                </p>
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(INITIAL_FORM);
                      setSubmitted(false);
                    }}
                    className="px-4 py-2 text-xs font-medium text-[#1E3A5F] border border-[#1E3A5F]/30 hover:bg-[#1E3A5F]/5 rounded-md transition-colors cursor-pointer"
                  >
                    提交另一条登记
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="visitor-name"
                      className="block text-xs font-medium text-[#292524] mb-1.5"
                    >
                      您的姓名或称呼 *
                    </label>
                    <input
                      id="visitor-name"
                      type="text"
                      maxLength={80}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="例如：张弟兄 / 李女士"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D6CFC2] rounded-md text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="visitor-contact"
                      className="block text-xs font-medium text-[#292524] mb-1.5"
                    >
                      手机号码或电子邮箱 *
                    </label>
                    <input
                      id="visitor-contact"
                      type="text"
                      maxLength={140}
                      value={form.contact}
                      onChange={(e) => setForm({ ...form, contact: e.target.value })}
                      placeholder="方便同工回访与发送聚会指引"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D6CFC2] rounded-md text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="visitor-intent"
                    className="block text-xs font-medium text-[#292524] mb-1.5"
                  >
                    联系事项
                  </label>
                  <select
                    id="visitor-intent"
                    value={form.intent}
                    onChange={(e) => setForm({ ...form, intent: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D6CFC2] rounded-md text-[#1C1917] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                  >
                    <option value="主日初次来访">主日初次来访（预约迎新接待）</option>
                    <option value="报名慕道班或洗礼班">报名慕道班 / 洗礼预备班</option>
                    <option value="加入周间小组或团契">希望加入周间查经小组 / 团契</option>
                    <option value="代祷请求与教牧辅导">代祷请求与教牧关怀面谈</option>
                    <option value="诗班或事工服事咨询">圣诗班招募或主日事工咨询</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="visitor-message"
                    className="block text-xs font-medium text-[#292524] mb-1.5"
                  >
                    留言或代祷事项说明
                  </label>
                  <textarea
                    id="visitor-message"
                    rows={3}
                    maxLength={1000}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="可简述同行人数、儿童年龄（如需儿童主日学）或需要牧者代祷的内容"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D6CFC2] rounded-md text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] resize-none"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs font-medium text-[#9A3412]">
                    {error}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-between gap-4">
                  <span className="text-xs text-[#78716C]">
                    所有信息仅用于教牧关怀与来访接待
                  </span>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2"
                  >
                    {submitting ? '正在提交…' : '提交来访登记'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
