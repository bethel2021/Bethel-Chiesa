import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Database,
  Download,
  FileText,
  FileUp,
  Image,
  LogOut,
  Menu,
  Palette,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import {
  useChurchAdminActions,
  useChurchAuth,
  usePublicChurchData,
} from '../../context/ChurchDataContext';
import { normalizeSiteTheme, SITE_THEMES } from '../../data/themes';
import { AdminAnnouncementsEditor } from './AdminAnnouncementsEditor';
import { AdminCoworkersEditor } from './AdminCoworkersEditor';
import { AdminInfoEditor } from './AdminInfoEditor';
import { AdminMinistryEditor } from './AdminMinistryEditor';
import { getFriendlyAdminError, StatusBanner } from './AdminSharedUI';
import { AdminThemeEditor } from './AdminThemeEditor';
import { AdminVisitorsPanel } from './AdminVisitorsPanel';
import { AdminVisitorStatsPanel } from './AdminVisitorStatsPanel';
import { AdminWorshipEditor } from './AdminWorshipEditor';

type AdminTab =
  | 'overview'
  | 'theme'
  | 'info'
  | 'coworkers'
  | 'worship'
  | 'roster'
  | 'weekday'
  | 'announcements'
  | 'visitors'
  | 'visitor-stats';

const SIDEBAR_ITEMS: {
  id: AdminTab;
  label: string;
  icon: typeof FileText;
  requiresVisitorStatsPermission?: boolean;
}[] = [
  { id: 'overview', label: '后台总览与同步', icon: Database },
  { id: 'info', label: '教会简介与联系', icon: FileText },
  { id: 'coworkers', label: '讲台同工管理', icon: Users },
  { id: 'worship', label: '主日时间与流程', icon: BookOpen },
  { id: 'weekday', label: '周间事工安排', icon: CalendarDays },
  { id: 'roster', label: '精彩瞬间展示', icon: Image },
  { id: 'announcements', label: '最新家事公告', icon: Bell },
  { id: 'visitors', label: '来访留言与权限', icon: ShieldCheck },
  {
    id: 'visitor-stats',
    label: '访客统计数据',
    icon: BarChart3,
    requiresVisitorStatsPermission: true,
  },
  { id: 'theme', label: '主题样式选择', icon: Palette },
];

