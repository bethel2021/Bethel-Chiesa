import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Database,
  FileText,
  LogOut,
  Menu,
  Music,
  Palette,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useChurchData } from '../../context/ChurchDataContext';
import { normalizeSiteTheme, SITE_THEMES } from '../../data/themes';
import { AdminAnnouncementsEditor } from './AdminAnnouncementsEditor';
import { AdminInfoEditor } from './AdminInfoEditor';
import { AdminMinistryEditor } from './AdminMinistryEditor';
import { AdminPastorsEditor } from './AdminPastorsEditor';
import { StatusBanner } from './AdminSharedUI';
import { AdminThemeEditor } from './AdminThemeEditor';
import { AdminVisitorsPanel } from './AdminVisitorsPanel';
import { AdminWorshipEditor } from './AdminWorshipEditor';

type AdminTab =
  | 'overview'
  | 'theme'
  | 'info'
  | 'pastors'
  | 'worship'
  | 'songs'
  | 'roster'
  | 'weekday'
  | 'announcements'
  | 'visitors';

const SIDEBAR_ITEMS: {
  id: AdminTab;
  label: string;
  icon: typeof FileText;
}[] = [
  { id: 'overview', label: '后台总览与同步', icon: Database },
  { id: 'theme', label: '主题样式', icon: Palette },
  { id: 'info', label: '教会简介与联系', icon: FileText },
  { id: 'pastors', label: '牧者及讲台同工', icon: Users },
  { id: 'worship', label: '主日时间与流程', icon: BookOpen },
  { id: 'songs', label: '主日崇拜歌曲', icon: Music },
  { id: 'roster', label: '主日事工与主日学', icon: ClipboardList },
  { id: 'weekday', label: '周间事工安排', icon: CalendarDays },
  { id: 'announcements', label: '最新聚会公告', icon: Bell },
  { id: 'visitors', label: '来访留言与权限', icon: ShieldCheck },
];

