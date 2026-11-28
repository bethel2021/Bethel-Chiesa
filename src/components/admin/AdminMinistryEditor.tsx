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
import { ImageFieldControl } from './ImageFieldControl';
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
  const { ministryRoster, weekdayMinistries } = usePublicChurchData();
  const {
    saveMinistryRoster,
    deleteMinistryRoster,
    saveWeekdayMinistry,
    deleteWeekdayMinistry,
  } = useChurchAdminActions();

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const [filterCat, setFilterCat] = useState<'all' | MinistryRosterCategory>('all');
  const [editingRoster, setEditingRoster] = useState<MinistryRosterItem | null>(null);
  const [editingWeekday, setEditingWeekday] = useState<WeekdayMinistry | null>(null);

  const sortedMoments = useMemo(
    () =>
      [...ministryRoster].sort((a, b) => {
        const catDiff =
          (MINISTRY_CATEGORY_ORDER[a.category] ?? 99) -
          (MINISTRY_CATEGORY_ORDER[b.category] ?? 99);
        return catDiff !== 0 ? catDiff : a.sortOrder - b.sortOrder;
      }),
    [ministryRoster]
  );

  const visibleMoments = useMemo(
    () =>
      filterCat === 'all'
        ? sortedMoments
        : sortedMoments.filter((item) => item.category === filterCat),
    [filterCat, sortedMoments]
  );

  const handleSaveRoster = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingRoster) return;
    setSaving(true);
    try {
      await saveMinistryRoster(editingRoster);
      setEditingRoster(null);
      setStatus({ type: 'success', message: '精彩瞬间照片与说明已保存。' });
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
          description="编辑守望祷告、乐队排练、诗班学习、查经聚会及团契活动等聚会安排。"
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
            disableDismiss
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
        title="精彩瞬间展示与照片管理"
        description="管理教会小组、诗班、团契及主日学等活动精彩瞬间照片、标题、时间与文字说明。"
        action={
          <button
            type="button"
            onClick={() =>
              setEditingRoster({
                id: '',
                category: filterCat === 'all' ? 'choir' : filterCat,
                title: '',
                image: '',
                schedule: '每周主日',
                description: '',
                sortOrder: ministryRoster.length + 1,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增精彩瞬间照片
          </button>
        }
      />

      <StatusBanner status={status} onClear={() => setStatus(null)} />

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [{ id: 'all', label: '全部精彩瞬间' }, ...MINISTRY_CATEGORY_OPTIONS] as {
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

      {/* Moments List Table */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg divide-y divide-[#EFEAE0]">
        {visibleMoments.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-[#78716C]">
            当前分类暂无精彩瞬间照片，点击右上角“新增精彩瞬间照片”添加。
          </div>
        ) : (
          visibleMoments.map((item) => (
            <div
              key={item.id}
              className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-20 h-14 rounded-md overflow-hidden bg-[#EFEAE0] shrink-0 border border-[#D6CFC2]">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C]">
                    <span className="font-mono tabular-nums">#{item.sortOrder}</span>
                    <span className="px-2 py-0.5 bg-[#F3EFE6] text-[#1E3A5F] rounded font-medium">
                      {MINISTRY_CATEGORY_LABELS[item.category] ?? '精彩瞬间'}
                    </span>
                    {item.schedule && (
                      <span className="font-mono text-[11px] text-[#57534E]">{item.schedule}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-[#1C1917]">{item.title}</h3>
                  {item.description && (
                    <p className="text-xs text-[#57534E] line-clamp-2">{item.description}</p>
                  )}
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
                      setStatus({ type: 'success', message: `已删除「${item.title}」。` });
                    } catch (err) {
                      setStatus({
                        type: 'error',
                        message: getFriendlyAdminError(err, '删除照片失败，请重试。'),
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
          disableDismiss
          labelledBy="moment-modal-title"
          maxWidthClass="max-w-lg"
          overlayClassName="bg-[#141210]/55"
          containerClassName="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg shadow-xl"
          onClose={() => setEditingRoster(null)}
        >
          <form onSubmit={handleSaveRoster} className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
              <h3
                id="moment-modal-title"
                className="font-editorial text-xl font-semibold text-[#1C1917]"
              >
                {editingRoster.id ? '编辑精彩瞬间照片' : '新增精彩瞬间照片'}
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
              <FieldLabel label="活动分类">
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

            <FieldLabel label="照片标题 *">
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.ministryRoster.title}
                value={editingRoster.title}
                onChange={(e) => setEditingRoster({ ...editingRoster, title: e.target.value })}
                placeholder="例如：诗班献诗与声部排练"
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label="时间 / 地点标签（可选）" hint="例如：每周主日 13:15 圣殿">
              <input
                type="text"
                maxLength={FIELD_LIMITS.ministryRoster.schedule}
                value={editingRoster.schedule}
                onChange={(e) => setEditingRoster({ ...editingRoster, schedule: e.target.value })}
                placeholder="例如：每周主日 13:15 圣殿"
                className={inputClass}
              />
            </FieldLabel>

            <ImageFieldControl
              label="活动照片"
              value={editingRoster.image}
              onChange={(nextImg) => setEditingRoster({ ...editingRoster, image: nextImg })}
              previewAspect="landscape"
              preset="poster"
              required
              hint="自动缩放至 1200px 并压缩为轻量 WebP，或输入外链网址"
            />

            <FieldLabel label="活动说明 / 见证文字（可选）">
              <textarea
                rows={3}
                maxLength={FIELD_LIMITS.ministryRoster.description}
                value={editingRoster.description}
                onChange={(e) => setEditingRoster({ ...editingRoster, description: e.target.value })}
                placeholder="记录活动背后的美好见证或说明…"
                className={textareaClass}
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
