// Pure canvas-view math.
export const CELL = { w: 130, h: 140 };
export const defaultPos = (i, cols = 6) => ({ x: (i % cols) * CELL.w + 40, y: Math.floor(i / cols) * CELL.h + 40 });
export const clampZoom = (z) => Math.min(3, Math.max(0.2, z));

/** Zoom keeping the point (cx,cy) fixed on screen. view = {x,y,z} */
export function zoomAt(view, factor, cx, cy) {
  const z = clampZoom(view.z * factor);
  const k = z / view.z;
  return { z, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k };
}
