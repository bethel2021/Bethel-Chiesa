import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import {
  useChurchAdminActions,
  useChurchAuth,
} from '../../context/ChurchDataContext';
import { FIELD_LIMITS } from '../../data/cacheConfig';
import type { VisitorRequestItem } from '../../data/churchData';
import {
  AdminPanelHeader,
  ConfirmDeleteButton,
  FieldLabel,
  getFriendlyAdminError,
  inputClass,
  StatusBanner,
} from './AdminSharedUI';

const STATUS_LABELS: Record<VisitorRequestItem['status'], string> = {
  pending: '待同工跟进',
  contacted: '已联系关怀',
  archived: '已归档',
};

export function AdminVisitorsPanel() {
  const { isMainAdmin, visitorRequests, adminUsers } = useChurchAuth();
  const {
    updateVisitorRequestStatus,
    deleteVisitorRequest,
    addAdminUser,
    removeAdminUser,
  } = useChurchAdminActions();

  const [filter, setFilter] = useState<'all' | VisitorRequestItem['status']>('all');
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const [newUid, setNewUid] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');

  const statusCounts = useMemo(() => {
    const counts = { all: visitorRequests.length, pending: 0, contacted: 0, archived: 0 };
    for (const r of visitorRequests) {
      if (r.status === 'pending') counts.pending += 1;
      else if (r.status === 'contacted') counts.contacted += 1;
      else if (r.status === 'archived') counts.archived += 1;
    }
    return counts;
  }, [visitorRequests]);

  const filteredRequests = useMemo(
    () =>
      filter === 'all'
        ? visitorRequests
        : visitorRequests.filter((r) => r.status === filter),
    [filter, visitorRequests]
  );

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await addAdminUser(newUid, newEmail, newDisplayName);
      setNewUid('');
      setNewEmail('');
      setNewDisplayName('');
      setStatusMsg({ type: 'success', message: '已添加新的同工管理员权限。' });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        message: getFriendlyAdminError(err, '添加管理员失败，请检查权限或邮箱格式。'),
      });
    }
  };

  return (
    <div className="space-y-10">
      <AdminPanelHeader
        title="来访登记与代祷留言"
        description="查看新朋友提交的来访预约与代祷事项（仅限授权同工查阅，保障个人隐私）。"
      />

      <StatusBanner status={statusMsg} onClear={() => setStatusMsg(null)} />

      {/* Status Filter */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', `全部 (${statusCounts.all})`],
            ['pending', `待跟进 (${statusCounts.pending})`],
            ['contacted', `已联系 (${statusCounts.contacted})`],
            ['archived', `已归档 (${statusCounts.archived})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-3.5 py-2 text-xs font-medium rounded-md tabular-nums cursor-pointer ${
              filter === id
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-white text-[#57534E] border border-[#E5DFD3]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Visitor Requests List */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg divide-y divide-[#EFEAE0]">
        {filteredRequests.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[#78716C]">
            当前筛选条件下暂无来访或代祷记录。当访客在首页提交联系表单后，记录将实时显示在此处。
          </div>
        ) : (
          filteredRequests.map((req) => {
            const noteVal = noteDrafts[req.id] ?? req.adminNote ?? '';
            return (
              <div key={req.id} className="p-6 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-[#1C1917]">{req.name}</span>
                    <span className="text-[#78716C]">·</span>
                    <span className="text-[#1E3A5F] font-medium">{req.contact}</span>
                    {req.intent && (
                      <>
                        <span className="text-[#78716C]">·</span>
                        <span className="text-xs text-[#57534E]">{req.intent}</span>
                      </>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      req.status === 'pending'
                        ? 'text-[#9A3412]'
                        : req.status === 'contacted'
                        ? 'text-[#14532D]'
                        : 'text-[#78716C]'
                    }`}
                  >
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>

                {req.message && (
                  <p className="text-sm text-[#292524] bg-[#FAF8F4] p-3 rounded border border-[#EFEAE0] leading-relaxed">
                    {req.message}
                  </p>
                )}

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-1">
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.visitorRequest.adminNote}
                    value={noteVal}
                    onChange={(e) =>
                      setNoteDrafts({ ...noteDrafts, [req.id]: e.target.value })
                    }
                    placeholder="填写教牧跟进备注（如：陈牧师已电话联系，周日安排迎新接待）"
                    className={`${inputClass} flex-1`}
                  />

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={req.status}
                      onChange={async (e) => {
                        const nextStatus = e.target.value as VisitorRequestItem['status'];
                        setStatusMsg(null);
                        try {
                          await updateVisitorRequestStatus(req.id, nextStatus, noteVal);
                          setStatusMsg({
                            type: 'success',
                            message: `已更新「${req.name}」跟进状态为${STATUS_LABELS[nextStatus]}。`,
                          });
                        } catch (err) {
                          setStatusMsg({
                            type: 'error',
                            message: getFriendlyAdminError(err, '更新状态失败，请重试。'),
                          });
                        }
                      }}
                      className="px-3 py-2 text-xs bg-white border border-[#D6CFC2] rounded-md text-[#1C1917]"
                    >
                      <option value="pending">待同工跟进</option>
                      <option value="contacted">已联系关怀</option>
                      <option value="archived">已归档</option>
                    </select>

                    <button
                      type="button"
                      onClick={async () => {
                        setStatusMsg(null);
                        try {
                          await updateVisitorRequestStatus(req.id, req.status, noteVal);
                          setStatusMsg({ type: 'success', message: '跟进备注已保存。' });
                        } catch (err) {
                          setStatusMsg({
                            type: 'error',
                            message: getFriendlyAdminError(err, '保存备注失败，请重试。'),
                          });
                        }
                      }}
                      className="px-3 py-2 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded-md cursor-pointer"
                    >
                      保存备注
                    </button>

                    <ConfirmDeleteButton
                      label=""
                      confirmLabel="确认删除"
                      ariaLabel="删除记录"
                      className="p-2 text-[#9A3412] border border-[#E7B9B0] hover:bg-[#FDF2F0] rounded-md cursor-pointer"
                      onConfirm={async () => {
                        setStatusMsg(null);
                        try {
                          await deleteVisitorRequest(req.id);
                          setStatusMsg({ type: 'success', message: '已删除该条来访记录。' });
                        } catch (err) {
                          setStatusMsg({
                            type: 'error',
                            message: getFriendlyAdminError(err, '删除记录失败，请重试。'),
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Admin RBAC Management */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg p-6 space-y-5">
        <div className="pb-3 border-b border-[#EFEAE0]">
          <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
            授权同工管理员名录
          </h3>
          <p className="text-xs text-[#57534E] mt-1">
            {isMainAdmin
              ? '教会主管理员默认拥有全部权限。若其他同工需共同管理后台，请将其登录后显示的 UID 添加至此名录。'
              : '同工管理员可编辑教会主页内容与跟进来访代祷留言；管理员权限的授予与撤销仅由教会主管理员统一管理。'}
          </p>
        </div>

        {isMainAdmin && (
          <>
            <form onSubmit={handleAddAdmin} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <FieldLabel label="同工用户 UID *">
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.adminUser.uid}
                    value={newUid}
                    onChange={(e) => setNewUid(e.target.value)}
                    placeholder="例如：Abc123xyz..."
                    className={inputClass}
                  />
                </FieldLabel>
              </div>
              <div className="md:col-span-4">
                <FieldLabel label="同工邮箱 *">
                  <input
                    type="email"
                    required
                    maxLength={FIELD_LIMITS.adminUser.email}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="fellow@bethelchurch.org"
                    className={inputClass}
                  />
                </FieldLabel>
              </div>
              <div className="md:col-span-2">
                <FieldLabel label="同工称呼 *">
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.adminUser.displayName}
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="陈牧师"
                    className={inputClass}
                  />
                </FieldLabel>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  授权
                </button>
              </div>
            </form>

            {adminUsers.length > 0 && (
              <div className="divide-y divide-[#EFEAE0] border-t border-[#EFEAE0]">
                {adminUsers.map((adm) => (
                  <div
                    key={adm.uid}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#1C1917]">{adm.displayName}</span>
                      <span className="text-[#78716C] mx-2">·</span>
                      <span className="text-[#57534E]">{adm.email}</span>
                      <span className="text-[#78716C] mx-2">·</span>
                      <span className="font-mono text-[#78716C]">UID: {adm.uid}</span>
                    </div>
                    <ConfirmDeleteButton
                      label="撤销权限"
                      confirmLabel="确认撤销"
                      showIcon={false}
                      className="text-[#9A3412] hover:underline cursor-pointer self-start sm:self-auto"
                      onConfirm={async () => {
                        setStatusMsg(null);
                        try {
                          await removeAdminUser(adm.uid);
                          setStatusMsg({
                            type: 'success',
                            message: `已撤销「${adm.displayName}」的后台管理权限。`,
                          });
                        } catch (err) {
                          setStatusMsg({
                            type: 'error',
                            message: getFriendlyAdminError(err, '撤销管理员权限失败，请重试。'),
                          });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
