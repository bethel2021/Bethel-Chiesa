import { useState, type FormEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import {
  useChurchAdminActions,
  usePublicChurchData,
} from '../../context/ChurchDataContext';
import { FIELD_LIMITS } from '../../data/cacheConfig';
import { type PulpitCoworker } from '../../data/churchData';
import { ModalDialog } from '../ModalDialog';
import { SafeImage } from '../SafeImage';
import {
  AdminPanelHeader,
  ConfirmDeleteButton,
  FieldLabel,
  getFriendlyAdminError,
  inputClass,
  StatusBanner,
} from './AdminSharedUI';
import { ImageFieldControl } from './ImageFieldControl';

const EMPTY_COWORKER: PulpitCoworker = {
  id: '',
  name: '',
  title: '',
  image: '',
  sortOrder: 10,
};

export function AdminCoworkersEditor() {
  const { coworkers } = usePublicChurchData();
  const { saveCoworker, deleteCoworker } = useChurchAdminActions();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [editingCoworker, setEditingCoworker] = useState<PulpitCoworker | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCoworker) return;
    setSaving(true);
    setStatus(null);
    try {
      await saveCoworker(editingCoworker);
      setEditingCoworker(null);
      setStatus({ type: 'success', message: '讲台同工信息已保存并更新至主页。' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '保存同工信息失败，请稍后重试。'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setStatus(null);
    try {
      await deleteCoworker(id);
      setStatus({ type: 'success', message: `已移除「${name}」。` });
    } catch (err) {
      setStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '删除失败，请稍后重试。'),
      });
    }
  };

  return (
    <div className="space-y-10">
      <AdminPanelHeader
        title="讲台同工管理"
        description="统一管理所有讲台同工名录（包含牧师、长老、传道及事工同工）。"
        action={
          <button
            type="button"
            onClick={() =>
              setEditingCoworker({ ...EMPTY_COWORKER, sortOrder: coworkers.length + 1 })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增讲台同工
          </button>
        }
      />

      <StatusBanner status={status} onClear={() => setStatus(null)} />

      {/* Coworkers List */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg overflow-hidden">
        <div className="p-4 bg-[#F9F8F6] border-b border-[#E5DFD3] flex items-center justify-between text-xs font-medium text-[#57534E]">
          <span>讲台同工列表（{coworkers.length} 位）</span>
          <span>按排序从小到大展示</span>
        </div>

        <div className="divide-y divide-[#E5DFD3]">
          {coworkers.map((worker) => (
            <div
              key={worker.id}
              className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF9F5] transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                {worker.image ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-[#E5DFD3] bg-[#F3F0EA] shrink-0">
                    <SafeImage
                      src={worker.image}
                      alt={worker.name}
                      fallbackLabel={worker.name.slice(0, 1)}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                ) : (
                  <div
                    aria-hidden="true"
                    className="w-12 h-12 rounded-full border border-[#D1C7B7] bg-[#F3F0EA] flex items-center justify-center font-editorial text-sm font-semibold text-[#1E3A5F] shrink-0"
                  >
                    {worker.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-editorial text-base font-semibold text-[#1C1917] truncate">
                      {worker.name}
                    </h4>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#F3F0EA] text-[#78716C]">
                      排序: {worker.sortOrder}
                    </span>
                  </div>
                  <p className="text-xs text-[#78716C] truncate">
                    {worker.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:self-center">
                <button
                  type="button"
                  onClick={() => setEditingCoworker({ ...worker })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-[#F3F0EA] hover:bg-[#E5DFD3] rounded transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </button>
                <ConfirmDeleteButton
                  onConfirm={() => handleDelete(worker.id, worker.name)}
                />
              </div>
            </div>
          ))}

          {coworkers.length === 0 && (
            <div className="p-12 text-center text-sm text-[#78716C]">
              暂无讲台同工档案，请点击右上角“新增讲台同工”添加。
            </div>
          )}
        </div>
      </div>

      {/* Edit / Add Modal */}
      {editingCoworker && (
        <ModalDialog
          onClose={() => setEditingCoworker(null)}
          maxWidthClass="max-w-xl"
        >
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#EFEAE0]">
              <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
                {editingCoworker.id ? '编辑讲台同工' : '新增讲台同工'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingCoworker(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#78716C] hover:bg-[#F3F0EA] transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <FieldLabel label="同工姓名（如：林恩典 牧师 / 周以撒 传道）">
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.coworker.name}
                  value={editingCoworker.name}
                  onChange={(e) =>
                    setEditingCoworker({ ...editingCoworker, name: e.target.value })
                  }
                  className={inputClass}
                  placeholder="例如：林恩典 牧师"
                />
              </FieldLabel>

              <FieldLabel label="职衔与事工职责（如：主任牧师 · 讲台总负责）">
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.coworker.title}
                  value={editingCoworker.title}
                  onChange={(e) =>
                    setEditingCoworker({ ...editingCoworker, title: e.target.value })
                  }
                  className={inputClass}
                  placeholder="例如：主任牧师 · 讲台总负责"
                />
              </FieldLabel>

              <ImageFieldControl
                label="同工照片（可选，支持头像或半身照）"
                value={editingCoworker.image || ''}
                onChange={(nextUrl) =>
                  setEditingCoworker({ ...editingCoworker, image: nextUrl })
                }
                defaultValue=""
                previewAspect="square"
                hint="支持 JPG / PNG / WebP 原图无损直传（10 MB 内），或留空使用首字母默认头像"
              />

              <FieldLabel label="排序号（数字越小越靠前）">
                <input
                  type="number"
                  required
                  value={editingCoworker.sortOrder}
                  onChange={(e) =>
                    setEditingCoworker({
                      ...editingCoworker,
                      sortOrder: parseInt(e.target.value, 10) || 10,
                    })
                  }
                  className={inputClass}
                />
              </FieldLabel>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => setEditingCoworker(null)}
                  className="px-4 py-2 text-xs font-medium text-[#57534E] hover:bg-[#F3F0EA] rounded-md transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded-md transition-colors cursor-pointer"
                >
                  {saving ? '保存中…' : '保存同工档案'}
                </button>
              </div>
            </form>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
