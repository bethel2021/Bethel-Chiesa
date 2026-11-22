import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useChurchData } from '../../context/ChurchDataContext';
import type { MinistryRosterItem, WeekdayMinistry } from '../../data/churchData';
import {
  AdminPanelHeader,
  FieldLabel,
  inputClass,
  StatusBanner,
  textareaClass,
} from './AdminSharedUI';

const CATEGORY_LABELS: Record<MinistryRosterItem['category'], string> = {
  worship: '敬拜与后勤',
  'sunday-school': '主日学',
  fellowship: '团契聚会',
};

export function AdminMinistryEditor({ mode }: { mode: 'roster' | 'weekday' }) {
  const {
    churchInfo,
    saveChurchInfo,
    ministryRoster,
    weekdayMinistries,
    saveMinistryRoster,
    deleteMinistryRoster,
    saveWeekdayMinistry,
    deleteWeekdayMinistry,
  } = useChurchData();

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const [thisWeekLabel, setThisWeekLabel] = useState(churchInfo.thisWeekLabel);
  const [nextWeekLabel, setNextWeekLabel] = useState(churchInfo.nextWeekLabel);

  const [filterCat, setFilterCat] = useState<'all' | MinistryRosterItem['category']>('all');
  const [editingRoster, setEditingRoster] = useState<MinistryRosterItem | null>(null);
  const [editingWeekday, setEditingWeekday] = useState<WeekdayMinistry | null>(null);

  useEffect(() => {
    setThisWeekLabel(churchInfo.thisWeekLabel);
    setNextWeekLabel(churchInfo.nextWeekLabel);
  }, [churchInfo]);

  const handleSaveLabels = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveChurchInfo({ ...churchInfo, thisWeekLabel, nextWeekLabel });
      setStatus({ type: 'success', message: '本周与下周轮值日期标签已更新。' });
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : '保存失败。' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoster = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingRoster) return;
    setSaving(true);
    try {
      await saveMinistryRoster(editingRoster);
      setEditingRoster(null);
      setStatus({ type: 'success', message: '主日事工岗位安排已保存。' });
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : '保存失败。' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeekday = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingWeekday) return;
    setSaving(true);
    try {
      await saveWeekdayMinistry(editingWeekday);
      setEditingWeekday(null);
      setStatus({ type: 'success', message: '周间事工安排已保存。' });
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : '保存失败。' });
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'weekday') {
    return (
      <div className="space-y-8">
        <AdminPanelHeader
          title="周间事工管理"
          description="编辑周二至周六各聚会小组、祷告会、诗班排练与社区探访安排。"
          action={
            <button
              type="button"
              onClick={() =>
                setEditingWeekday({
                  id: '',
                  day: '周二',
                  time: '',
                  title: '',
                  location: '',
                  leader: '',
                  description: '',
                  sortOrder: weekdayMinistries.length + 1,
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新增周间事工
            </button>
          }
        />

        <StatusBanner status={status} onClear={() => setStatus(null)} />

        <div className="bg-white border border-[#E5DFD3] rounded-lg divide-y divide-[#EFEAE0]">
          {weekdayMinistries.map((wm) => (
            <div
              key={wm.id}
              className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1917]">
                  <span className="text-[#1E3A5F]">{wm.day}</span>
                  <span className="font-mono text-xs text-[#57534E] tabular-nums">{wm.time}</span>
                  <span>{wm.title}</span>
                </div>
                <p className="text-xs text-[#57534E]">
                  地点：{wm.location} · 负责：{wm.leader}
                </p>
                <p className="text-xs text-[#78716C]">{wm.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingWeekday(wm)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteWeekdayMinistry(wm.id);
                    setStatus({ type: 'success', message: `已删除「${wm.title}」。` });
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

        {editingWeekday && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141210]/55"
          >
            <form
              onSubmit={handleSaveWeekday}
              className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
                <h3 className="font-editorial text-xl font-semibold text-[#1C1917]">
                  {editingWeekday.id ? '编辑周间事工' : '新增周间事工'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingWeekday(null)}
                  className="p-1.5 text-[#57534E] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FieldLabel label="星期 *">
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={editingWeekday.day}
                    onChange={(e) => setEditingWeekday({ ...editingWeekday, day: e.target.value })}
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="时间段 *">
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={editingWeekday.time}
                    onChange={(e) =>
                      setEditingWeekday({ ...editingWeekday, time: e.target.value })
                    }
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="排序权重">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={editingWeekday.sortOrder}
                    onChange={(e) =>
                      setEditingWeekday({
                        ...editingWeekday,
                        sortOrder: Number(e.target.value),
                      })
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
                  value={editingWeekday.title}
                  onChange={(e) =>
                    setEditingWeekday({ ...editingWeekday, title: e.target.value })
                  }
                  className={inputClass}
                />
              </FieldLabel>
              <div className="grid grid-cols-2 gap-4">
                <FieldLabel label="聚会地点 *">
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={editingWeekday.location}
                    onChange={(e) =>
                      setEditingWeekday({ ...editingWeekday, location: e.target.value })
                    }
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="负责同工 *">
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={editingWeekday.leader}
                    onChange={(e) =>
                      setEditingWeekday({ ...editingWeekday, leader: e.target.value })
                    }
                    className={inputClass}
                  />
                </FieldLabel>
              </div>
              <FieldLabel label="事工简介 *">
                <textarea
                  rows={3}
                  required
                  maxLength={400}
                  value={editingWeekday.description}
                  onChange={(e) =>
                    setEditingWeekday({ ...editingWeekday, description: e.target.value })
                  }
                  className={textareaClass}
                />
              </FieldLabel>
              <div className="pt-3 border-t border-[#E5DFD3] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingWeekday(null)}
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

  const visibleRoster =
    filterCat === 'all'
      ? ministryRoster
      : ministryRoster.filter((item) => item.category === filterCat);

  return (
    <div className="space-y-8">
      <AdminPanelHeader
        title="主日事工岗位安排（含主日学及团契）"
        description="管理主日敬拜服事、儿童主日学及团契轮值表，并可每周更新轮值日期标题。"
        action={
          <button
            type="button"
            onClick={() =>
              setEditingRoster({
                id: '',
                category: filterCat === 'all' ? 'worship' : filterCat,
                role: '',
                timeOrPlace: '',
                thisWeek: '',
                nextWeek: '',
                note: '',
                sortOrder: ministryRoster.length + 1,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增岗位 / 班级
          </button>
        }
      />

      <StatusBanner status={status} onClear={() => setStatus(null)} />

      {/* Week Label Quick Bar */}
      <form
        onSubmit={handleSaveLabels}
        className="bg-white border border-[#E5DFD3] rounded-lg p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
      >
        <div className="md:col-span-5">
          <FieldLabel label="本周轮值日期标题">
            <input
              type="text"
              required
              maxLength={60}
              value={thisWeekLabel}
              onChange={(e) => setThisWeekLabel(e.target.value)}
              className={inputClass}
            />
          </FieldLabel>
        </div>
        <div className="md:col-span-5">
          <FieldLabel label="下周轮值日期标题">
            <input
              type="text"
              required
              maxLength={60}
              value={nextWeekLabel}
              onChange={(e) => setNextWeekLabel(e.target.value)}
              className={inputClass}
            />
          </FieldLabel>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
          >
            更新日期标签
          </button>
        </div>
      </form>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', '全部岗位'],
            ['worship', '敬拜与后勤'],
            ['sunday-school', '儿童主日学'],
            ['fellowship', '主日及周末团契'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilterCat(id)}
            className={`px-3.5 py-2 text-xs font-medium rounded-md cursor-pointer ${
              filterCat === id
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-white text-[#57534E] border border-[#E5DFD3]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Roster Table */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg divide-y divide-[#EFEAE0]">
        {visibleRoster.map((item) => (
          <div
            key={item.id}
            className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-1 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C]">
                <span className="font-mono tabular-nums">#{item.sortOrder}</span>
                <span>{CATEGORY_LABELS[item.category]}</span>
                <span>·</span>
                <span className="tabular-nums">{item.timeOrPlace}</span>
              </div>
              <h3 className="text-sm font-semibold text-[#1C1917]">{item.role}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <p className="text-[#1E3A5F]">本周：{item.thisWeek}</p>
                <p className="text-[#57534E]">下周：{item.nextWeek}</p>
              </div>
              <p className="text-xs text-[#78716C]">备注：{item.note}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingRoster(item)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                编辑
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteMinistryRoster(item.id);
                  setStatus({ type: 'success', message: `已删除「${item.role}」。` });
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

      {editingRoster && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141210]/55"
        >
          <form
            onSubmit={handleSaveRoster}
            className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
              <h3 className="font-editorial text-xl font-semibold text-[#1C1917]">
                {editingRoster.id ? '编辑事工岗位' : '新增事工岗位'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRoster(null)}
                className="p-1.5 text-[#57534E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldLabel label="事工分类">
                <select
                  value={editingRoster.category}
                  onChange={(e) =>
                    setEditingRoster({
                      ...editingRoster,
                      category: e.target.value as MinistryRosterItem['category'],
                    })
                  }
                  className={inputClass}
                >
                  <option value="worship">敬拜与后勤服事</option>
                  <option value="sunday-school">儿童主日学</option>
                  <option value="fellowship">主日及周末团契</option>
                </select>
              </FieldLabel>
              <FieldLabel label="排序权重">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={editingRoster.sortOrder}
                  onChange={(e) =>
                    setEditingRoster({
                      ...editingRoster,
                      sortOrder: Number(e.target.value),
                    })
                  }
                  className={inputClass}
                />
              </FieldLabel>
            </div>

            <FieldLabel label="岗位 / 班级 / 团契名称 *">
              <input
                type="text"
                required
                maxLength={140}
                value={editingRoster.role}
                onChange={(e) => setEditingRoster({ ...editingRoster, role: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label="时间与地点 *">
              <input
                type="text"
                required
                maxLength={140}
                value={editingRoster.timeOrPlace}
                onChange={(e) =>
                  setEditingRoster({ ...editingRoster, timeOrPlace: e.target.value })
                }
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label={`本周值班同工（${thisWeekLabel}） *`}>
              <input
                type="text"
                required
                maxLength={200}
                value={editingRoster.thisWeek}
                onChange={(e) => setEditingRoster({ ...editingRoster, thisWeek: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label={`下周值班同工（${nextWeekLabel}） *`}>
              <input
                type="text"
                required
                maxLength={200}
                value={editingRoster.nextWeek}
                onChange={(e) => setEditingRoster({ ...editingRoster, nextWeek: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label="备忘说明 *">
              <input
                type="text"
                required
                maxLength={300}
                value={editingRoster.note}
                onChange={(e) => setEditingRoster({ ...editingRoster, note: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>

            <div className="pt-3 border-t border-[#E5DFD3] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingRoster(null)}
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
