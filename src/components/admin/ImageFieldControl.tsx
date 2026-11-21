import { useRef, useState, type ChangeEvent } from 'react';
import { Link2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { SafeImage } from '../SafeImage';
import { inputClass } from './AdminSharedUI';

interface ImageFieldControlProps {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  defaultValue?: string;
  allowClear?: boolean;
  previewAspect?: 'landscape' | 'portrait' | 'square';
  maxWidth: number;
  maxHeight: number;
  maxChars: number;
  hint?: string;
  required?: boolean;
}

async function compressImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number,
  maxChars: number
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择 JPG、PNG 或 WebP 格式的图片文件。');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('无法读取该图片文件，请尝试其他图片。'));
      el.src = objectUrl;
    });

    const ratio = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
    let width = Math.max(1, Math.round(img.naturalWidth * ratio));
    let height = Math.max(1, Math.round(img.naturalHeight * ratio));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('浏览器不支持图片画布压缩，请改用外链图片地址。');
    }

    const renderCandidate = (w: number, h: number, mime: 'image/webp' | 'image/jpeg', q: number) => {
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = '#FAF8F4';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL(mime, q);
    };

    const probeWebp = renderCandidate(Math.min(width, 32), Math.min(height, 32), 'image/webp', 0.8);
    const mime: 'image/webp' | 'image/jpeg' = probeWebp.startsWith('data:image/webp')
      ? 'image/webp'
      : 'image/jpeg';

    for (let scaleStep = 0; scaleStep < 4; scaleStep += 1) {
      for (const q of [0.84, 0.74, 0.64, 0.54, 0.44]) {
        const candidate = renderCandidate(width, height, mime, q);
        if (candidate.length <= maxChars) {
          return candidate;
        }
      }
      width = Math.max(120, Math.round(width * 0.75));
      height = Math.max(120, Math.round(height * 0.75));
    }

    throw new Error('图片分辨率或细节过高，压缩后仍超出限额，请换一张图片或使用图片外链。');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ImageFieldControl({
  label,
  value,
  onChange,
  defaultValue,
  allowClear = false,
  previewAspect = 'landscape',
  maxWidth,
  maxHeight,
  maxChars,
  hint,
  required = false,
}: ImageFieldControlProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [forceUrlMode, setForceUrlMode] = useState(false);

  const isDataUri = value.startsWith('data:image/');
  const approxKb = isDataUri ? Math.max(1, Math.round((value.length * 0.75) / 1024)) : 0;

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
    setCompressing(true);
    try {
      const dataUrl = await compressImageFile(file, maxWidth, maxHeight, maxChars);
      setForceUrlMode(false);
      onChange(dataUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '图片处理失败，请重试。');
    } finally {
      setCompressing(false);
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
          className={`${previewFrameClass} overflow-hidden border border-[#DFD8C8] bg-[#EFEAE0] shrink-0`}
        >
          {value ? (
            <SafeImage
              src={value}
              alt={label}
              fallbackLabel="暂无预览"
              className="w-full h-full object-cover object-center"
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
              disabled={compressing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-60 rounded cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {compressing ? '压缩处理中…' : '本地上传图片'}
            </button>

            {isDataUri && !forceUrlMode && (
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
                  onChange('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#9A3412] bg-white border border-[#E7B9B0] hover:bg-[#FDF2F0] rounded cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清除图片
              </button>
            )}
          </div>

          {isDataUri && !forceUrlMode ? (
            <p className="text-xs text-[#14532D] bg-[#EEF5F0] border border-[#B7D4C0] rounded px-3 py-1.5 tabular-nums">
              已选择本地上传图片（自动优化压缩约 {approxKb} KB），保存后立即同步到主页。
            </p>
          ) : (
            <input
              type="text"
              required={required && !isDataUri}
              maxLength={500}
              value={isDataUri ? '' : value}
              onChange={(e) => {
                setErrorMsg('');
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
