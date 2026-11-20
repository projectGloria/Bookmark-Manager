// Icon pipeline: decode, detect animation, crop/draw, generate, fetch.
export const ICON_SIZE = 256;

export async function toBitmap(blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    // e.g. SVG: fall back to an <img> element
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  }
}

const dims = (b) => [b.width || b.naturalWidth || ICON_SIZE, b.height || b.naturalHeight || ICON_SIZE];

export async function isAnimated(blob) {
  if (blob.type === 'image/gif') return true;
  if (blob.type === 'image/webp') {
    const head = new Uint8Array(await blob.slice(0, 128).arrayBuffer());
    return new TextDecoder('latin1').decode(head).includes('ANIM');
  }
  return false;
}

export function drawCover(ctx, bmp, S = ICON_SIZE, zoom = 1, ox = 0, oy = 0) {
  ctx.clearRect(0, 0, S, S);
  const [w, h] = dims(bmp);
  const k = Math.max(S / w, S / h) * zoom;
  const dw = w * k, dh = h * k;
  ctx.drawImage(bmp, (S - dw) / 2 + ox, (S - dh) / 2 + oy, dw, dh);
}

export function drawGenerated(ctx, S, { text = '', c1 = '#7c5cff', c2 = '#ff5c9d', fg = '#ffffff' } = {}) {
  ctx.clearRect(0, 0, S, S);
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  if (text) {
    const chars = [...text];
    const size = S * (chars.length <= 1 ? 0.6 : chars.length === 2 ? 0.45 : 0.9 / Math.max(chars.length, 3) * 1.6);
    ctx.font = `600 ${size}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.fillText(text, S / 2, S / 2 + size * 0.06, S * 0.9);
  }
}

export const canvasBlob = (canvas) => new Promise((r) => canvas.toBlob(r, 'image/png'));

export async function fetchImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Not an image');
  return blob;
}

/** Turn any image blob into an icon record (cover-cropped 256px PNG, or untouched animated). */
export async function blobToRecord(blob, base = {}) {
  const rec = { shape: 'squircle', effect: 'none', play: 'hover', ...base };
  delete rec.still;
  const bmp = await toBitmap(blob);
  const c = document.createElement('canvas');
  c.width = c.height = ICON_SIZE;
  drawCover(c.getContext('2d'), bmp);
  const png = await canvasBlob(c);
  if (await isAnimated(blob)) {
    rec.blob = blob;
    rec.still = png;
    rec.animated = true;
  } else {
    rec.blob = png;
    rec.animated = false;
  }
  return rec;
}
