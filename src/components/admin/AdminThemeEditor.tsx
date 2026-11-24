import { useState } from 'react';
import { Check, Loader2, Palette, RotateCcw } from 'lucide-react';
import {
  useChurchAdminActions,
  usePublicChurchData,
} from '../../context/ChurchDataContext';
import { normalizeSiteTheme, SITE_THEMES, type SiteThemeId } from '../../data/themes';
import { AdminPanelHeader, getFriendlyAdminError, StatusBanner } from './AdminSharedUI';

export function AdminThemeEditor() {
  const { churchInfo, lastSyncedAt } = usePublicChurchData();
  const { saveSiteTheme } = useChurchAdminActions();
  const currentTheme = normalizeSiteTheme(churchInfo.siteTheme);
  const currentMeta = SITE_THEMES.find((t) => t.id === currentTheme) ?? SITE_THEMES[0];

  const [switchingTo, setSwitchingTo] = useState<SiteThemeId | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const handleSelectTheme = async (themeId: SiteThemeId) => {
    if (switchingTo || themeId === currentTheme) return;

    setSwitchingTo(themeId);
    setStatus(null);
    try {
      await saveSiteTheme(themeId);
      const label = SITE_THEMES.find((item) => item.id === themeId)?.name ?? '经典';
      setStatus({
        type: 'success',
        message: `全站主题样式已一键切换为「${label}」，并已同步更新至 Firestore 云端配置与访客端公开首页。`,
      });
    } catch (err) {
      setStatus({
        type: 'error',
        message: getFriendlyAdminError(
          err,
          '主题切换同步到 Firestore 失败，请确认管理员登录状态后重试。'
        ),
      });
    } finally {
      setSwitchingTo(null);
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
    : '尚未同步';

  return (
    <div className="space-y-6">
      <AdminPanelHeader
        title="主题样式选择"
        description="在「经典」、「圣诞节」、「复活节」、「感恩节」四种预设风格中一键切换，保存后立即同步更新 Firestore 配置，全站所有版块结构保持不变。"
        action={
          currentTheme !== 'classic' ? (
            <button
              type="button"
              onClick={() => void handleSelectTheme('classic')}
              disabled={Boolean(switchingTo)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#57534E] bg-white border border-[#D6CFC2] hover:bg-[#F3EFE6] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              恢复「经典」默认样式
            </button>
          ) : null
        }
      />

      <StatusBanner status={status} onClear={() => setStatus(null)} />

      {/* Current Firestore Active Theme Bar */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0"
            style={{
              backgroundColor: currentMeta.preview.surface,
              borderColor: currentMeta.preview.border,
              color: currentMeta.preview.accent,
            }}
          >
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#78716C]">当前 Firestore 生效主题：</span>
              <span className="text-sm font-semibold text-[#1C1917]">{currentMeta.name}</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#EEF5F0] text-[#14532D] border border-[#B7D4C0]">
                已同步至公开主页
              </span>
            </div>
            <p className="text-xs text-[#57534E] mt-1">
              {currentMeta.subtitle} · 最近同步时间：{formattedSyncTime}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {currentMeta.swatches.map((hex, i) => (
            <span
              key={`active-swatch-${i}`}
              className="w-5 h-5 rounded-full border border-[#E5DFD3] shadow-xs"
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
        </div>
      </div>

      {/* 4 Theme Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SITE_THEMES.map((option) => {
          const isCurrent = currentTheme === option.id;
          const isUpdatingThis = switchingTo === option.id;
          const isBusy = Boolean(switchingTo);

          return (
            <div
              key={option.id}
              className={`rounded-lg border overflow-hidden transition-all flex flex-col ${
                isCurrent
                  ? 'bg-white border-[#1E3A5F] ring-1 ring-[#1E3A5F]'
                  : 'bg-white border-[#E5DFD3] hover:border-[#C9BFA9]'
              }`}
            >
              {/* Miniature Visual Preview Strip */}
              <div
                className="relative p-4 border-b select-none"
                style={{
                  backgroundColor: option.preview.bg,
                  borderColor: option.preview.border,
                }}
              >
                {/* Festive top accent bar */}
                <div
                  className="h-1 w-full rounded-full mb-3"
                  style={{
                    background:
                      option.preview.topBar === 'transparent'
                        ? option.preview.accent
                        : option.preview.topBar,
                  }}
                />

                {/* Mini Hero + Content Wireframe Preview */}
                <div
                  className="rounded-md overflow-hidden border"
                  style={{
                    borderColor: option.preview.border,
                    backgroundColor: option.preview.card,
                  }}
                >
                  <div
                    className="relative overflow-hidden px-3.5 py-3 flex items-center justify-between"
                    style={{ backgroundColor: option.preview.heroBg }}
                  >
                    {option.id === 'christmas' && (
                      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                        <svg
                          viewBox="0 0 24 24"
                          className="absolute top-1.5 left-[20%] w-2.5 h-2.5 text-white/75"
                          fill="none"
                        >
                          <path
                            d="M12 2v20M3.34 7l17.32 10M20.66 7L3.34 17"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute bottom-1.5 left-[44%] w-1 h-1 rounded-full bg-white/60" />
                        <svg
                          viewBox="0 0 24 24"
                          className="absolute top-2 right-[32%] w-2 h-2 text-white/60"
                          fill="none"
                        >
                          <path
                            d="M12 2v20M3.34 7l17.32 10M20.66 7L3.34 17"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute bottom-1 right-[14%] w-1 h-1 rounded-full bg-white/50" />
                      </div>
                    )}
                    <div className="relative space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: option.preview.gold }}
                        />
                        <span className="text-[11px] font-medium text-white/90">
                          基督教意大利伯特利华人教会
                        </span>
                      </div>
                      <p className="text-[10px] text-white/65">主日崇拜 · 每周日 14:30-16:30</p>
                    </div>
                    <span
                      className="relative text-[10px] font-medium px-2 py-1 rounded text-white"
                      style={{ backgroundColor: option.preview.accent }}
                    >
                      主日崇拜
                    </span>
                  </div>

                  <div
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                    style={{ backgroundColor: option.preview.surface }}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p
                        className="text-[11px] font-semibold truncate"
                        style={{ color: option.preview.ink }}
                      >
                        扎根圣道 · 彼此相爱
                      </p>
                      <p
                        className="text-[10px] truncate"
                        style={{ color: option.preview.inkMuted }}
                      >
                        {option.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center -space-x-1 shrink-0" aria-hidden="true">
                      {option.swatches.map((hex, idx) => (
                        <span
                          key={`${option.id}-preview-dot-${idx}`}
                          className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body & One-Click Switch Action */}
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
                        {option.name}
                      </h3>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-[#F3EFE6] text-[#57534E] border border-[#E5DFD3]">
                        {option.badge}
                      </span>
                    </div>

                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#14532D]">
                        <Check className="w-3.5 h-3.5" />
                        当前生效
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#57534E] leading-relaxed">{option.description}</p>
                </div>

                <div className="pt-3 border-t border-[#EFEAE0] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#78716C] font-mono">
                    {option.swatches.map((hex, idx) => (
                      <span
                        key={`${option.id}-hex-${idx}`}
                        className="px-1.5 py-0.5 rounded bg-[#FAF8F4] border border-[#E5DFD3]"
                      >
                        {hex}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSelectTheme(option.id)}
                    disabled={isCurrent || isBusy}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isCurrent
                        ? 'bg-[#EEF5F0] text-[#14532D] border border-[#B7D4C0] cursor-default'
                        : 'bg-[#1E3A5F] hover:bg-[#162C49] text-white disabled:opacity-50 cursor-pointer'
                    }`}
                  >
                    {isUpdatingThis ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        正在同步…
                      </>
                    ) : isCurrent ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        当前已启用
                      </>
                    ) : (
                      '一键切换并同步'
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#78716C] leading-relaxed">
        说明：主题配置仅在后台管理端提供，访客浏览公开主页时不可自行更改主题；点击任意卡片的「一键切换并同步」后，系统会立即更新 Firestore 云端文档（church_sections/info 与 public_bundle）及本地缓存。
      </p>
    </div>
  );
}
