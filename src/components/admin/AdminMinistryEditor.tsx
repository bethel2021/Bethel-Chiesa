import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import {
  useChurchAdminActions,
  usePublicChurchData,
} from '../../context/ChurchDataContext';
import { FIELD_LIMITS } from '../../data/cacheConfig';
import {
  MINISTRY_CATEGORY_LABELS,
  MINISTRY_CATEGORY_OPTIONS,
  MINISTRY_CATEGORY_ORDER,
  type MinistryRosterCategory,
  type MinistryRosterItem,
  type WeekdayMinistry,
} from '../../data/churchData';
import { ModalDialog } from '../ModalDialog';
import {
  AdminPanelHeader,
  ConfirmDeleteButton,
  FieldLabel,
  getFriendlyAdminError,
  inputClass,
  StatusBanner,
  textareaClass,
} from './AdminSharedUI';

export function AdminMinistryEditor({ mode }: { mode: 'roster' | 'weekday' }) {
  const { churchInfo, ministryRoster, weekdayMinistries } = usePublicChurchData();
  const {
    saveChurchInfo,
    saveMinistryRoster,
    deleteMinistryRoster,
    saveWeekdayMinistry,
    deleteWeekdayMinistry,
  } = useChurchAdminActions();

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const [thisWeekLabel, setThisWeekLabel] = useState(churchInfo.thisWeekLabel);
  const [nextWeekLabel, setNextWeekLabel] = useState(churchInfo.nextWeekLabel);

  const [filterCat, setFilterCat] = useState<'all' | MinistryRosterCategory>('all');
  const [editingRoster, setEditingRoster] = useState<MinistryRosterItem | null>(null);
  const [editingWeekday, setEditingWeekday] = useState<WeekdayMinistry | null>(null);

  const sortedRoster = useMemo(
    () =>
      [...ministryRoster].sort((a, b) => {
        const catDiff =
          (MINISTRY_CATEGORY_ORDER[a.category] ?? 99) -
          (MINISTRY_CATEGORY_ORDER[b.category] ?? 99);
        return catDiff !== 0 ? catDiff : a.sortOrder - b.sortOrder;
      }),
    [ministryRoster]
  );

  const visibleRoster = useMemo(
    () =>
      filterCat === 'all'
        ? sortedRoster
        : sortedRoster.filter((item) => item.category === filterCat),
    [filterCat, sortedRoster]
  );

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
      setStatus({ type: 'error', message: getFriendlyAdminError(err, '保存失败，请重试。') });
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
      setStatus({ type: 'error', message: getFriendlyAdminError(err, '保存失败，请重试。') });
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
      setStatus({ type: 'error', message: getFriendlyAdminError(err, '保存失败，请重试。') });
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'weekday') {
    return (
      <div className="space-y-8">
        <AdminPanelHeader
          title="周间事工管理"
          description="编辑守望祷告、乐队排练、诗班学习、查经聚会、敬拜练习及迦南诗班等聚会安排。"
          action={
            <button
              type="button"
              onClick={() =>
                setEditingWeekday({
                  id: '',
                  day: '',
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
                <div className="flex flex-wrap items-baseline gap-3 text-sm font-semibold text-[#1C1917]">
                  <span className="font-mono text-xs text-[#78716C] tabular-nums">
                    #{wm.sortOrder}
                  </span>
                  <span>{wm.title}</span>
                  <span className="font-mono text-xs font-medium text-[#1E3A5F] tabular-nums">
                    {wm.day}
                    {wm.time}
                  </span>
                </div>
                {(wm.location || wm.leader) && (
                  <p className="text-xs text-[#57534E]">
                    {[wm.location ? `地点：${wm.location}` : '', wm.leader ? `负责：${wm.leader}` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                {wm.description && <p className="text-xs text-[#78716C]">{wm.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setEditingWeekday({
                      ...wm,
                      location: wm.location ?? '',
                      leader: wm.leader ?? '',
                      description: wm.description ?? '',
                    })
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </button>
                <ConfirmDeleteButton
                  onConfirm={async () => {
                    setStatus(null);
                    try {
                      await deleteWeekdayMinistry(wm.id);
                      setStatus({ type: 'success', message: `已删除「${wm.title}」。` });
                    } catch (err) {
                      setStatus({
                        type: 'error',
                        message: getFriendlyAdminError(err, '删除周间事工失败，请重试。'),
                      });
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {editingWeekday && (
          <ModalDialog
            labelledBy="weekday-modal-title"
            maxWidthClass="max-w-lg"
            overlayClassName="bg-[#141210]/55"
            containerClassName="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg shadow-xl"
            onClose={() => setEditingWeekday(null)}
          >
            <form onSubmit={handleSaveWeekday} className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
                <h3
                  id="weekday-modal-title"
                  className="font-editorial text-xl font-semibold text-[#1C1917]"
                >
                  {editingWeekday.id ? '编辑周间事工' : '新增周间事工'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingWeekday(null)}
                  aria-label="关闭弹窗"
                  className="p-1.5 text-[#57534E] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <FieldLabel label="聚会名称 *">
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.weekdayMinistry.title}
                  value={editingWeekday.title}
                  onChange={(e) =>
                    setEditingWeekday({ ...editingWeekday, title: e.target.value })
                  }
                  placeholder="例如：守望祷告"
                  className={inputClass}
                />
              </FieldLabel>
              <div className="grid grid-cols-3 gap-4">
                <FieldLabel label="日期 / 周期 *" hint="如：一三五、周五">
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.weekdayMinistry.day}
                    value={editingWeekday.day}
                    onChange={(e) => setEditingWeekday({ ...editingWeekday, day: e.target.value })}
                    placeholder="例如：一三五"
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="时间段 *" hint="如：上午9:00-10:30">
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.weekdayMinistry.time}
                    value={editingWeekday.time}
                    onChange={(e) =>
                      setEditingWeekday({ ...editingWeekday, time: e.target.value })
                    }
                    placeholder="例如：上午9:00-10:30"
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
              <div className="grid grid-cols-2 gap-4">
                <FieldLabel label="聚会地点（可选）">
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.weekdayMinistry.location}
                    value={editingWeekday.location ?? ''}
                    onChange={(e) =>
                      setEditingWeekday({ ...editingWeekday, location: e.target.value })
                    }
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="负责同工（可选）">
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.weekdayMinistry.leader}
                    value={editingWeekday.leader ?? ''}
                    onChange={(e) =>
                      setEditingWeekday({ ...editingWeekday, leader: e.target.value })
                    }
                    className={inputClass}
                  />
                </FieldLabel>
              </div>
              <FieldLabel label="事工简介（可选）">
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.weekdayMinistry.description}
                  value={editingWeekday.description ?? ''}
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
          </ModalDialog>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPanelHeader
        title="主日事工岗位安排（含主日学与团契）"
        description="管理讲台与敬拜、祷告献诗读经、音画影音技术、接待与后勤、主日学与团契及外派事工轮值表，并可每周更新轮值日期标题。"
        action={
          <button
            type="button"
            onClick={() =>
              setEditingRoster({
                id: '',
                category: filterCat === 'all' ? 'worship' : filterCat,
                role: '',
                thisWeek: '',
                nextWeek: '',
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
              maxLength={FIELD_LIMITS.churchInfo.thisWeekLabel}
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
              maxLength={FIELD_LIMITS.churchInfo.nextWeekLabel}
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
          [{ id: 'all', label: '全部岗位' }, ...MINISTRY_CATEGORY_OPTIONS] as {
            id: 'all' | MinistryRosterCategory;
            label: string;
          }[]
        ).map(({ id, label }) => (
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
        {visibleRoster.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-[#78716C]">
            当前分类暂无岗位记录，点击右上角“新增岗位 / 班级”添加。
          </div>
        ) : (
          visibleRoster.map((item) => (
            <div
              key={item.id}
              className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C]">
                  <span className="font-mono tabular-nums">#{item.sortOrder}</span>
                  <span>{MINISTRY_CATEGORY_LABELS[item.category] ?? '讲台与敬拜'}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#1C1917]">{item.role}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <p className="text-[#1E3A5F]">本周：{item.thisWeek}</p>
                  <p className="text-[#57534E]">下周：{item.nextWeek}</p>
                </div>
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
                <ConfirmDeleteButton
                  onConfirm={async () => {
                    setStatus(null);
                    try {
                      await deleteMinistryRoster(item.id);
                      setStatus({ type: 'success', message: `已删除「${item.role}」。` });
                    } catch (err) {
                      setStatus({
                        type: 'error',
                        message: getFriendlyAdminError(err, '删除事工岗位失败，请重试。'),
                      });
                    }
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {editingRoster && (
        <ModalDialog
          labelledBy="roster-modal-title"
          maxWidthClass="max-w-lg"
          overlayClassName="bg-[#141210]/55"
          containerClassName="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg shadow-xl"
          onClose={() => setEditingRoster(null)}
        >
          <form onSubmit={handleSaveRoster} className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
              <h3
                id="roster-modal-title"
                className="font-editorial text-xl font-semibold text-[#1C1917]"
              >
                {editingRoster.id ? '编辑事工岗位' : '新增事工岗位'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRoster(null)}
                aria-label="关闭弹窗"
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
                      category: e.target.value as MinistryRosterCategory,
                    })
                  }
                  className={inputClass}
                >
                  {MINISTRY_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
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
                maxLength={FIELD_LIMITS.ministryRoster.role}
                value={editingRoster.role}
                onChange={(e) => setEditingRoster({ ...editingRoster, role: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label={`本周服事人员（${thisWeekLabel}） *`}>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.ministryRoster.thisWeek}
                value={editingRoster.thisWeek}
                onChange={(e) => setEditingRoster({ ...editingRoster, thisWeek: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label={`下周服事人员（${nextWeekLabel}） *`}>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.ministryRoster.nextWeek}
                value={editingRoster.nextWeek}
                onChange={(e) => setEditingRoster({ ...editingRoster, nextWeek: e.target.value })}
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
        </ModalDialog>
      )}
    </div>
  );
}
