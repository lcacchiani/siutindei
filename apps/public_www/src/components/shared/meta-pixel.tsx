import { getMetaPixelId } from '@/lib/site-config';

const META_PIXEL_SCRIPT_PATH = '/scripts/init-meta-pixel.js';

export function MetaPixel() {
  const pixelId = getMetaPixelId();
  if (!pixelId) {
    return null;
  }

  return <script src={META_PIXEL_SCRIPT_PATH} async />;
}
