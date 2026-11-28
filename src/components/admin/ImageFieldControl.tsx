import { useRef, useState, type ChangeEvent } from 'react';
import { Link2, Trash2, Upload } from 'lucide-react';
import { isD1MediaUrl } from '../../lib/mediaStorage';
import {
  optimizeUploadedImage,
  type ImageOptimizationPreset,
  type OptimizedImageResult,
} from '../../utils/imageOptimizer';
import { SafeImage } from '../SafeImage';
import { inputClass } from './AdminSharedUI';

interface ImageFieldControlProps {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  allowClear?: boolean;
  previewAspect?: 'landscape' | 'portrait' | 'square';
  preset?: ImageOptimizationPreset;
  fitMode?: 'cover' | 'contain' | 'auto-contain-portrait';
  hint?: string;
  required?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ImageFieldControl({
  label,
  value,
  onChange,
  allowClear = false,
  previewAspect = 'landscape',
  preset,
  fitMode = 'cover',
  hint,
  required = false,
}: ImageFieldControlProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [forceUrlMode, setForceUrlMode] = useState(false);
  const [uploadMeta, setUploadMeta] = useState<OptimizedImageResult | null>(null);

  const resolvedPreset: ImageOptimizationPreset =
    preset ??
    (previewAspect === 'square'
      ? 'avatar'
      : previewAspect === 'portrait'
      ? 'poster'
      : 'banner');

  const isDataUri = value.startsWith('data:image/');
  const isD1Media = isD1MediaUrl(value);
  const isUploadedBinary = isDataUri || isD1Media;
  const approxBytes = isDataUri ? Math.round(value.length * 0.75) : 0;

  const previewFrameClass =
    previewAspect === 'portrait'
      ? 'w-20 h-28 rounded-md'
      : previewAspect === 'square'
      ? 'w-20 h-20 rounded-full'
      : 'w-32 h-20 rounded-md';

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg('');
    setProcessing(true);
    try {
      const result = await optimizeUploadedImage(file, resolvedPreset);
      setForceUrlMode(false);
      setUploadMeta(result);
      onChange(result.dataUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '图片优化处理失败，请重试。');
    } finally {
      setProcessing(false);
    }
  };

  const savedPercent =
    uploadMeta && uploadMeta.originalBytes > 0
      ? Math.max(
          0,
          Math.round(
            ((uploadMeta.originalBytes - uploadMeta.optimizedBytes) / uploadMeta.originalBytes) *
              100
          )
        )
      : 0;

  return (
    <div className="space-y-2.5 bg-[#FAF8F4] border border-[#E5DFD3] rounded-md p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-[#292524]">
          {label}
          {required && <span className="text-[#9A3412] ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[11px] text-[#78716C]">{hint}</span>}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
        <div
          className={`${previewFrameClass} overflow-hidden border border-[#DFD8C8] bg-[#FAF8F4] shrink-0`}
        >
          {value ? (
            <SafeImage
              src={value}
              alt={label}
              fallbackLabel="暂无预览"
              fitMode={fitMode}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[11px] text-[#78716C]">
              未设图片
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {processing ? '正在缩放与压缩…' : '上传并优化图片'}
            </button>

            {isUploadedBinary && !forceUrlMode && (
              <button
                type="button"
                onClick={() => setForceUrlMode(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#1E3A5F] bg-white border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                改填图片网址
              </button>
            )}

            {allowClear && value && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setForceUrlMode(false);
                  setUploadMeta(null);
                  onChange('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#9A3412] bg-white border border-[#E7B9B0] hover:bg-[#FDF2F0] rounded cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清除图片
              </button>
            )}
          </div>

          {isUploadedBinary && !forceUrlMode ? (
            <p className="text-xs text-[#14532D] bg-[#EEF5F0] border border-[#B7D4C0] rounded px-3 py-1.5 tabular-nums">
              {isD1Media
                ? '已保存至 Cloudflare D1 数据库存储，并开启浏览器与边缘强缓存加速加载。'
                : uploadMeta
                ? uploadMeta.wasResized || uploadMeta.wasCompressed
                  ? `已自动优化：${
                      uploadMeta.wasResized
                        ? `${uploadMeta.originalWidth}×${uploadMeta.originalHeight} → ${uploadMeta.width}×${uploadMeta.height}`
                        : `${uploadMeta.width}×${uploadMeta.height}`
                    } · ${formatFileSize(uploadMeta.originalBytes)} → ${formatFileSize(
                      uploadMeta.optimizedBytes
                    )}${savedPercent > 0 ? `（节省 ${savedPercent}%` : '（'}${
                      savedPercent > 0 ? '，' : ''
                    }${uploadMeta.formatLabel}），请点击保存同步到主页。`
                  : `已优化就绪：${uploadMeta.width}×${uploadMeta.height} · ${formatFileSize(
                      uploadMeta.optimizedBytes
                    )}（${uploadMeta.formatLabel}），请点击保存同步到主页。`
                : `已选择优化图片（约 ${formatFileSize(approxBytes)}），请点击保存同步到主页。`}
            </p>
          ) : (
            <input
              type="text"
              required={required && !isUploadedBinary}
              maxLength={500}
              value={isUploadedBinary ? '' : value}
              onChange={(e) => {
                setErrorMsg('');
                setUploadMeta(null);
                onChange(e.target.value);
              }}
              placeholder="支持填写 https://... 外链图片或 /api/media/... 站内图片路径"
              className={inputClass}
            />
          )}

          {errorMsg && (
            <p role="alert" className="text-xs text-[#9A3412]">
              {errorMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