export function AdminDashboard({ onBackToSite }: { onBackToSite: () => void }) {
  const {
    hasCloudData,
    hasPublicBundle,
    cloudLoading,
    quotaExceeded,
    lastSyncedAt,
    churchInfo,
    coworkers,
    worshipTimes,
    liturgySteps,
    ministryRoster,
    weekdayMinistries,
    announcements,
  } = usePublicChurchData();
  const {
    user,
    authReady,
    isAdmin,
    isMainAdmin,
    canViewVisitorStats,
    visitorRequests,
    visitorStats,
    activateAdminSession,
    signInWithGoogle,
    signOutUser,
  } = useChurchAuth();
  const {
    syncModifiedContentToCloud,
    publishPublicBundle,
    refreshAdminData,
    importFromLegacyFirestore,
    exportChurchBackupJson,
    importChurchBackupJson,
  } = useChurchAdminActions();

  useEffect(() => {
    activateAdminSession();
  }, [activateAdminSession]);

  const currentCloudTheme = normalizeSiteTheme(churchInfo.siteTheme);
  const currentThemeName =
    SITE_THEMES.find((item) => item.id === currentCloudTheme)?.name ?? '经典';
  const pendingVisitorCount = useMemo(
    () => visitorRequests.filter((req) => req.status === 'pending').length,
    [visitorRequests]
  );
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importingLegacy, setImportingLegacy] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [refreshingAdmin, setRefreshingAdmin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  const autoPublishedRef = useRef(false);

  useEffect(() => {
    if (
      !authReady ||
      !isAdmin ||
      cloudLoading ||
      quotaExceeded ||
      !hasCloudData ||
      hasPublicBundle
    ) {
      return;
    }
    if (autoPublishedRef.current) return;

    const timer = window.setTimeout(async () => {
      if (autoPublishedRef.current) return;
      autoPublishedRef.current = true;
      try {
        await publishPublicBundle();
      } catch {
        // Admin can manually click "同步修改内容到 D1" if needed
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    authReady,
    isAdmin,
    cloudLoading,
    quotaExceeded,
    hasCloudData,
    hasPublicBundle,
    publishPublicBundle,
  ]);

  const handleSyncToCloud = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      await syncModifiedContentToCloud();
      setSyncStatus({
        type: 'success',
        message:
          '已将当前内容写入 Cloudflare D1 数据库并更新访客端公开快照，前端加载仅需单次极速请求。',
      });
    } catch (err) {
      setSyncStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '同步到 Cloudflare D1 失败，请稍后重试。'),
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleImportFromFirestore = async () => {
    if (!isMainAdmin || importingLegacy) return;
    setImportingLegacy(true);
    setSyncStatus(null);
    setImportProgress('正在连接旧版 Firestore（若额度已满将自动尝试本机缓存）…');
    try {
      const summary = await importFromLegacyFirestore((step) => setImportProgress(step));
      const warnSuffix =
        summary.warnings.length > 0 ? `（提示：${summary.warnings.join('；')}）` : '';
      setSyncStatus({
        type: 'success',
        message: `已完成数据导入：迁移 ${summary.migratedImages} 张图片、${summary.importedAdmins} 位管理员、${summary.importedRequests} 条来访留言与 ${summary.importedIps} 条去重访客记录到 Cloudflare D1。${warnSuffix}`,
      });
    } catch (err) {
      setSyncStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '从旧版 Firestore 导入失败，请检查网络或权限后重试。'),
      });
    } finally {
      setImportingLegacy(false);
      setImportProgress('');
    }
  };

  const handleExportBackupJson = async () => {
    if (exportingBackup) return;
    setExportingBackup(true);
    setSyncStatus(null);
    try {
      const jsonText = await exportChurchBackupJson();
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `bethel-church-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSyncStatus({
        type: 'success',
        message: '已导出完整 JSON 备份文件（含当前页面图文与缓存图片），可在新环境直接一键导入到 Cloudflare D1。',
      });
    } catch (err) {
      setSyncStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '导出备份文件失败，请稍后重试。'),
      });
    } finally {
      setExportingBackup(false);
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isMainAdmin || importingLegacy) return;
    setImportingLegacy(true);
    setSyncStatus(null);
    setImportProgress('正在解析备份文件…');
    try {
      const text = await file.text();
      const summary = await importChurchBackupJson(text, (step) => setImportProgress(step));
      setSyncStatus({
        type: 'success',
        message: `已完成备份文件导入：写入 ${summary.migratedImages} 张图片、${summary.importedAdmins} 位管理员、${summary.importedRequests} 条来访留言与 ${summary.importedIps} 条访客记录到 Cloudflare D1。`,
      });
    } catch (err) {
      setSyncStatus({
        type: 'error',
        message: getFriendlyAdminError(err, '导入 JSON 备份文件失败，请确认文件格式正确。'),
      });
    } finally {
      setImportingLegacy(false);
      setImportProgress('');
    }
  };

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : '尚未生成';

  const visibleSidebarItems = SIDEBAR_ITEMS.filter(
    (item) => !item.requiresVisitorStatsPermission || canViewVisitorStats
  );
  const activeLabel = SIDEBAR_ITEMS.find((t) => t.id === activeTab)?.label ?? '后台总览';

  // Loading state while auth initializes
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center p-6">
        <div className="text-sm text-[#57534E]">正在验证管理员登录状态…</div>
      </div>
    );
  }

  // Gate 1: Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E5DFD3] rounded-lg p-8 space-y-6">
          <div className="pb-4 border-b border-[#EFEAE0]">
            <p className="text-xs tracking-widest text-[#78716C] mb-1">
              伯特利教会 · 内容管理系统
            </p>
            <h1 className="font-editorial text-2xl font-semibold text-[#1C1917]">
              同工后台管理登录
            </h1>
          </div>

          <p className="text-sm text-[#57534E] leading-relaxed">
            请使用已授权的教会管理员 Google 账号登录，即可实时编辑教会简介、服事同工、主日时间与流程、事工轮值表及最新公告。
          </p>

          {authError && (
            <p role="alert" className="text-xs text-[#9A3412] bg-[#FDF2F0] p-3 rounded border border-[#E7B9B0]">
              {authError}
            </p>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              disabled={signingIn}
              onClick={async () => {
                if (signingIn) return;
                setAuthError('');
                setSigningIn(true);
                try {
                  await signInWithGoogle();
                } catch (err) {
                  const code =
                    typeof err === 'object' && err !== null && 'code' in err
                      ? String((err as { code?: string }).code)
                      : '';
                  if (code === 'auth/unauthorized-domain') {
                    setAuthError(
                      `当前域名（${window.location.hostname}）尚未加入 Firebase 授权域名白名单。请在 Firebase Console → Authentication → Settings → Authorized domains 中添加该域名后重试。`
                    );
                  } else if (code === 'auth/popup-blocked') {
                    setAuthError('登录弹窗被浏览器拦截，请允许当前站点弹出窗口后重试。');
                  } else if (code === 'auth/popup-closed-by-user') {
                    setAuthError('已取消或关闭 Google 登录弹窗，请重新点击登录。');
                  } else if (code === 'auth/web-storage-unsupported') {
                    setAuthError('当前浏览器的第三方 Cookie 或本地存储被禁用，请在浏览器设置中允许后重试，或在新标签页打开页面登录。');
                  } else if (
                    code === 'auth/cancelled-popup-request' ||
                    code === 'auth/popup-interrupted'
                  ) {
                    setAuthError('登录弹窗请求被中断，请重新点击登录按钮。');
                  } else if (code === 'auth/network-request-failed') {
                    setAuthError('网络连接异常，无法连接 Google 登录服务，请检查网络后重试。');
                  } else if (code === 'auth/user-disabled') {
                    setAuthError('该 Google 账号已被停用，请联系管理员处理。');
                  } else if (code === 'auth/operation-not-allowed') {
                    setAuthError('Google 登录方式尚未在后台启用，请联系管理员检查身份验证配置。');
                  } else if (code === 'auth/too-many-requests') {
                    setAuthError('登录尝试过于频繁，请稍候几分钟后再试。');
                  } else if (code === 'auth/account-exists-with-different-credential') {
                    setAuthError('该邮箱已关联其他登录方式，请使用原授权方式登录。');
                  } else {
                    setAuthError('Google 登录未能完成，请重试或检查浏览器弹窗设置。');
                  }
                } finally {
                  setSigningIn(false);
                }
              }}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
            >
              {signingIn ? '正在打开 Google 登录窗口…' : '使用 Google 账号登录后台'}
            </button>

            <button
              type="button"
              onClick={onBackToSite}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-medium text-[#57534E] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded-md transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回教会公开主页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 2: Signed in but not authorized admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex flex-col justify-center items-center p-6">
        <div className="max-w-lg w-full bg-white border border-[#E5DFD3] rounded-lg p-8 space-y-5">
          <div className="pb-4 border-b border-[#EFEAE0]">
            <p className="text-xs tracking-widest text-[#9A3412] mb-1">权限校验</p>
            <h1 className="font-editorial text-2xl font-semibold text-[#1C1917]">
              当前账号暂无后台编辑权限
            </h1>
          </div>

          <div className="bg-[#FAF8F4] border border-[#E5DFD3] rounded p-4 space-y-1.5 text-xs">
            <p className="text-[#57534E]">
              当前登录邮箱：<span className="font-medium text-[#1C1917]">{user.email}</span>
            </p>
            <p className="text-[#57534E]">
              用户 UID：<span className="font-mono text-[#1C1917] select-all">{user.uid}</span>
            </p>
          </div>

          <p className="text-xs text-[#57534E] leading-relaxed">
            请联系教会主管理员在后台「来访留言与权限」中将上述 UID 添加至授权同工名录，或切换已授权的管理员账号登录。
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={signOutUser}
              className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
            >
              切换账号
            </button>
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#57534E] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded-md cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回公开主页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin Workspace
  return (
    <div className="min-h-screen bg-[#FAF8F4] flex flex-col lg:flex-row">
      {/* Left Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#F3EFE6]/70 border-r border-[#E5DFD3] shrink-0">
        <div className="h-16 px-6 flex items-center justify-between border-b border-[#E5DFD3]">
          <span className="font-editorial text-lg font-semibold text-[#1C1917]">
            伯特利教会后台
          </span>
        </div>

        <nav aria-label="后台模块导航" className="flex-1 p-4 space-y-1">
          {visibleSidebarItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const showPendingBadge = item.id === 'visitors' && pendingVisitorCount > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-[#57534E] hover:bg-[#E7E0D3]/60 hover:text-[#1C1917]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {showPendingBadge && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full tabular-nums shrink-0 ${
                      active ? 'bg-white text-[#1E3A5F]' : 'bg-[#9A3412] text-white'
                    }`}
                  >
                    {pendingVisitorCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E5DFD3] space-y-2 text-xs">
          <p className="text-[#78716C] truncate">{user.email}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToSite}
              className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 text-xs font-medium text-[#1E3A5F] bg-white border border-[#D6CFC2] hover:bg-[#FAF8F4] rounded cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              回主页
            </button>
            <button
              type="button"
              onClick={signOutUser}
              aria-label="退出登录"
              className="p-2 text-[#57534E] bg-white border border-[#D6CFC2] hover:text-[#9A3412] rounded cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Breadcrumb Bar */}
        <header className="h-16 bg-[#FAF8F4] border-b border-[#E5DFD3] px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((p) => !p)}
              aria-label="切换后台菜单"
              className="lg:hidden p-2 -ml-2 text-[#1C1917] hover:bg-[#EFEAE0] rounded-md"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
              <span className="text-[#78716C]">后台管理</span>
              <span className="text-[#A8A29E]">/</span>
              <span className="font-medium text-[#1C1917] truncate">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#1E3A5F] border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded-md whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回主页
            </button>
          </div>
        </header>

        {/* Mobile Sidebar Drawer */}
        {sidebarOpen && (
          <div className="lg:hidden bg-[#F3EFE6] border-b border-[#E5DFD3] px-6 py-4 space-y-1">
            {visibleSidebarItems.map((item) => {
              const Icon = item.icon;
              const showPendingBadge = item.id === 'visitors' && pendingVisitorCount > 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-md ${
                    activeTab === item.id
                      ? 'bg-[#1E3A5F] text-white'
                      : 'text-[#57534E] hover:bg-[#E7E0D3]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </span>
                  {showPendingBadge && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full tabular-nums ${
                        activeTab === item.id ? 'bg-white text-[#1E3A5F]' : 'bg-[#9A3412] text-white'
                      }`}
                    >
                      {pendingVisitorCount}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="pt-3 border-t border-[#DFD8C8] flex items-center justify-between text-xs">
              <span className="text-[#57534E] truncate">{user.email}</span>
              <button
                type="button"
                onClick={signOutUser}
                className="text-[#9A3412] font-medium cursor-pointer"
              >
                退出登录
              </button>
            </div>
          </div>
        )}

        {/* Workspace Canvas */}
        <main className="flex-1 p-6 md:p-8 max-w-[1040px] w-full mx-auto">
          {quotaExceeded && (
            <div className="mb-6 bg-[#FEF3C7]/70 border border-[#F59E0B]/40 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-[#78350F]">
                    云端连接暂不可用（当前展示本地缓存数据）
                  </p>
                  <p className="text-[#92400E] leading-relaxed">
                    未能从 Cloudflare D1 读取最新后台工作区数据。请确认 D1 数据库绑定（变量名 DB）状态正常后点击右侧按钮重试。
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={refreshingAdmin}
                onClick={async () => {
                  setRefreshingAdmin(true);
                  try {
                    await refreshAdminData();
                  } finally {
                    setRefreshingAdmin(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#78350F] bg-white border border-[#F59E0B]/50 hover:bg-[#FFFBEB] disabled:opacity-60 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingAdmin ? 'animate-spin' : ''}`} />
                {refreshingAdmin ? '重试中…' : '重试连接 D1'}
              </button>
            </div>
          )}

          <input
            ref={backupFileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportBackupFile}
            className="hidden"
          />

          {!hasCloudData && !quotaExceeded && (
            <div className="mb-6 bg-[#F3EFE6] border border-[#DFD8C8] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[#1C1917]">
                  尚未检测到 Cloudflare D1 云端数据
                </h2>
                <p className="text-xs text-[#57534E] mt-1">
                  {isMainAdmin
                    ? '你可以从旧版 Firestore 或本地 JSON 备份一键导入历史内容、照片与访客数据到 D1；若旧版 Firestore 今日额度已满，可直接先点击「同步默认模板到 D1」立即启用网站。'
                    : '点击右侧按钮可将当前主页内容写入 Cloudflare D1 数据库，以便跨设备持久化编辑与发布。'}
                </p>
                {importProgress && (
                  <p className="text-xs text-[#1E3A5F] font-medium mt-2">{importProgress}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isMainAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => backupFileInputRef.current?.click()}
                      disabled={importingLegacy || syncing}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#1E3A5F] bg-white border border-[#D6CFC2] hover:bg-[#FAF8F4] disabled:opacity-60 rounded-md whitespace-nowrap cursor-pointer"
                    >
                      <FileUp className="w-3.5 h-3.5" />
                      导入 JSON 备份
                    </button>
                    <button
                      type="button"
                      onClick={handleImportFromFirestore}
                      disabled={importingLegacy || syncing}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-[#1E3A5F] bg-white border border-[#1E3A5F] hover:bg-[#FAF8F4] disabled:opacity-60 rounded-md whitespace-nowrap cursor-pointer"
                    >
                      <UploadCloud className={`w-3.5 h-3.5 ${importingLegacy ? 'animate-pulse' : ''}`} />
                      {importingLegacy ? '正在迁移…' : '从旧版 Firestore 导入'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleSyncToCloud}
                  disabled={syncing || importingLegacy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded-md whitespace-nowrap cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? '正在同步…' : '同步默认模板到 D1'}
                </button>
              </div>
            </div>
          )}

          <StatusBanner status={syncStatus} onClear={() => setSyncStatus(null)} />

          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="pb-5 border-b border-[#E5DFD3]">
                <h2 className="font-editorial text-2xl font-semibold text-[#1C1917]">
                  伯特利教会内容管理总览
                </h2>
                <p className="text-xs text-[#57534E] mt-1">
                  全部页面内容与优化图片均存储于 Cloudflare D1 数据库，保存修改时将自动更新公开快照。
                </p>
              </div>

              <div className="bg-white border border-[#E5DFD3] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[#1C1917] tabular-nums">
                    Cloudflare D1 公开快照：
                    <span className={hasPublicBundle ? 'text-[#14532D]' : 'text-[#9A3412]'}>
                      {hasPublicBundle ? '已同步' : '待生成'}
                    </span>
                    <span className="text-[#A8A29E] mx-2">·</span>
                    <span className="text-[#57534E]">最近同步：{formattedSyncTime}</span>
                  </p>
                  <p className="text-xs text-[#57534E]">
                    已启用 D1 单接口快照 + 30 分钟本地缓存与图片边缘强缓存分发，无需额外对象存储。
                  </p>
                  {importProgress && (
                    <p className="text-xs text-[#1E3A5F] font-medium pt-1">{importProgress}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportBackupJson}
                    disabled={exportingBackup || importingLegacy || syncing}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#57534E] bg-white border border-[#D6CFC2] hover:bg-[#F3EFE6] disabled:opacity-60 rounded-md whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportingBackup ? '导出中…' : '导出备份'}
                  </button>
                  {isMainAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => backupFileInputRef.current?.click()}
                        disabled={importingLegacy || syncing}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1E3A5F] bg-white border border-[#D6CFC2] hover:bg-[#F3EFE6] disabled:opacity-60 rounded-md whitespace-nowrap cursor-pointer"
                      >
                        <FileUp className="w-3.5 h-3.5" />
                        导入备份
                      </button>
                      <button
                        type="button"
                        onClick={handleImportFromFirestore}
                        disabled={importingLegacy || syncing}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#1E3A5F] bg-white border border-[#D6CFC2] hover:bg-[#F3EFE6] disabled:opacity-60 rounded-md whitespace-nowrap cursor-pointer"
                      >
                        <UploadCloud className={`w-3.5 h-3.5 ${importingLegacy ? 'animate-pulse' : ''}`} />
                        {importingLegacy ? '迁移中…' : '从旧版 Firestore 导入'}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleSyncToCloud}
                    disabled={syncing || importingLegacy}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded-md whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? '正在同步…' : '同步修改内容到 D1'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    tab: 'info' as AdminTab,
                    label: '教会简介与联系',
                    count: hasCloudData ? '云端已就绪' : '使用默认模板',
                    sub: '主视觉 · 异象 · 堂址电话',
                  },
                  {
                    tab: 'coworkers' as AdminTab,
                    label: '讲台同工管理',
                    count: `${coworkers.length} 位讲台同工`,
                    sub: '牧师 · 长老 · 传道及事工同工',
                  },
                  {
                    tab: 'worship' as AdminTab,
                    label: '主日时间与流程',
                    count: `${worshipTimes.length} 个时段 · ${liturgySteps.length} 步骤`,
                    sub: '常规主日与圣餐主日礼仪',
                  },
                  {
                    tab: 'weekday' as AdminTab,
                    label: '周间事工安排',
                    count: `${weekdayMinistries.length} 项聚会`,
                    sub: '祷告 · 排练 · 诗班 · 查经',
                  },
                  {
                    tab: 'roster' as AdminTab,
                    label: '精彩瞬间展示',
                    count: `${ministryRoster.length} 张活动照片`,
                    sub: '诗班 · 幸福小组 · 青年团契 · 主日学',
                  },
                  {
                    tab: 'announcements' as AdminTab,
                    label: '最新家事公告',
                    count: `${announcements.length} 条公告`,
                    sub: '置顶重点与分类发布',
                  },
                  {
                    tab: 'visitors' as AdminTab,
                    label: '来访与代祷留言',
                    count:
                      pendingVisitorCount > 0
                        ? `${pendingVisitorCount} 条待跟进 · 共 ${visitorRequests.length} 条`
                        : `${visitorRequests.length} 条记录`,
                    sub: '邮件即时提醒 · 权限分配',
                  },
                  ...(canViewVisitorStats
                    ? [
                        {
                          tab: 'visitor-stats' as AdminTab,
                          label: '访客统计数据',
                          count: `${visitorStats ? visitorStats.totalVisitors : 0} 位独立访客`,
                          sub: '同 IP 去重 · SHA-256 脱敏记录',
                        },
                      ]
                    : []),
                  {
                    tab: 'theme' as AdminTab,
                    label: '主题样式选择',
                    count: `当前：${currentThemeName}`,
                    sub: '经典 · 圣诞节 · 复活节 · 感恩节',
                  },
                ].map((card) => (
                  <button
                    key={card.tab}
                    type="button"
                    onClick={() => setActiveTab(card.tab)}
                    className="text-left bg-white border border-[#E5DFD3] hover:border-[#1E3A5F] rounded-lg p-5 transition-colors cursor-pointer"
                  >
                    <p className="text-xs text-[#78716C] mb-1">{card.label}</p>
                    <p className="font-editorial text-xl font-semibold text-[#1C1917] tabular-nums mb-1.5">
                      {card.count}
                    </p>
                    <p className="text-xs text-[#57534E]">{card.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'theme' && <AdminThemeEditor />}
          {activeTab === 'info' && <AdminInfoEditor />}
          {activeTab === 'coworkers' && <AdminCoworkersEditor />}
          {activeTab === 'worship' && <AdminWorshipEditor />}
          {activeTab === 'roster' && <AdminMinistryEditor mode="roster" />}
          {activeTab === 'weekday' && <AdminMinistryEditor mode="weekday" />}
          {activeTab === 'announcements' && <AdminAnnouncementsEditor />}
          {activeTab === 'visitors' && <AdminVisitorsPanel />}
          {activeTab === 'visitor-stats' && <AdminVisitorStatsPanel />}
        </main>
      </div>
    </div>
  );
}
