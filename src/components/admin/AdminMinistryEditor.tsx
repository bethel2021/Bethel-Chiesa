import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Images,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  useChurchAdminActions,
  usePublicChurchData,
} from '../../context/ChurchDataContext';
import { FIELD_LIMITS } from '../../data/cacheConfig';
import { optimizeUploadedImage } from '../../utils/imageOptimizer';
import { SafeImage } from '../SafeImage';
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

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryProgressText, setGalleryProgressText] = useState('');
  const [galleryError, setGalleryError] = useState('');

  const closeRosterModal = () => {
    setEditingRoster(null);
    setGalleryError('');
    setGalleryProgressText('');
  };

  const handleGalleryFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || !editingRoster) return;

    setGalleryError('');
    const maxExtra = FIELD_LIMITS.ministryRoster.galleryMaxCount;
    const currentGallery = editingRoster.galleryImages ?? [];
    const availableSlots =
      (editingRoster.image ? 0 : 1) + Math.max(0, maxExtra - currentGallery.length);

    if (availableSlots <= 0) {
      setGalleryError(`每场活动相册最多支持 1 张封面照 + ${maxExtra} 张附图。`);
      return;
    }

    const filesToProcess = files.slice(0, availableSlots);
    const skippedForCap = files.length - filesToProcess.length;

    setGalleryBusy(true);
    let nextCover = editingRoster.image;
    const nextGallery = [...currentGallery];
    let failedCount = 0;

    try {
      for (let idx = 0; idx < filesToProcess.length; idx += 1) {
        setGalleryProgressText(`正在压缩优化第 ${idx + 1} / ${filesToProcess.length} 张照片…`);
        try {
          const result = await optimizeUploadedImage(filesToProcess[idx], 'poster');
          if (!nextCover) {
            nextCover = result.dataUrl;
          } else if (
            nextGallery.length < maxExtra &&
            result.dataUrl !== nextCover &&
            !nextGallery.includes(result.dataUrl)
          ) {
            nextGallery.push(result.dataUrl);
          }
        } catch {
          failedCount += 1;
        }
      }

      setEditingRoster((prev) =>
        prev
          ? {
              ...prev,
              image: nextCover,
              galleryImages: nextGallery,
            }
          : prev
      );

      const warnings: string[] = [];
      if (skippedForCap > 0) {
        warnings.push(`已达到单场上限（1 封面 + ${maxExtra} 附图），其余 ${skippedForCap} 张未加入。`);
      }
      if (failedCount > 0) {
        warnings.push(`有 ${failedCount} 张文件格式不受支持或压缩失败，已跳过。`);
      }
      if (warnings.length > 0) {
        setGalleryError(warnings.join(' '));
      }
    } finally {
      setGalleryBusy(false);
      setGalleryProgressText('');
    }
  };

  const promoteGalleryPhotoToCover = (index: number) => {
    if (!editingRoster) return;
    const gallery = [...(editingRoster.galleryImages ?? [])];
    const chosen = gallery[index];
    if (!chosen) return;
    const oldCover = editingRoster.image;
    gallery.splice(index, 1);
    if (oldCover && oldCover !== chosen && !gallery.includes(oldCover)) {
      gallery.unshift(oldCover);
    }
    setEditingRoster({
      ...editingRoster,
      image: chosen,
      galleryImages: gallery.slice(0, FIELD_LIMITS.ministryRoster.galleryMaxCount),
    });
  };

  const moveGalleryPhoto = (index: number, delta: -1 | 1) => {
    if (!editingRoster) return;
    const gallery = [...(editingRoster.galleryImages ?? [])];
    const target = index + delta;
    if (target < 0 || target >= gallery.length) return;
    [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
    setEditingRoster({
      ...editingRoster,
      galleryImages: gallery,
    });
  };

  const removeGalleryPhoto = (index: number) => {
    if (!editingRoster) return;
    const gallery = [...(editingRoster.galleryImages ?? [])];
    gallery.splice(index, 1);
    setEditingRoster({
      ...editingRoster,
      galleryImages: gallery,
    });
  };

  return (
    <div className="space-y-8">
      <AdminPanelHeader
        title="活动专题相册与精彩瞬间管理"
        description="按专题活动管理教会聚会、诗班、团契与主日学照片。每场活动支持 1 张主封面照与最多 12 张相册附图，首页将呈现杂志风错落封面与灯箱翻页浏览。"
        action={
          <button
            type="button"
            onClick={() => {
              setGalleryError('');
              setGalleryProgressText('');
              setEditingRoster({
                id: '',
                category: filterCat === 'all' ? 'choir' : filterCat,
                title: '',
                image: '',
                galleryImages: [],
                schedule: '每周主日',
                description: '',
                sortOrder: ministryRoster.length + 1,
              });
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增活动专题相册
          </button>
        }
      />

      <StatusBanner status={status} onClear={() => setStatus(null)} />

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [{ id: 'all', label: '全部专题相册' }, ...MINISTRY_CATEGORY_OPTIONS] as {
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
            当前分类暂无活动专题相册，点击右上角“新增活动专题相册”添加。
          </div>
        ) : (
          visibleMoments.map((item) => {
            const totalPhotos = (item.image ? 1 : 0) + (item.galleryImages?.length ?? 0);
            return (
              <div
                key={item.id}
                className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-24 h-16 rounded-md overflow-hidden bg-[#EFEAE0] shrink-0 border border-[#D6CFC2]">
                    <SafeImage
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C]">
                      <span className="font-mono tabular-nums">#{item.sortOrder}</span>
                      <span className="font-medium text-[#1E3A5F]">
                        {MINISTRY_CATEGORY_LABELS[item.category] ?? '精彩瞬间'}
                      </span>
                      {item.schedule && (
                        <span className="font-mono text-[11px] text-[#57534E]">
                          · {item.schedule}
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-[#78716C] tabular-nums">
                        · 共 {totalPhotos} 张照片
                      </span>
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
                    onClick={() => {
                      setGalleryError('');
                      setGalleryProgressText('');
                      setEditingRoster({
                        ...item,
                        galleryImages: item.galleryImages ?? [],
                      });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    编辑相册
                  </button>
                  <ConfirmDeleteButton
                    onConfirm={async () => {
                      setStatus(null);
                      try {
                        await deleteMinistryRoster(item.id);
                        setStatus({ type: 'success', message: `已删除相册「${item.title}」。` });
                      } catch (err) {
                        setStatus({
                          type: 'error',
                          message: getFriendlyAdminError(err, '删除相册失败，请重试。'),
                        });
                      }
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingRoster && (
        <ModalDialog
          disableDismiss
          labelledBy="moment-modal-title"
          maxWidthClass="max-w-2xl"
          overlayClassName="bg-[#141210]/55"
          containerClassName="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg shadow-xl max-h-[90vh] overflow-y-auto"
          onClose={closeRosterModal}
        >
          <form onSubmit={handleSaveRoster} className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
              <h3
                id="moment-modal-title"
                className="font-editorial text-xl font-semibold text-[#1C1917]"
              >
                {editingRoster.id ? '编辑活动专题相册' : '新增活动专题相册'}
              </h3>
              <button
                type="button"
                onClick={closeRosterModal}
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

            <FieldLabel label="活动专题标题 *">
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.ministryRoster.title}
                value={editingRoster.title}
                onChange={(e) => setEditingRoster({ ...editingRoster, title: e.target.value })}
                placeholder="例如：2026 春季洗礼与圣餐主日"
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label="活动时间 / 地点标签（可选）" hint="例如：2026年4月 · 主日圣殿">
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
              label="活动主封面照"
              value={editingRoster.image}
              onChange={(nextImg) =>
                setEditingRoster({
                  ...editingRoster,
                  image: nextImg,
                  galleryImages: (editingRoster.galleryImages ?? []).filter((g) => g !== nextImg),
                })
              }
              previewAspect="landscape"
              preset="poster"
              required
              hint="作为首页杂志封面主图；支持自动压缩为轻量 WebP"
            />

            {/* Multi-photo Gallery Uploader */}
            <div className="space-y-3 bg-[#FAF8F4] border border-[#E5DFD3] rounded-md p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-[#292524] inline-flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    活动相册附图（可一次多选上传，最多 {FIELD_LIMITS.ministryRoster.galleryMaxCount} 张）
                  </span>
                  <p className="text-[11px] text-[#78716C] mt-0.5">
                    已添加 {editingRoster.galleryImages?.length ?? 0} / {FIELD_LIMITS.ministryRoster.galleryMaxCount} 张附图；所有照片会在保存时自动存入 D1 媒体库。
                  </p>
                </div>
                <div>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleGalleryFilesSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={
                      galleryBusy ||
                      (editingRoster.galleryImages?.length ?? 0) >=
                        FIELD_LIMITS.ministryRoster.galleryMaxCount
                    }
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-white border border-[#D6CFC2] hover:bg-[#F3EFE6] disabled:opacity-50 rounded cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {galleryBusy ? '处理中…' : '批量选择多张照片'}
                  </button>
                </div>
              </div>

              {galleryProgressText && (
                <p className="text-[11px] text-[#1E3A5F] font-medium">{galleryProgressText}</p>
              )}

              {galleryError && (
                <p className="text-[11px] text-[#9A3412] bg-[#FEF2F2] border border-[#FECACA] rounded px-2.5 py-1.5">
                  {galleryError}
                </p>
              )}

              {(editingRoster.galleryImages?.length ?? 0) > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                  {(editingRoster.galleryImages ?? []).map((imgUrl, idx) => (
                    <div
                      key={`${idx}-${imgUrl.slice(0, 24)}`}
                      className="bg-white border border-[#DFD8C8] rounded overflow-hidden flex flex-col"
                    >
                      <div className="relative aspect-[4/3] bg-[#EFEAE0]">
                        <SafeImage
                          src={imgUrl}
                          alt={`相册附图 ${idx + 1}`}
                          fitMode="cover"
                          className="w-full h-full object-top"
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-mono bg-black/60 text-white rounded">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="px-1.5 py-1 flex items-center justify-between gap-1 border-t border-[#EFEAE0] bg-[#FAF8F4]">
                        <button
                          type="button"
                          onClick={() => promoteGalleryPhotoToCover(idx)}
                          title="设为封面"
                          className="inline-flex items-center gap-0.5 px-1.5 py-1 text-[10px] font-medium text-[#1E3A5F] hover:bg-[#EFEAE0] rounded cursor-pointer"
                        >
                          <Star className="w-3 h-3" />
                          封面
                        </button>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveGalleryPhoto(idx, -1)}
                            aria-label="前移照片"
                            className="p-1 text-[#57534E] hover:bg-[#EFEAE0] disabled:opacity-30 rounded cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === (editingRoster.galleryImages?.length ?? 0) - 1}
                            onClick={() => moveGalleryPhoto(idx, 1)}
                            aria-label="后移照片"
                            className="p-1 text-[#57534E] hover:bg-[#EFEAE0] disabled:opacity-30 rounded cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGalleryPhoto(idx)}
                            aria-label="删除附图"
                            className="p-1 text-[#9A3412] hover:bg-[#FEE2E2] rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FieldLabel label="活动说明 / 见证文字（可选）">
              <textarea
                rows={3}
                maxLength={FIELD_LIMITS.ministryRoster.description}
                value={editingRoster.description}
                onChange={(e) => setEditingRoster({ ...editingRoster, description: e.target.value })}
                placeholder="记录活动背后的美好见证、聚会人数或感恩事项…"
                className={textareaClass}
              />
            </FieldLabel>

            <div className="pt-3 border-t border-[#E5DFD3] flex justify-end gap-3">
              <button
                type="button"
                onClick={closeRosterModal}
                className="px-4 py-2 text-xs font-medium text-[#57534E] border border-[#D6CFC2] rounded-md cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving || galleryBusy}
                className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-md cursor-pointer disabled:opacity-60"
              >
                {saving ? '保存并同步媒体…' : galleryBusy ? '照片压缩中…' : '确认保存'}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  );
}
