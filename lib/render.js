// Builds icon DOM for a bookmark node (custom image, folder mosaic, or favicon).
const urls = new WeakMap();

export function blobUrl(b) {
  let u = urls.get(b);
  if (!u) urls.set(b, (u = URL.createObjectURL(b)));
  return u;
}

export function faviconUrl(pageUrl, size = 64) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', String(size));
  return u.toString();
}

function img(src) {
  const i = document.createElement('img');
  i.src = src;
  i.draggable = false;
  return i;
}

function customImg(rec) {
  const el = img(blobUrl(rec.animated && rec.play !== 'always' ? rec.still || rec.blob : rec.blob));
  return el;
}

function mosaicCell(c, icons) {
  const cell = document.createElement('div');
  const rec = icons.get(c.id);
  if (rec?.blob) cell.append(img(blobUrl(rec.still || rec.blob)));
  else if (c.url) cell.append(img(faviconUrl(c.url, 32)));
  else cell.textContent = '📁';
  return cell;
}

export function iconEl(node, icons) {
  const rec = icons.get(node.id) || {};
  const el = document.createElement('div');
  el.className = `icon shape-${rec.shape || 'squircle'} fx-${rec.effect || 'none'}`;
  if (rec.blob) {
    const i = customImg(rec);
    el.append(i);
    if (rec.animated && rec.play !== 'always') {
      el.addEventListener('mouseenter', () => (i.src = blobUrl(rec.blob)));
      el.addEventListener('mouseleave', () => (i.src = blobUrl(rec.still || rec.blob)));
    }
  } else if (node.children) {
    el.classList.add('mosaic');
    const kids = node.children.slice(0, 4);
    if (!kids.length) el.textContent = '📁';
    kids.forEach((c) => el.append(mosaicCell(c, icons)));
  } else {
    el.classList.add('fav');
    el.append(img(faviconUrl(node.url || 'about:blank')));
  }
  return el;
}
