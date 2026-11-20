// Export / import of icons + layout as one JSON file (images as data URLs).
// Pure of browser-extension APIs so it can be tested in Node.
async function b2d(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(s)}`;
}

function d2b(d) {
  const [h, b] = d.split(',');
  const type = h.slice(5).split(';')[0];
  const bin = atob(b);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
}

/** nodes: [{id,title,url,path}] ; icons/layout: Map */
export async function exportData(icons, layout, nodes) {
  const items = [];
  for (const n of nodes) {
    const rec = icons.get(n.id);
    const pos = layout.get(n.id);
    if (!rec && !pos) continue;
    const item = { id: n.id, title: n.title, url: n.url || '', path: n.path };
    if (rec) {
      item.icon = { ...rec };
      if (rec.blob) item.icon.blob = await b2d(rec.blob);
      if (rec.still) item.icon.still = await b2d(rec.still);
    }
    if (pos) item.pos = pos;
    items.push(item);
  }
  return { app: 'iconic-bookmarks', version: 1, items };
}

/** Returns Map(importId -> existing node id). */
export function matchImport(items, nodes) {
  const out = new Map();
  const used = new Set();
  for (const it of items) {
    let m = nodes.find((n) => n.id === it.id && n.title === it.title && (n.url || '') === (it.url || ''));
    if (!m) {
      m = nodes.find(
        (n) =>
          !used.has(n.id) &&
          (it.url ? n.url === it.url : !n.url && n.path === it.path && n.title === it.title)
      );
    }
    if (m) {
      used.add(m.id);
      out.set(it.id, m.id);
    }
  }
  return out;
}

export function importData(json, nodes) {
  if (json?.app !== 'iconic-bookmarks') throw new Error('Not an Iconic backup file');
  const map = matchImport(json.items, nodes);
  const icons = new Map();
  const layout = new Map();
  for (const it of json.items) {
    const id = map.get(it.id);
    if (!id) continue;
    if (it.icon) {
      const rec = { ...it.icon };
      if (rec.blob) rec.blob = d2b(rec.blob);
      if (rec.still) rec.still = d2b(rec.still);
      icons.set(id, rec);
    }
    if (it.pos) layout.set(id, it.pos);
  }
  return { icons, layout, skipped: json.items.length - map.size };
}
