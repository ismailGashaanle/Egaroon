import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Button from './Button';
import { uploadApi } from '../../api/uploadApi';
import { toastApiError } from '../../lib/support';

/**
 * Canvas signature → Cloudinary URL (folder: signatures).
 */
export default function SignaturePad({
  label = 'Signature',
  value = '',
  onChange,
  disabled = false,
}) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const pos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    if (disabled || busy) return;
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasInk(false);
    onChange?.('');
  };

  const upload = async () => {
    if (!hasInk) {
      toast.error('Please sign before uploading');
      return;
    }
    setBusy(true);
    try {
      const dataUri = canvasRef.current.toDataURL('image/png');
      const { data } = await uploadApi.uploadDataUri(dataUri, {
        folder: 'signatures',
        resourceType: 'image',
      });
      const url = data.data.upload.url;
      onChange?.(url);
      toast.success('Signature uploaded');
    } catch (err) {
      toastApiError(err, 'Signature upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-charcoal dark:text-dark-text">{label}</p>
      {value ? (
        <div className="rounded-xl border border-charcoal/10 bg-white p-3 dark:border-white/10 dark:bg-dark-card">
          <img src={value} alt="Signature" className="mx-auto max-h-28 object-contain" />
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => onChange?.('')}>
              Re-sign
            </Button>
          )}
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className="h-36 w-full touch-none rounded-xl border border-dashed border-charcoal/20 bg-white dark:border-white/20"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={clear} disabled={disabled || busy}>
              Clear
            </Button>
            <Button type="button" size="sm" onClick={upload} loading={busy} disabled={disabled || !hasInk}>
              Save signature
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
