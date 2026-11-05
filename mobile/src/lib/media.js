/**
 * Cover / gallery URLs from stadium + field `images[]` (Cloudinary or plain).
 */

export { stadiumPlace } from './ownerDisplay';

export function firstImage(images) {
  if (typeof images === 'string' && images.trim()) return images.trim();
  if (!Array.isArray(images)) return null;
  const hit = images.find((u) => typeof u === 'string' && u.trim());
  return hit ? hit.trim() : null;
}

/**
 * Insert a Cloudinary fill transform when the URL is untransformed.
 * Non-Cloudinary URLs pass through unchanged.
 */
export function coverUri(images, { width = 800, height = 480 } = {}) {
  const raw = firstImage(images);
  if (!raw) return null;
  if (!/res\.cloudinary\.com|cloudinary\.com/i.test(raw)) return raw;

  const marker = '/upload/';
  const idx = raw.indexOf(marker);
  if (idx < 0) return raw;

  const after = raw.slice(idx + marker.length);
  if (/^[^/]*[,_=]/.test(after)) return raw;

  const transform = `c_fill,g_auto,w_${width},h_${height},q_auto,f_auto`;
  return `${raw.slice(0, idx + marker.length)}${transform}/${after}`;
}
