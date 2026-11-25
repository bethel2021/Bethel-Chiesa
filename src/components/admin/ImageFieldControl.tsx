import { useRef, useState, type ChangeEvent } from 'react';
import { Link2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { DATA_IMAGE_URI_REGEX, isMediaUri } from '../../lib/mediaStorage';
import { SafeImage } from '../SafeImage';
import { inputClass } from './AdminSharedUI';

const MAX_ORIGINAL_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB original lossless file limit

interface ImageFieldControlProps {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  defaultValue?: string;
  allowClear?: boolean;
  previewAspect?: 'landscape' | 'portrait' | 'square';
  fitMode?: 'cover' | 'contain' | 'auto-contain-portrait';
  hint?: string;
  required?: boolean;
}

interface OriginalImageResult {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function readOriginalImageFile(file: File): Promise<OriginalImageResult> {
  const allowedMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const normalizedMime = file.type.toLowerCase();
  if (!allowedMimes.has(normalizedMime)) {
    throw new Error('请选择 JPG、PNG 或 WebP 格式的原图文件。');
  }
  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    throw new Error('原图文件超过 12 MB 上限，请选用 12 MB 以内的原图或填写外链网址。');
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(objectUrl);

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('无法读取图片文件内容，请重试。'));
          return;
        }
        // Normalize data:image/jpg -> data:image/jpeg if needed; base64 payload stays identical
        const rawResult = reader.result.replace(/^data:image\/jpg;base64,/, 'data:image/jpeg;base64,');
        if (!DATA_IMAGE_URI_REGEX.test(rawResult)) {
          reject(new Error('图片编码格式不支持，请上传标准 JPG、PNG 或 WebP 原图。'));
          return;
        }
        resolve({
          dataUrl: rawResult,
          width,
          height,
          bytes: file.size,
        });
      };
      reader.onerror = () => reject(new Error('读取原图文件失败，请重试。'));
      reader.readAsDataURL(file);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法解析该图片文件，请确认文件未损坏。'));
    };

    img.src = objectUrl;
  });
}

export function ImageFieldControl({
  label,
  value,
  onChange,
  defaultValue,
  allowClear = false,
  previewAspect = 'landscape',
  fitMode = 'cover',
  hint,
  required = false,
}: ImageFieldControlProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [reading, setReading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [forceUrlMode, setForceUrlMode] = useState(false);
  const [uploadMeta, setUploadMeta] = useState<{
    width: number;
    height: number;
    bytes: number;
  } | null>(null);

  const isDataUri = value.startsWith('data:image/');
  const isCloudMedia = isMediaUri(value);
  const isUploadedBinary = isDataUri || isCloudMedia;
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
    setReading(true);
    try {
      const result = await readOriginalImageFile(file);
      setForceUrlMode(false);
      setUploadMeta({
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      });
      onChange(result.dataUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '原图读取失败，请重试。');
    } finally {
      setReading(false);
    }
  };

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
              disabled={reading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {reading ? '读取原图中…' : '上传原图（无损直传）'}
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

            {defaultValue && value !== defaultValue && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setForceUrlMode(false);
                  setUploadMeta(null);
                  onChange(defaultValue);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#57534E] bg-white border border-[#D6CFC2] hover:bg-[#F3EFE6] rounded cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                恢复默认
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
              {isCloudMedia
                ? '已保存云端无损原图，主页与后台均按原始分辨率清晰展示。'
                : uploadMeta
                ? `已选择原图（${uploadMeta.width}×${uploadMeta.height}，${formatFileSize(uploadMeta.bytes)} · 零压缩无损直传），请点击保存同步到主页。`
                : `已选择原图（约 ${formatFileSize(approxBytes)} · 无损直传），请点击保存同步到主页。`}
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
              placeholder="支持填写 https://... 外链图片或 /src/assets/images/... 本地路径"
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