export function AdminDashboard({ onBackToSite }: { onBackToSite: () => void }) {
  const {
    user,
    authReady,
    isAdmin,
    hasCloudData,
    hasPublicBundle,
    cloudLoading,
    lastSyncedAt,
    signInWithGoogle,
    signOutUser,
    syncModifiedContentToCloud,
    publishPublicBundle,
    churchInfo,
    pastors,
    coworkers,
    worshipTimes,
    liturgySteps,
    worshipSongs,
    ministryRoster,
    weekdayMinistries,
    announcements,
    visitorRequests,
  } = useChurchData();

  const currentCloudTheme = normalizeSiteTheme(churchInfo.siteTheme);
  const currentThemeName =
    SITE_THEMES.find((item) => item.id === currentCloudTheme)?.name ?? '经典';
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [authError, setAuthError] = useState('');
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const autoPublishedRef = useRef(false);

  // If an existing cloud database was created before single-doc snapshot support,
  // wait briefly for all admin collection listeners to settle and auto-generate public_bundle once.
  useEffect(() => {
    if (!authReady || !isAdmin || cloudLoading || !hasCloudData || hasPublicBundle) {
      return;
    }
    if (autoPublishedRef.current) return;

    const timer = window.setTimeout(async () => {
      if (autoPublishedRef.current) return;
      autoPublishedRef.current = true;
      try {
        await publishPublicBundle();
      } catch {
        // Admin can manually click "同步修改内容到云端" if needed
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [authReady, isAdmin, cloudLoading, hasCloudData, hasPublicBundle, publishPublicBundle]);

  const handleSyncToCloud = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      await syncModifiedContentToCloud();
      setSyncStatus({
        type: 'success',
        message: '已将修改内容同步到云端并刷新访客端公开快照（public_bundle），访客加载主页仅需 1 次读取。',
      });
    } catch (err) {
      setSyncStatus({
        type: 'error',
        message: err instanceof Error ? err.message : '同步到云端失败，请稍后重试。',
      });
    } finally {
      setSyncing(false);
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
            请使用已授权的教会管理员 Google 账号登录，即可实时编辑教会简介、牧者同工、主日流程与诗歌、事工轮值表及最新公告。
          </p>

          {authError && (
            <p role="alert" className="text-xs text-[#9A3412] bg-[#FDF2F0] p-3 rounded border border-[#E7B9B0]">
              {authError}
            </p>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                setAuthError('');
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
                    setAuthError('已取消 Google 登录，请重新点击登录。');
                  } else {
                    setAuthError(
                      err instanceof Error ? err.message : '登录弹窗被拦截或已取消，请重试。'
                    );
                  }
                }
              }}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md transition-colors cursor-pointer"
            >
              使用 Google 账号登录后台
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
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-[#57534E] hover:bg-[#E7E0D3]/60 hover:text-[#1C1917]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
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
              预览公开主页
            </button>
          </div>
        </header>

        {/* Mobile Sidebar Drawer */}
        {sidebarOpen && (
          <div className="lg:hidden bg-[#F3EFE6] border-b border-[#E5DFD3] px-6 py-4 space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md ${
                    activeTab === item.id
                      ? 'bg-[#1E3A5F] text-white'
                      : 'text-[#57534E] hover:bg-[#E7E0D3]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
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
          {!hasCloudData && (
            <div className="mb-6 bg-[#F3EFE6] border border-[#DFD8C8] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[#1C1917]">
                  尚未检测到云端数据
                </h2>
                <p className="text-xs text-[#57534E] mt-1">
                  点击右侧按钮可将当前主页内容与已修改数据同步写入 Firestore 云端数据库，以便跨设备持久化编辑与发布。
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncToCloud}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '正在同步…' : '同步修改内容到云端'}
              </button>
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
                  选择下方任意模块即可立即修改主页展示内容，保存时将自动同步到云端并更新访客端单文档汇总快照。
                </p>
              </div>

              <div className="bg-white border border-[#E5DFD3] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[#1C1917] tabular-nums">
                    访客端公开快照：
                    <span className={hasPublicBundle ? 'text-[#14532D]' : 'text-[#9A3412]'}>
                      {hasPublicBundle ? '已同步' : '待生成'}
                    </span>
                    <span className="text-[#A8A29E] mx-2">·</span>
                    <span className="text-[#57534E]">最近同步：{formattedSyncTime}</span>
                  </p>
                  <p className="text-xs text-[#57534E]">
                    访客端单文档读取 + 10 分钟本地缓存已启用：首次访问最多消耗 1 次云端读取，10 分钟内重复访问零读取。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSyncToCloud}
                  disabled={syncing}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? '正在同步…' : '同步修改内容到云端'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    tab: 'theme' as AdminTab,
                    label: '主题样式',
                    count: `当前：${currentThemeName}`,
                    sub: '经典 · 圣诞节 · 复活节 · 感恩节',
                  },
                  {
                    tab: 'info' as AdminTab,
                    label: '教会简介与联系',
                    count: hasCloudData ? '云端已就绪' : '使用默认模板',
                    sub: '主视觉 · 异象 · 堂址电话',
                  },
                  {
                    tab: 'pastors' as AdminTab,
                    label: '牧者及讲台同工',
                    count: `${pastors.length} 位牧者 · ${coworkers.length} 位同工`,
                    sub: '肖像档案与讲台轮值',
                  },
                  {
                    tab: 'worship' as AdminTab,
                    label: '主日时间与流程',
                    count: `${worshipTimes.length} 个时段 · ${liturgySteps.length} 步骤`,
                    sub: '常规主日与圣餐主日礼仪',
                  },
                  {
                    tab: 'songs' as AdminTab,
                    label: '主日崇拜歌曲',
                    count: `${worshipSongs.length} 首诗歌`,
                    sub: '诗歌名字 · YouTube 视频链接',
                  },
                  {
                    tab: 'roster' as AdminTab,
                    label: '主日事工岗位',
                    count: `${ministryRoster.length} 个岗位与班级`,
                    sub: '敬拜 · 主日学 · 团契',
                  },
                  {
                    tab: 'weekday' as AdminTab,
                    label: '周间事工安排',
                    count: `${weekdayMinistries.length} 项聚会`,
                    sub: '周二至周六常规聚会',
                  },
                  {
                    tab: 'announcements' as AdminTab,
                    label: '最新聚会公告',
                    count: `${announcements.length} 条公告`,
                    sub: '置顶重点与分类发布',
                  },
                  {
                    tab: 'visitors' as AdminTab,
                    label: '来访与代祷留言',
                    count: `${visitorRequests.length} 条记录`,
                    sub: '待跟进与权限分配',
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
          {activeTab === 'pastors' && <AdminPastorsEditor />}
          {activeTab === 'worship' && <AdminWorshipEditor mode="worship" />}
          {activeTab === 'songs' && <AdminWorshipEditor mode="songs" />}
          {activeTab === 'roster' && <AdminMinistryEditor mode="roster" />}
          {activeTab === 'weekday' && <AdminMinistryEditor mode="weekday" />}
          {activeTab === 'announcements' && <AdminAnnouncementsEditor />}
          {activeTab === 'visitors' && <AdminVisitorsPanel />}
        </main>
      </div>
    </div>
  );
}
