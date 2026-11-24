import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useChurchData } from '../../context/ChurchDataContext';
import {
  CHURCH_IMAGES,
  type PastorProfile,
  type PulpitCoworker,
} from '../../data/churchData';
import { SafeImage } from '../SafeImage';
import {
  AdminPanelHeader,
  FieldLabel,
  getFriendlyAdminError,
  inputClass,
  StatusBanner,
  textareaClass,
} from './AdminSharedUI';
import { ImageFieldControl } from './ImageFieldControl';

const EMPTY_PASTOR: PastorProfile = {
  id: '',
  name: '',
  role: '',
  tenure: '',
  image: CHURCH_IMAGES.pastorLin,
  education: '',
  ministryFocus: '',
  bio: '',
  sortOrder: 10,
};

const EMPTY_COWORKER: PulpitCoworker = {
  id: '',
  name: '',
  title: '',
  image: '',
  sortOrder: 10,
};

export function AdminPastorsEditor() {
  const { pastors, coworkers, savePastor, deletePastor, saveCoworker, deleteCoworker } =
    useChurchData();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [editingPastor, setEditingPastor] = useState<PastorProfile | null>(null);
  const [editingCoworker, setEditingCoworker] = useState<PulpitCoworker | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSavePastor = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPastor) return;
    setSaving(true);
    setStatus(null);
    try {
      await savePastor(editingPastor);
      setEditingPastor(null);
      setStatus({ type: 'success', message: '牧者档案已保存并更新至主页。' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '保存牧者档案失败，请稍后重试。'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePastor = async (id: string, name: string) => {
    setStatus(null);
    try {
      await deletePastor(id);
      setStatus({ type: 'success', message: `已移除「${name}」。` });
    } catch (err) {
      setStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '删除失败，请稍后重试。'),
      });
    }
  };

  const handleSaveCoworker = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCoworker) return;
    setSaving(true);
    setStatus(null);
    try {
      await saveCoworker(editingCoworker);
      setEditingCoworker(null);
      setStatus({ type: 'success', message: '讲台轮值同工信息已保存。' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '保存同工信息失败，请稍后重试。'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCoworker = async (id: string, name: string) => {
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
        title="牧者及讲台同工管理"
        description="统一管理牧师与长老图文介绍，以及讲台轮值同工名录。"
        action={
          <button
            type="button"
            onClick={() =>
              setEditingPastor({ ...EMPTY_PASTOR, sortOrder: pastors.length + 1 })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增牧者/长老档案
          </button>
        }
      />

      <StatusBanner status={status} onClear={() => setStatus(null)} />

      {/* Pastors List */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-[#F3EFE6]/70 border-b border-[#E5DFD3] flex items-center justify-between">
          <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
            牧师与长老图文档案（{pastors.length}）
          </h3>
        </div>
        <div className="divide-y divide-[#EFEAE0]">
          {pastors.map((p) => (
            <div
              key={p.id}
              className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-14 rounded overflow-hidden border border-[#E5DFD3] bg-[#EFEAE0] shrink-0">
                  <SafeImage
                    src={p.image}
                    alt={`${p.name}肖像`}
                    fallbackLabel={p.name.slice(0, 1)}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1C1917]">
                    <span className="font-mono text-xs text-[#78716C] tabular-nums">
                      #{p.sortOrder}
                    </span>
                    <span>{p.name}</span>
                    <span className="text-xs font-normal text-[#78716C]">· {p.role}</span>
                  </div>
                  <p className="text-xs text-[#57534E] truncate">
                    {p.tenure} · {p.ministryFocus}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPastor(p)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePastor(p.id, p.name)}
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

      {/* Coworkers List */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-[#F3EFE6]/70 border-b border-[#E5DFD3] flex items-center justify-between gap-4">
          <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
            讲台轮值同工（{coworkers.length}）
          </h3>
          <button
            type="button"
            onClick={() =>
              setEditingCoworker({ ...EMPTY_COWORKER, sortOrder: coworkers.length + 1 })
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增轮值同工
          </button>
        </div>

        <div className="divide-y divide-[#EFEAE0]">
          {coworkers.map((cw) => (
            <div
              key={cw.id}
              className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {cw.image ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E5DFD3] bg-[#EFEAE0] shrink-0">
                    <SafeImage
                      src={cw.image}
                      alt={`${cw.name}头像`}
                      fallbackLabel={cw.name.slice(0, 1)}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                ) : (
                  <div
                    aria-hidden="true"
                    className="w-10 h-10 rounded-full border border-[#DFD8C8] bg-[#F3EFE6] flex items-center justify-center font-editorial text-sm font-semibold text-[#1E3A5F] shrink-0"
                  >
                    {cw.name.slice(0, 1)}
                  </div>
                )}
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1C1917]">
                    <span className="font-mono text-xs text-[#78716C] tabular-nums">
                      #{cw.sortOrder}
                    </span>
                    <span>{cw.name}</span>
                    <span className="text-xs font-normal text-[#78716C]">· {cw.title}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingCoworker(cw)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCoworker(cw.id, cw.name)}
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

      {/* Pastor Editor Modal */}
      {editingPastor && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141210]/55"
        >
          <form
            onSubmit={handleSavePastor}
            className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
              <h3 className="font-editorial text-xl font-semibold text-[#1C1917]">
                {editingPastor.id ? '编辑牧者档案' : '新增牧者档案'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPastor(null)}
                className="p-1.5 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldLabel label="姓名与称谓 *">
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={editingPastor.name}
                  onChange={(e) =>
                    setEditingPastor({ ...editingPastor, name: e.target.value })
                  }
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="职分与角色 *">
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={editingPastor.role}
                  onChange={(e) =>
                    setEditingPastor({ ...editingPastor, role: e.target.value })
                  }
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="事奉年限 *">
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={editingPastor.tenure}
                  onChange={(e) =>
                    setEditingPastor({ ...editingPastor, tenure: e.target.value })
                  }
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="排序权重">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={editingPastor.sortOrder}
                  onChange={(e) =>
                    setEditingPastor({
                      ...editingPastor,
                      sortOrder: Number(e.target.value),
                    })
                  }
                  className={inputClass}
                />
              </FieldLabel>
            </div>

            <ImageFieldControl
              label="牧者肖像图片"
              value={editingPastor.image}
              onChange={(nextUrl) =>
                setEditingPastor({ ...editingPastor, image: nextUrl })
              }
              defaultValue={
                editingPastor.id === 'pastor-chen'
                  ? CHURCH_IMAGES.pastorChen
                  : editingPastor.id === 'minister-zhao'
                  ? CHURCH_IMAGES.ministerZhao
                  : CHURCH_IMAGES.pastorLin
              }
              previewAspect="portrait"
              hint="建议 3:4 竖版人像（支持原图无损直传）"
              required
            />

            <FieldLabel label="神学装备 *">
              <input
                type="text"
                required
                maxLength={200}
                value={editingPastor.education}
                onChange={(e) =>
                  setEditingPastor({ ...editingPastor, education: e.target.value })
                }
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label="主要负担 *">
              <input
                type="text"
                required
                maxLength={200}
                value={editingPastor.ministryFocus}
                onChange={(e) =>
                  setEditingPastor({ ...editingPastor, ministryFocus: e.target.value })
                }
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label="服事简介 *">
              <textarea
                rows={4}
                required
                maxLength={1200}
                value={editingPastor.bio}
                onChange={(e) =>
                  setEditingPastor({ ...editingPastor, bio: e.target.value })
                }
                className={textareaClass}
              />
            </FieldLabel>

            <div className="pt-3 border-t border-[#E5DFD3] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingPastor(null)}
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

      {/* Coworker Editor Modal */}
      {editingCoworker && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141210]/55"
        >
          <form
            onSubmit={handleSaveCoworker}
            className="bg-[#FAF8F4] border border-[#E5DFD3] rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
              <h3 className="font-editorial text-xl font-semibold text-[#1C1917]">
                {editingCoworker.id ? '编辑讲台轮值同工' : '新增讲台轮值同工'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingCoworker(null)}
                className="p-1.5 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldLabel label="姓名 *">
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={editingCoworker.name}
                  onChange={(e) =>
                    setEditingCoworker({ ...editingCoworker, name: e.target.value })
                  }
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="排序权重">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={editingCoworker.sortOrder}
                  onChange={(e) =>
                    setEditingCoworker({
                      ...editingCoworker,
                      sortOrder: Number(e.target.value),
                    })
                  }
                  className={inputClass}
                />
              </FieldLabel>
            </div>

            <FieldLabel label="同工头衔与事工领域 *">
              <input
                type="text"
                required
                maxLength={120}
                value={editingCoworker.title}
                onChange={(e) =>
                  setEditingCoworker({ ...editingCoworker, title: e.target.value })
                }
                className={inputClass}
              />
            </FieldLabel>

            <ImageFieldControl
              label="讲台同工头像图片（可选）"
              value={editingCoworker.image || ''}
              onChange={(nextUrl) =>
                setEditingCoworker({ ...editingCoworker, image: nextUrl })
              }
              allowClear
              previewAspect="square"
              hint="建议正方形半身照（支持原图无损直传）；留空则显示姓氏首字徽章"
            />

            <div className="pt-3 border-t border-[#E5DFD3] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingCoworker(null)}
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
