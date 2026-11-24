import type { ReactNode } from 'react';

export function AdminPanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-[#E5DFD3]">
      <div>
        <h2 className="font-editorial text-2xl font-semibold text-[#1C1917]">{title}</h2>
        <p className="text-xs text-[#57534E] mt-1">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-[#292524]">{label}</span>
        {hint && <span className="text-[11px] text-[#78716C]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-[#D6CFC2] rounded-md text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]';

export const textareaClass =
  'w-full px-3 py-2 text-sm bg-white border border-[#D6CFC2] rounded-md text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] leading-relaxed';

export function StatusBanner({
  status,
  onClear,
}: {
  status: { type: 'success' | 'error'; message: string } | null;
  onClear?: () => void;
}) {
  if (!status) return null;
  return (
    <div
      role="status"
      className={`mb-5 px-4 py-3 rounded-md border text-xs flex items-center justify-between gap-4 ${
        status.type === 'success'
          ? 'bg-[#EEF5F0] border-[#B7D4C0] text-[#14532D]'
          : 'bg-[#FDF2F0] border-[#E7B9B0] text-[#9A3412]'
      }`}
    >
      <span>{status.message}</span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="underline underline-offset-2 cursor-pointer shrink-0"
        >
          关闭
        </button>
      )}
    </div>
  );
}

export function getFriendlyAdminError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message.trim();
  if (!msg) return fallback;
  if (msg.startsWith('{') && msg.endsWith('}')) {
    try {
      const parsed = JSON.parse(msg) as { error?: string };
      const inner = String(parsed.error ?? '').toLowerCase();
      if (inner.includes('permission-denied') || inner.includes('insufficient permissions')) {
        return '当前账号缺少此操作的权限，请确认已使用授权管理员账号登录。';
      }
      if (inner.includes('unavailable') || inner.includes('offline') || inner.includes('network')) {
        return '网络连接异常，请稍后重试。';
      }
      return fallback;
    } catch {
      return fallback;
    }
  }
  return msg;
}
