import { useEffect, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

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

export function ConfirmDeleteButton({
  onConfirm,
  label = '删除',
  confirmLabel = '确认删除',
  ariaLabel,
  className,
  showIcon = true,
}: {
  onConfirm: () => Promise<void> | void;
  label?: string;
  confirmLabel?: string;
  ariaLabel?: string;
  className?: string;
  showIcon?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={ariaLabel ?? label}
        className={
          className ??
          'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#9A3412] border border-[#E7B9B0] hover:bg-[#FDF2F0] rounded cursor-pointer'
        }
      >
        {showIcon && <Trash2 className="w-3.5 h-3.5 shrink-0" />}
        {label && <span>{label}</span>}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await onConfirm();
          } finally {
            setPending(false);
            setConfirming(false);
          }
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-60 rounded cursor-pointer whitespace-nowrap"
      >
        {pending ? '处理中…' : confirmLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="px-2 py-1.5 text-xs text-[#57534E] border border-[#D6CFC2] bg-white hover:bg-[#F3EFE6] rounded cursor-pointer whitespace-nowrap"
      >
        取消
      </button>
    </span>
  );
}

export function getFriendlyAdminError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message.trim();
  if (!msg) return fallback;
  const lowerMsg = msg.toLowerCase();
  if (
    lowerMsg.includes('d1') &&
    (lowerMsg.includes('未绑定') || lowerMsg.includes('binding') || lowerMsg.includes('not configured'))
  ) {
    return 'Cloudflare D1 数据库尚未绑定，请在 Cloudflare Pages Settings → Bindings 中绑定变量名 DB。';
  }
  if (
    lowerMsg.includes('resource-exhausted') ||
    lowerMsg.includes('quota limit exceeded') ||
    lowerMsg.includes('quota exceeded')
  ) {
    return '云端服务暂忙或已达配额上限，请稍后再试。';
  }
  if (msg.startsWith('{') && msg.endsWith('}')) {
    try {
      const parsed = JSON.parse(msg) as { error?: string };
      const inner = String(parsed.error ?? '').toLowerCase();
      if (inner.includes('permission-denied') || inner.includes('insufficient permissions')) {
        return '当前账号缺少此操作的权限，请确认已使用授权管理员账号登录。';
      }
      if (
        inner.includes('resource-exhausted') ||
        inner.includes('quota limit exceeded') ||
        inner.includes('quota exceeded')
      ) {
        return '云端服务暂忙或已达配额上限，请稍后再试。';
      }
      if (inner.includes('unavailable') || inner.includes('offline') || inner.includes('network')) {
        return '网络连接异常，请稍后重试。';
      }
      return parsed.error || fallback;
    } catch {
      return fallback;
    }
  }
  return msg;
}
