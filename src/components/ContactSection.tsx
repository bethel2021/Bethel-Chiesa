import { useState, type FormEvent } from 'react';
import { CheckCircle2, ExternalLink, MapPin, Navigation, Phone } from 'lucide-react';
import { useChurchData } from '../context/ChurchDataContext';
import { buildGoogleMapsDirectionsUrl } from '../lib/googleMaps';

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
      setError('提交留言时遇到网络问题，请稍后重试或拨打联系电话。');
    } finally {
      setSubmitting(false);
    }
  };

  const directionsUrl = buildGoogleMapsDirectionsUrl({
    destination: churchInfo.address,
  });

  return (
    <section
      id="contact"
      className="py-12 md:py-14 bg-[var(--theme-surface)]/55 transition-colors duration-300"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-2xl mb-7 md:mb-8">
          <p className="text-xs tracking-widest text-[var(--theme-ink-subtle)] mb-2">
            07. 欢迎来到神的殿
          </p>
          <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[var(--theme-ink)] tracking-tight">
            联系方式
          </h2>
        </div>

        {/* Unified Contact Info + Visitor & Prayer Request + Map Preview Card */}
        <div className="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left 5 cols: Visitor Intro + Church Address & Pastoral Phone */}
            <div className="lg:col-span-5 bg-[var(--theme-surface)]/45 border-b lg:border-b-0 lg:border-r border-[var(--theme-border)] p-6 md:p-8 flex flex-col justify-between gap-8">
              <div>
                <h3 className="font-editorial text-2xl font-semibold text-[var(--theme-ink)]">
                  新朋友来访登记与代祷联系
                </h3>
                <p className="text-xs text-[var(--theme-ink-muted)] mt-2 leading-relaxed">
                  若您计划本主日初次来访、希望参加慕道班/小组，或有需要牧者守望代祷的事项，欢迎在此留言，或直接拨打联系电话。
                </p>
              </div>

              <div className="pt-6 border-t border-[var(--theme-border)] space-y-5">
                <div className="flex items-start gap-3.5">
                  <MapPin className="w-5 h-5 text-[var(--theme-accent)] shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-semibold text-[var(--theme-ink)]">教会堂址</h4>
                    <p className="text-sm text-[var(--theme-ink-body)] leading-relaxed">
                      {churchInfo.address}
                    </p>
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--theme-accent)] hover:text-[var(--theme-accent-hover)] hover:underline underline-offset-4"
                    >
                      <Navigation className="w-3.5 h-3.5 shrink-0" />
                      <span>在 Google Maps 中开启导航</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                    </a>
                  </div>
                </div>

                <div className="border-t border-[var(--theme-border)]/80 pt-5 flex items-start gap-3.5">
                  <Phone className="w-5 h-5 text-[var(--theme-accent)] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--theme-ink)] mb-1">联系电话</h4>
                    <p className="text-sm font-medium text-[var(--theme-ink)] tabular-nums">
                      {churchInfo.pastoralPhone}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 7 cols: Interactive Visitor / Prayer Request Form */}
            <div className="lg:col-span-7 p-6 md:p-8">
              {submitted ? (
                <div className="h-full min-h-[280px] flex flex-col items-center justify-center py-8 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-[var(--theme-accent)] mx-auto" strokeWidth={1.6} />
                  <h4 className="font-editorial text-xl font-semibold text-[var(--theme-ink)]">
                    已收到您的来访留言
                  </h4>
                  <p className="text-sm text-[var(--theme-ink-muted)] max-w-md mx-auto leading-relaxed">
                    感谢「{form.name}」，教会迎新与教牧同工已记录您的「{form.intent}」信息，将于两个工作日内与您联系，主日欢迎您来到伯特利堂！
                  </p>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(INITIAL_FORM);
                        setSubmitted(false);
                      }}
                      className="px-4 py-2 text-xs font-medium text-[var(--theme-accent)] border border-[var(--theme-accent)]/30 hover:bg-[var(--theme-accent)]/5 rounded-md transition-colors cursor-pointer"
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
                        className="block text-xs font-medium text-[var(--theme-ink-body)] mb-1.5"
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
                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--theme-card)] border border-[var(--theme-border-input)] rounded-md text-[var(--theme-ink)] placeholder:text-[var(--theme-ink-faint)] focus:outline-none focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="visitor-contact"
                        className="block text-xs font-medium text-[var(--theme-ink-body)] mb-1.5"
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
                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--theme-card)] border border-[var(--theme-border-input)] rounded-md text-[var(--theme-ink)] placeholder:text-[var(--theme-ink-faint)] focus:outline-none focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="visitor-intent"
                      className="block text-xs font-medium text-[var(--theme-ink-body)] mb-1.5"
                    >
                      联系事项
                    </label>
                    <select
                      id="visitor-intent"
                      value={form.intent}
                      onChange={(e) => setForm({ ...form, intent: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-[var(--theme-card)] border border-[var(--theme-border-input)] rounded-md text-[var(--theme-ink)] focus:outline-none focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)]"
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
                      className="block text-xs font-medium text-[var(--theme-ink-body)] mb-1.5"
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
                      className="w-full px-3.5 py-2.5 text-sm bg-[var(--theme-card)] border border-[var(--theme-border-input)] rounded-md text-[var(--theme-ink)] placeholder:text-[var(--theme-ink-faint)] focus:outline-none focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)] resize-none"
                    />
                  </div>

                  {error && (
                    <p role="alert" className="text-xs font-medium text-[var(--theme-alert)]">
                      {error}
                    </p>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-4">
                    <span className="text-xs text-[var(--theme-ink-subtle)]">
                      所有信息仅用于教牧关怀与来访接待
                    </span>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 text-sm font-medium text-white bg-[var(--theme-accent)] hover:bg-[var(--theme-accent-hover)] disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2"
                    >
                      {submitting ? '正在提交…' : '提交来访登记'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
