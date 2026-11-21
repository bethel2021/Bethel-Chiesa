import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useChurchData } from '../../context/ChurchDataContext';
import type { LiturgyStep, WorshipSong, WorshipTimeSlot } from '../../data/churchData';
import {
  AdminPanelHeader,
  FieldLabel,
  inputClass,
  StatusBanner,
  textareaClass,
} from './AdminSharedUI';

export function AdminWorshipEditor({ mode }: { mode: 'worship' | 'songs' }) {
  const {
    worshipTimes,
    liturgySteps,
    worshipSongs,
    saveWorshipTime,
    deleteWorshipTime,
    saveLiturgyStep,
    deleteLiturgyStep,
    saveWorshipSong,
    deleteWorshipSong,
  } = useChurchData();

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const [editingTime, setEditingTime] = useState<WorshipTimeSlot | null>(null);
  const [editingStep, setEditingStep] = useState<LiturgyStep | null>(null);
  const [editingSong, setEditingSong] = useState<WorshipSong | null>(null);
  const [liturgyFilter, setLiturgyFilter] = useState<'standard' | 'communion'>('standard');

  const handleSaveTime = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTime) return;
    setSaving(true);
    try {
      await saveWorshipTime(editingTime);
      setEditingTime(null);
      setStatus({ type: 'success', message: '主日聚会时段已保存。' });
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : '保存失败。' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStep = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStep) return;
    setSaving(true);
    try {
      await saveLiturgyStep(editingStep);
      setEditingStep(null);
      setStatus({ type: 'success', message: '主日崇拜流程步骤已保存。' });
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : '保存失败。' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSong = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSong) return;
    setSaving(true);
    setStatus(null);
    try {
      await saveWorshipSong(editingSong);
      setEditingSong(null);
      setStatus({ type: 'success', message: '主日崇拜歌曲与 YouTube 链接已保存。' });
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : '保存失败。' });
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'songs') {
    return (
      <div className="space-y-8">
        <AdminPanelHeader
          title="主日崇拜歌曲管理"
          description="管理本周主日敬拜诗歌清单，仅需维护诗歌名字与对应的 YouTube 视频链接。"
          action={
            <button
              type="button"
              onClick={() =>
                setEditingSong({
                  id: '',
                  title: '',
                  youtubeUrl: '',
                  sortOrder: worshipSongs.length + 1,
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新增崇拜歌曲
            </button>
          }
        />

        <StatusBanner status={status} onClear={() => setStatus(null)} />

        <div className="bg-white border border-[#E5DFD3] rounded-lg divide-y divide-[#EFEAE0]">
          {worshipSongs.map((song) => (
            <div
              key={song.id}
              className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-xs text-[#78716C] tabular-nums shrink-0">
                    #{song.sortOrder}
                  </span>
                  <h3 className="font-editorial text-lg font-semibold text-[#1C1917] truncate">
                    {song.title}
                  </h3>
                </div>
                {song.youtubeUrl ? (
                  <a
                    href={song.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-[#1E3A5F] hover:underline truncate"
                  >
                    {song.youtubeUrl}
                  </a>
                ) : (
                  <p className="text-xs text-[#78716C]">暂未设置 YouTube 视频链接</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingSong(song)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteWorshipSong(song.id);
                    setStatus({ type: 'success', message: `已删除「${song.title}」。` });
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#9A3412] border border-[#E7B9B0] hover:bg-[#FDF2F0] rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>

        {editingSong && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141210]/55"
          >
            <form
              onSubmit={handleSaveSong}
              className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
                <h3 className="font-editorial text-xl font-semibold text-[#1C1917]">
                  {editingSong.id ? '编辑敬拜诗歌' : '新增敬拜诗歌'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingSong(null)}
                  className="p-1.5 text-[#57534E] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <FieldLabel label="诗歌名字 *">
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={editingSong.title}
                  onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                  placeholder="例如：《奇异恩典》（Amazing Grace）"
                  className={inputClass}
                />
              </FieldLabel>

              <FieldLabel label="YouTube 视频链接" hint="支持 youtube.com 或 youtu.be 链接">
                <input
                  type="text"
                  maxLength={500}
                  value={editingSong.youtubeUrl}
                  onChange={(e) =>
                    setEditingSong({ ...editingSong, youtubeUrl: e.target.value })
                  }
                  placeholder="https://www.youtube.com/watch?v=..."
                  className={inputClass}
                />
              </FieldLabel>

              <FieldLabel label="排序权重">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={editingSong.sortOrder}
                  onChange={(e) =>
                    setEditingSong({ ...editingSong, sortOrder: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </FieldLabel>

              <div className="pt-3 border-t border-[#E5DFD3] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSong(null)}
                  className="px-4 py-2 text-xs font-medium text-[#57534E] border border-[#D6CFC2] rounded-md cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                >
                  {saving ? '保存中…' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  const filteredSteps = liturgySteps.filter((s) => s.liturgyType === liturgyFilter);

  return (
    <div className="space-y-10">
      <AdminPanelHeader
        title="主日崇拜时间与流程管理"
        description="编辑主日各时段聚会时间卡片，以及常规主日与圣餐主日的礼拜流程步骤。"
      />

      <StatusBanner status={status} onClear={() => setStatus(null)} />

      {/* Worship Times */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-[#F3EFE6]/70 border-b border-[#E5DFD3] flex items-center justify-between gap-4">
          <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
            主日崇拜与聚会时段（{worshipTimes.length}）
          </h3>
          <button
            type="button"
            onClick={() =>
              setEditingTime({
                id: '',
                time: '',
                title: '',
                place: '',
                desc: '',
                sortOrder: worshipTimes.length + 1,
              })
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增时段
          </button>
        </div>

        <div className="divide-y divide-[#EFEAE0]">
          {worshipTimes.map((slot) => (
            <div
              key={slot.id}
              className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1917]">
                  <span className="font-mono text-xs text-[#1E3A5F] tabular-nums">
                    {slot.time}
                  </span>
                  <span>{slot.title}</span>
                </div>
                <p className="text-xs text-[#57534E]">
                  地点：{slot.place} · {slot.desc}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingTime(slot)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteWorshipTime(slot.id);
                    setStatus({ type: 'success', message: `已删除「${slot.title}」。` });
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#9A3412] border border-[#E7B9B0] hover:bg-[#FDF2F0] rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liturgy Steps */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-[#F3EFE6]/70 border-b border-[#E5DFD3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
              主日崇拜流程步骤
            </h3>
            <div className="inline-flex items-center gap-1 p-0.5 bg-[#E7E0D3] rounded">
              <button
                type="button"
                onClick={() => setLiturgyFilter('standard')}
                className={`px-2.5 py-1 text-xs rounded cursor-pointer ${
                  liturgyFilter === 'standard'
                    ? 'bg-white text-[#1C1917] font-medium'
                    : 'text-[#57534E]'
                }`}
              >
                常规主日
              </button>
              <button
                type="button"
                onClick={() => setLiturgyFilter('communion')}
                className={`px-2.5 py-1 text-xs rounded cursor-pointer ${
                  liturgyFilter === 'communion'
                    ? 'bg-white text-[#1C1917] font-medium'
                    : 'text-[#57534E]'
                }`}
              >
                圣餐主日
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setEditingStep({
                id: '',
                liturgyType: liturgyFilter,
                time: '',
                step: '',
                scriptureOrHymn: '',
                leader: '',
                note: '',
                sortOrder: filteredSteps.length + 1,
              })
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增流程步骤
          </button>
        </div>

        <div className="divide-y divide-[#EFEAE0]">
          {filteredSteps.map((step) => (
            <div
              key={step.id}
              className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1917]">
                  <span className="font-mono text-xs text-[#1E3A5F] tabular-nums">
                    {step.time}
                  </span>
                  <span>{step.step}</span>
                  <span className="text-xs font-normal text-[#78716C]">· {step.leader}</span>
                </div>
                <p className="text-xs text-[#8B5E34]">{step.scriptureOrHymn}</p>
                <p className="text-xs text-[#57534E]">{step.note}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingStep(step)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteLiturgyStep(step.id);
                    setStatus({ type: 'success', message: `已删除步骤「${step.step}」。` });
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#9A3412] border border-[#E7B9B0] hover:bg-[#FDF2F0] rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Time Editor Modal */}
      {editingTime && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141210]/55"
        >
          <form
            onSubmit={handleSaveTime}
            className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
              <h3 className="font-editorial text-xl font-semibold text-[#1C1917]">
                {editingTime.id ? '编辑主日时段' : '新增主日时段'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTime(null)}
                className="p-1.5 text-[#57534E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FieldLabel label="时间段 *">
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={editingTime.time}
                  onChange={(e) => setEditingTime({ ...editingTime, time: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="排序权重">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={editingTime.sortOrder}
                  onChange={(e) =>
                    setEditingTime({ ...editingTime, sortOrder: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </FieldLabel>
            </div>
            <FieldLabel label="聚会名称 *">
              <input
                type="text"
                required
                maxLength={120}
                value={editingTime.title}
                onChange={(e) => setEditingTime({ ...editingTime, title: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="地点 *">
              <input
                type="text"
                required
                maxLength={120}
                value={editingTime.place}
                onChange={(e) => setEditingTime({ ...editingTime, place: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="简要说明 *">
              <textarea
                rows={2}
                required
                maxLength={300}
                value={editingTime.desc}
                onChange={(e) => setEditingTime({ ...editingTime, desc: e.target.value })}
                className={textareaClass}
              />
            </FieldLabel>
            <div className="pt-3 border-t border-[#E5DFD3] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingTime(null)}
                className="px-4 py-2 text-xs font-medium text-[#57534E] border border-[#D6CFC2] rounded-md cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-md cursor-pointer"
              >
                {saving ? '保存中…' : '确认保存'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step Editor Modal */}
      {editingStep && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141210]/55"
        >
          <form
            onSubmit={handleSaveStep}
            className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
              <h3 className="font-editorial text-xl font-semibold text-[#1C1917]">
                {editingStep.id ? '编辑崇拜流程步骤' : '新增崇拜流程步骤'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingStep(null)}
                className="p-1.5 text-[#57534E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FieldLabel label="流程类型">
                <select
                  value={editingStep.liturgyType}
                  onChange={(e) =>
                    setEditingStep({
                      ...editingStep,
                      liturgyType: e.target.value as 'standard' | 'communion',
                    })
                  }
                  className={inputClass}
                >
                  <option value="standard">常规主日</option>
                  <option value="communion">圣餐主日</option>
                </select>
              </FieldLabel>
              <FieldLabel label="时间点 *">
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={editingStep.time}
                  onChange={(e) => setEditingStep({ ...editingStep, time: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="排序权重">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={editingStep.sortOrder}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, sortOrder: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </FieldLabel>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FieldLabel label="礼仪环节名称 *">
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={editingStep.step}
                  onChange={(e) => setEditingStep({ ...editingStep, step: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="主领同工 *">
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={editingStep.leader}
                  onChange={(e) => setEditingStep({ ...editingStep, leader: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
            </div>
            <FieldLabel label="经文、讲题或诗歌 *">
              <input
                type="text"
                required
                maxLength={200}
                value={editingStep.scriptureOrHymn}
                onChange={(e) =>
                  setEditingStep({ ...editingStep, scriptureOrHymn: e.target.value })
                }
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="礼仪说明 *">
              <textarea
                rows={3}
                required
                maxLength={500}
                value={editingStep.note}
                onChange={(e) => setEditingStep({ ...editingStep, note: e.target.value })}
                className={textareaClass}
              />
            </FieldLabel>
            <div className="pt-3 border-t border-[#E5DFD3] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingStep(null)}
                className="px-4 py-2 text-xs font-medium text-[#57534E] border border-[#D6CFC2] rounded-md cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-md cursor-pointer"
              >
                {saving ? '保存中…' : '确认保存'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
