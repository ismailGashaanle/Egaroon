import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiUpload, FiX, FiImage, FiVideo } from 'react-icons/fi';
import { uploadApi } from '../../api/uploadApi';
import Button from './Button';
import CldImage from './CldImage';
import { toastApiError } from '../../lib/support';

/**
 * Auth-gated Cloudinary uploader.
 * onUploaded(url, uploadMeta)
 * value: string URL or string[] of URLs when multiple
 */
export default function MediaUpload({
  folder = 'misc',
  resourceType,
  accept = 'image/*,video/*',
  multiple = false,
  value,
  onChange,
  onUploaded,
  label = 'Upload media',
  hint,
  maxFiles = 8,
  className = '',
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const urls = Array.isArray(value) ? value : value ? [value] : [];

  const setUrls = (next) => {
    if (multiple) onChange?.(next);
    else onChange?.(next[0] || '');
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, maxFiles);
    if (!files.length) return;

    setBusy(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const isVideo = file.type.startsWith('video/');
        const { data } = await uploadApi.uploadFile(file, {
          folder: isVideo && folder !== 'videos' ? 'videos' : folder,
          resourceType: resourceType || (isVideo ? 'video' : 'image'),
        });
        const meta = data.data.upload;
        uploaded.push(meta.url);
        onUploaded?.(meta.url, meta);
      }
      const next = multiple ? [...urls, ...uploaded].slice(0, maxFiles) : uploaded;
      setUrls(next);
      toast.success(uploaded.length > 1 ? `${uploaded.length} fayl ayaa la shubay` : 'Faylka waa la shubay (Cloudflare)');
    } catch (err) {
      toastApiError(err, 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = (idx) => {
    const next = urls.filter((_, i) => i !== idx);
    setUrls(next);
  };

  return (
    <div className={className}>
      {label && <p className="mb-1.5 text-sm font-medium text-charcoal dark:text-dark-text">{label}</p>}
      {hint && <p className="mb-2 text-xs text-muted dark:text-dark-muted">{hint}</p>}

      <div className="flex flex-wrap gap-2">
        {urls.map((url, idx) => {
          const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/video/upload/');
          return (
            <div
              key={`${url}-${idx}`}
              className="relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-warmwhite dark:border-dark-border dark:bg-dark-surface-2"
            >
              {isVideo ? (
                <div className="flex h-full w-full items-center justify-center text-forest">
                  <FiVideo className="text-xl" />
                </div>
              ) : (
                <CldImage src={url} alt="" width={80} height={80} crop className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                onClick={() => removeAt(idx)}
                aria-label="Remove"
              >
                <FiX className="text-xs" />
              </button>
            </div>
          );
        })}

        {(multiple || urls.length === 0) && urls.length < maxFiles && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted transition hover:border-forest hover:text-forest disabled:opacity-50 dark:border-dark-border"
          >
            {busy ? (
              <span className="text-[10px]">…</span>
            ) : (
              <>
                <FiImage />
                <span className="text-[10px]">Add</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="mt-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          icon={<FiUpload />}
          loading={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : label}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
