import { useEffect, useState } from 'react';
import { AdvancedImage } from '@cloudinary/react';
import { buildCldImage } from '../../lib/cloudinary';

/**
 * Universal media image component:
 * - Automatically renders Cloudflare R2 URLs, custom domain URLs, and Cloudinary URLs.
 * - Handles lazy loading and async decoding for maximum performance.
 * - Updates immediately when src changes.
 */
export default function CldImage({
  src,
  alt = '',
  width,
  height,
  crop = true,
  className = '',
  fallback = null,
  ...rest
}) {
  const [imgSrc, setImgSrc] = useState(src);
  const [errored, setErrored] = useState(false);

  // Sync state whenever the src prop changes (e.g. after user uploads a new image)
  useEffect(() => {
    setImgSrc(src);
    setErrored(false);
  }, [src]);

  const cldImg = !errored ? buildCldImage(imgSrc, { width, height, crop }) : null;

  if (cldImg) {
    return <AdvancedImage cldImg={cldImg} alt={alt} className={className} {...rest} />;
  }

  if (!imgSrc) return null;

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!errored && fallback && imgSrc !== fallback) {
          setErrored(true);
          setImgSrc(fallback);
        }
      }}
      {...rest}
    />
  );
}
