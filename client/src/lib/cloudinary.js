import { Cloudinary } from '@cloudinary/url-gen';
import { auto } from '@cloudinary/url-gen/actions/resize';
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity';

/** Public cloud name only — never put API secret in the Vite client. */
export const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'y345vwr0';

export const cld = new Cloudinary({
  cloud: { cloudName: CLOUDINARY_CLOUD_NAME },
  url: { secure: true },
});

/**
 * Extract public_id from a Cloudinary delivery URL, or return the string if it
 * already looks like a public_id (e.g. kulansiiye/avatars/abc).
 */
export function publicIdFromUrl(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\.[a-z0-9]+$/i, '');
  }

  try {
    const u = new URL(trimmed);
    if (!/cloudinary\.com/i.test(u.hostname)) return null;

    const marker = '/upload/';
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    let rest = u.pathname.slice(idx + marker.length);
    const parts = rest.split('/').filter(Boolean);
    while (parts.length && (/^v\d+$/i.test(parts[0]) || /[,_=]/.test(parts[0]))) {
      parts.shift();
    }
    if (!parts.length) return null;
    const joined = parts.join('/');
    return decodeURIComponent(joined.replace(/\.[a-z0-9]+$/i, ''));
  } catch {
    return null;
  }
}

export function isCloudinaryUrl(url) {
  return Boolean(url && /res\.cloudinary\.com|cloudinary\.com/i.test(url));
}

/**
 * Build an optimized Cloudinary image for AdvancedImage.
 * Returns null when src is not a Cloudinary asset (caller should use plain <img>).
 */
export function buildCldImage(src, { width, height, crop = true } = {}) {
  const publicId = publicIdFromUrl(src);
  if (!publicId) return null;

  let img = cld.image(publicId).format('auto').quality('auto');

  if (width || height) {
    let resize = auto();
    if (crop) resize = resize.gravity(autoGravity());
    if (width) resize = resize.width(width);
    if (height) resize = resize.height(height);
    img = img.resize(resize);
  }

  return img;
}
