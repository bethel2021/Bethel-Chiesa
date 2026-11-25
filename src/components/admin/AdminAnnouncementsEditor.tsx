import { useState, type FormEvent } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import {
  useChurchAdminActions,
  usePublicChurchData,
} from '../../context/ChurchDataContext';
import { FIELD_LIMITS } from '../../data/cacheConfig';
import type { AnnouncementItem } from '../../data/churchData';
import { normalizeAnnouncementCategory } from '../../utils/churchNormalization';
import { ModalDialog } from '../ModalDialog';
import { SafeImage } from '../SafeImage';
import {
  AdminPanelHeader,
  ConfirmDeleteButton,
  FieldLabel,
  getFriendlyAdminError,
  inputClass,
  StatusBanner,
  textareaClass,
} from './AdminSharedUI';
import { ImageFieldControl } from './ImageFieldControl';

export function AdminAnnouncementsEditor() {
  const { announcements } = usePublicChurchData();
  const { saveAnnouncement, deleteAnnouncement } = useChurchAdminActions();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [detailsText, setDetailsText] = useState('');

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const details = detailsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, FIELD_LIMITS.announcement.detailsMaxCount);
      await saveAnnouncement({
        ...editing,
        date: '',
        details: details.length > 0 ? details : [editing.summary],
      });
      setEditing(null);
      setStatus({ type: 'success', message: '家事公告已保存并同步发布。' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '保存失败，请稍后重试。'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <AdminPanelHeader
        title="最新家事公告管理"
        description="发布特别聚会或家事注意公告，支持设定置顶「重点公告」。"
        action={
          <button
            type="button"
            onClick={() => {
              setEditing({
                id: '',
                category: '特别聚会',
                title: '',
                summary: '',
                time: '',
                location: '',
                contact: '',
                image: '',
                isFeatured: false,
                details: [],
                sortOrder: 1,
              });
              setDetailsText('');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            发布新公告
          </button>
        }
      />

      <StatusBanner status={status} onClear={() => setStatus(null)} />

      <div className="bg-white border border-[#E5DFD3] rounded-lg divide-y divide-[#EFEAE0]">
        {announcements.map((item) => (
          <div
            key={item.id}
            className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {item.image && (
                <div className="hidden sm:block w-24 h-16 rounded border border-[#E5DFD3] overflow-hidden bg-[#FAF8F4] shrink-0 mt-0.5">
                  <SafeImage
                    src={item.image}
                    alt={item.title}
                    fallbackLabel={item.title}
                    fitMode="auto-contain-portrait"
                    className="w-full h-full"
                  />
                </div>
              )}
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C]">
                  <span className="font-mono tabular-nums">#{item.sortOrder}</span>
                  {item.isFeatured && <span className="font-medium text-[#8B5E34]">重点置顶</span>}
                  <span>{item.category}</span>
                </div>
                <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">{item.title}</h3>
                <p className="text-xs text-[#57534E]">{item.summary}</p>
                {(() => {
                  const meta = [
                    item.time ? `时间：${item.time}` : '',
                    item.location ? `地点：${item.location}` : '',
                    item.contact ? `联系：${item.contact}` : '',
                  ].filter(Boolean);
                  return meta.length > 0 ? (
                    <p className="text-xs text-[#78716C]">{meta.join(' · ')}</p>
                  ) : null;
                })()}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditing({
                    ...item,
                    category: normalizeAnnouncementCategory(item.category),
                  });
                  setDetailsText(item.details.join('\n'));
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                编辑
              </button>
              <ConfirmDeleteButton
                onConfirm={async () => {
                  setStatus(null);
                  try {
                    await deleteAnnouncement(item.id);
                    setStatus({ type: 'success', message: `已删除公告「${item.title}」。` });
                  } catch (err) {
                    setStatus({
                      type: 'error',
                      message: getFriendlyAdminError(err, '删除公告失败，请重试。'),
                    });
                  }
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ModalDialog
          disableDismiss
          labelledBy="announcement-editor-modal-title"
          maxWidthClass="max-w-xl"
          overlayClassName="bg-[#141210]/55"
          containerClassName="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg max-h-[90vh] overflow-y-auto shadow-xl"
          onClose={() => setEditing(null)}
        >
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
              <h3
                id="announcement-editor-modal-title"
                className="font-editorial text-xl font-semibold text-[#1C1917]"
              >
                {editing.id ? '编辑家事公告' : '发布新公告'}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="关闭弹窗"
                className="p-1.5 text-[#57534E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldLabel label="公告分类">
                <select
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      category: e.target.value as AnnouncementItem['category'],
                    })
                  }
                  className={inputClass}
                >
                  <option value="特别聚会">特别聚会</option>
                  <option value="家事注意">家事注意</option>
                </select>
              </FieldLabel>
              <FieldLabel label="排序权重">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={editing.sortOrder}
                  onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                  className={inputClass}
                />
              </FieldLabel>
            </div>

            <FieldLabel label="公告标题 *">
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.announcement.title}
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label="列表摘要 *">
              <textarea
                rows={2}
                required
                maxLength={FIELD_LIMITS.announcement.summary}
                value={editing.summary}
                onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                className={textareaClass}
              />
            </FieldLabel>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FieldLabel label="聚会时间（可选）">
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.announcement.time}
                  value={editing.time ?? ''}
                  onChange={(e) => setEditing({ ...editing, time: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="聚会地点（可选）">
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.announcement.location}
                  value={editing.location ?? ''}
                  onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="负责联系人（可选）">
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.announcement.contact}
                  value={editing.contact ?? ''}
                  onChange={(e) => setEditing({ ...editing, contact: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
            </div>

            <ImageFieldControl
              label="活动配图（可选）"
              value={editing.image ?? ''}
              onChange={(nextValue) => setEditing({ ...editing, image: nextValue })}
              allowClear
              previewAspect="landscape"
              fitMode="auto-contain-portrait"
              hint="点击公告详情弹窗顶部展示，纵向海报自动居中留白适配"
            />

            <FieldLabel label="公告正文详情（每段一行）" hint="点击查看详情弹窗内展示">
              <textarea
                rows={5}
                value={detailsText}
                onChange={(e) => setDetailsText(e.target.value)}
                className={textareaClass}
              />
            </FieldLabel>

            <label className="flex items-center gap-2 text-xs text-[#292524] cursor-pointer">
              <input
                type="checkbox"
                checked={editing.isFeatured}
                onChange={(e) => setEditing({ ...editing, isFeatured: e.target.checked })}
                className="rounded border-[#D6CFC2]"
              />
              <span>设为首页「重点置顶公告」</span>
            </label>

            <div className="pt-3 border-t border-[#E5DFD3] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-xs font-medium text-[#57534E] border border-[#D6CFC2] rounded-md cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-md cursor-pointer"
              >
                {saving ? '保存中…' : '确认发布'}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  );
}
