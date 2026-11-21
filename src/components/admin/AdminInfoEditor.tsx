import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useChurchData } from '../../context/ChurchDataContext';
import { CHURCH_IMAGES, type ChurchInfo } from '../../data/churchData';
import {
  AdminPanelHeader,
  FieldLabel,
  inputClass,
  StatusBanner,
  textareaClass,
} from './AdminSharedUI';
import { ImageFieldControl } from './ImageFieldControl';

export function AdminInfoEditor() {
  const { churchInfo, saveChurchInfo } = useChurchData();
  const [form, setForm] = useState<ChurchInfo>(churchInfo);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    setForm(churchInfo);
  }, [churchInfo]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await saveChurchInfo(form);
      setStatus({ type: 'success', message: '教会简介、主视觉与联系方式已保存并同步到首页。' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : '保存失败，请确认管理员权限与字段长度。',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <AdminPanelHeader
        title="教会简介与基本信息"
        description="编辑首屏主视觉、教会历史简介、四项核心异象、堂址及教牧联系电话。"
        action={
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            {saving ? '正在保存…' : '保存全部更改'}
          </button>
        }
      />

      <StatusBanner status={status} onClear={() => setStatus(null)} />

      {/* Block 1: Hero & Identity */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg p-6 space-y-4">
        <h3 className="font-editorial text-lg font-semibold text-[#1C1917] pb-2 border-b border-[#EFEAE0]">
          1. 教会名称与首屏主视觉
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldLabel label="教会中文名称">
            <input
              type="text"
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="英文名称">
            <input
              type="text"
              required
              maxLength={100}
              value={form.englishName}
              onChange={(e) => setForm({ ...form, englishName: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="创立年份标示">
            <input
              type="text"
              required
              maxLength={100}
              value={form.founded}
              onChange={(e) => setForm({ ...form, founded: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <FieldLabel label="首屏主经文引语">
              <input
                type="text"
                required
                maxLength={400}
                value={form.scriptureQuote}
                onChange={(e) => setForm({ ...form, scriptureQuote: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          </div>
          <FieldLabel label="经文出处">
            <input
              type="text"
              required
              maxLength={100}
              value={form.scriptureRef}
              onChange={(e) => setForm({ ...form, scriptureRef: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
        </div>

        <FieldLabel label="首屏邀请副标题">
          <input
            type="text"
            required
            maxLength={400}
            value={form.heroSubtitle}
            onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
            className={inputClass}
          />
        </FieldLabel>

        <div className="grid grid-cols-1 gap-4 pt-1">
          <ImageFieldControl
            label="主堂主视觉图片"
            value={form.heroImage}
            onChange={(nextUrl) => setForm({ ...form, heroImage: nextUrl })}
            defaultValue={CHURCH_IMAGES.heroSanctuary}
            previewAspect="landscape"
            maxWidth={1280}
            maxHeight={720}
            maxChars={180000}
            hint="建议横向大图（自动压缩优化至 135 KB 内），或填写外链网址"
            required
          />
          <ImageFieldControl
            label="教会简介团契图片"
            value={form.fellowshipImage}
            onChange={(nextUrl) => setForm({ ...form, fellowshipImage: nextUrl })}
            defaultValue={CHURCH_IMAGES.fellowshipIntro}
            previewAspect="landscape"
            maxWidth={1000}
            maxHeight={750}
            maxChars={180000}
            hint="建议 4:3 横图（自动压缩优化），或填写外链网址"
            required
          />
        </div>
      </div>

      {/* Block 2: Intro Paragraphs & Core Values */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-[#EFEAE0]">
          <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
            2. 教会简介正文与年度主题经文
          </h3>
          <button
            type="button"
            onClick={() =>
              form.introParagraphs.length < 10 &&
              setForm({ ...form, introParagraphs: [...form.introParagraphs, ''] })
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            添加简介段落
          </button>
        </div>

        <div className="space-y-3">
          {form.introParagraphs.map((para, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <textarea
                rows={3}
                maxLength={1000}
                value={para}
                onChange={(e) => {
                  const next = [...form.introParagraphs];
                  next[idx] = e.target.value;
                  setForm({ ...form, introParagraphs: next });
                }}
                placeholder={`第 ${idx + 1} 段教会简介`}
                className={textareaClass}
              />
              {form.introParagraphs.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = form.introParagraphs.filter((_, i) => i !== idx);
                    setForm({ ...form, introParagraphs: next });
                  }}
                  aria-label="删除段落"
                  className="p-2 text-[#78716C] hover:text-[#9A3412] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="md:col-span-2">
            <FieldLabel label="年度主题经文">
              <input
                type="text"
                required
                maxLength={300}
                value={form.themeVerse}
                onChange={(e) => setForm({ ...form, themeVerse: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          </div>
          <FieldLabel label="主题经文出处">
            <input
              type="text"
              required
              maxLength={100}
              value={form.themeVerseRef}
              onChange={(e) => setForm({ ...form, themeVerseRef: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
        </div>

        <div className="pt-4 border-t border-[#EFEAE0]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#292524]">核心异象条目（最多 10 项）</span>
            <button
              type="button"
              onClick={() =>
                form.coreValues.length < 10 &&
                setForm({
                  ...form,
                  coreValues: [
                    ...form.coreValues,
                    {
                      index: String(form.coreValues.length + 1).padStart(2, '0'),
                      title: '',
                      description: '',
                    },
                  ],
                })
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              添加异象条目
            </button>
          </div>

          <div className="space-y-3">
            {form.coreValues.map((cv, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-[#FAF8F4] p-3 rounded border border-[#EFEAE0]"
              >
                <div className="md:col-span-2">
                  <input
                    type="text"
                    maxLength={10}
                    value={cv.index}
                    onChange={(e) => {
                      const next = [...form.coreValues];
                      next[idx] = { ...cv, index: e.target.value };
                      setForm({ ...form, coreValues: next });
                    }}
                    placeholder="序号"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    type="text"
                    maxLength={60}
                    value={cv.title}
                    onChange={(e) => {
                      const next = [...form.coreValues];
                      next[idx] = { ...cv, title: e.target.value };
                      setForm({ ...form, coreValues: next });
                    }}
                    placeholder="异象标题"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-6">
                  <input
                    type="text"
                    maxLength={300}
                    value={cv.description}
                    onChange={(e) => {
                      const next = [...form.coreValues];
                      next[idx] = { ...cv, description: e.target.value };
                      setForm({ ...form, coreValues: next });
                    }}
                    placeholder="简要说明"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const next = form.coreValues.filter((_, i) => i !== idx);
                      setForm({ ...form, coreValues: next });
                    }}
                    aria-label="删除异象"
                    className="p-2 text-[#78716C] hover:text-[#9A3412] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Block 3: Address & Pastoral Phone */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg p-6 space-y-4">
        <h3 className="font-editorial text-lg font-semibold text-[#1C1917] pb-2 border-b border-[#EFEAE0]">
          3. 堂址与教牧联系电话
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <FieldLabel label="完整堂址">
              <input
                type="text"
                required
                maxLength={300}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          </div>
          <FieldLabel label="简称（用于顶部/导览条）">
            <input
              type="text"
              required
              maxLength={100}
              value={form.shortAddress}
              onChange={(e) => setForm({ ...form, shortAddress: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
        </div>

        <FieldLabel label="联系电话">
          <input
            type="text"
            required
            maxLength={100}
            value={form.pastoralPhone}
            onChange={(e) => setForm({ ...form, pastoralPhone: e.target.value })}
            className={inputClass}
          />
        </FieldLabel>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded-md transition-colors cursor-pointer"
        >
          {saving ? '正在保存…' : '保存教会简介与基本信息'}
        </button>
      </div>
    </form>
  );
}
