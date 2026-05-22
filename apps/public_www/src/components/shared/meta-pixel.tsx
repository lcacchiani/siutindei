const META_PIXEL_SCRIPT_PATH = '/scripts/init-meta-pixel.js';

export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) {
    return null;
  }

  return <script src={META_PIXEL_SCRIPT_PATH} async />;
}
