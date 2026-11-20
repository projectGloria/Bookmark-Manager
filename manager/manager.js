import * as B from '../lib/bookmarks.js';
import * as db from '../lib/db.js';
import { iconEl } from '../lib/render.js';
import { openEditor } from '../lib/editor.js';
import { blobToRecord, fetchImage } from '../lib/icons.js';
import { search } from '../lib/search.js';
import { defaultPos, zoomAt } from '../lib/layout.js';
import { exportData, importData } from '../lib/backup.js';

const $ = (s) => document.querySelector(s);
const main = $('#main');
let tree, byId = new Map(), icons = new Map(), layout = new Map();
let cur = null, view = localStorage.getItem('view') || 'grid';
let sel = new Set(), hover = null, dragIds = [], suppressClick = false;
const views = new Map();

/* ---------- data ---------- */
async function load() {
  tree = await B.getTree();
  byId = B.index(tree);
  icons = new Map(await db.allIcons());
  layout = new Map(await db.allLayout());
  if (!cur || !byId.has(cur)) cur = tree[0].children[0].id;
  sel = new Set([...sel].filter((id) => byId.has(id)));
  render();
}
let timer;
B.onChange(() => { clearTimeout(timer); timer = setTimeout(load, 120); });

async function applyRec(n, rec) {
  if (rec === 'reset') { await db.delIcon(n.id); icons.delete(n.id); }
  else if (rec) { await db.setIcon(n.id, rec); icons.set(n.id, rec); }
  render();
}
const editIcon = async (n) => applyRec(n, await openEditor(n, icons.get(n.id)));
const setFromBlob = async (n, blob) => applyRec(n, await blobToRecord(blob, icons.get(n.id)));

const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|#|$)/i;
async function blobFromDrop(dt) {
  const f = [...dt.files].find((f) => f.type.startsWith('image/'));
  if (f) return f;
  const u = (dt.getData('text/uri-list') || '').split('\n')[0].trim();
  if (u && IMG_EXT.test(u)) return fetchImage(u);
  return null;
}

/* ---------- render ---------- */
function render() {
  renderSide();
  renderCrumb();
  document.querySelectorAll('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
  if (view === 'canvas') renderCanvas(); else renderGrid();
}

function renderSide() {
  const side = $('#side');
  side.innerHTML = '<div class="brand"><i></i>Iconic</div>';
  const add = (n, depth) => {
    if (!n.children) return;
    const d = document.createElement('div');
    d.className = 'side-item' + (n.id === cur ? ' active' : '');
    d.style.paddingLeft = 8 + depth * 14 + 'px';
    const rec = icons.get(n.id);
    if (rec?.blob) d.append(iconEl(n, icons));
    else d.append(Object.assign(document.createElement('span'), { textContent: '📁' }));
    d.append(Object.assign(document.createElement('span'), { textContent: n.title || 'Root' }));
    d.onclick = () => go(n.id);
    d.ondragover = (e) => { e.preventDefault(); d.classList.add('dropinto'); };
    d.ondragleave = () => d.classList.remove('dropinto');
    d.ondrop = async (e) => {
      e.preventDefault(); d.classList.remove('dropinto');
      const ids = dragIds; dragIds = [];
      for (const id of ids) if (id !== n.id) await B.move(id, { parentId: n.id }).catch(() => {});
    };
    side.append(d);
    n.children.forEach((c) => add(c, depth + 1));
  };
  tree[0].children.forEach((c) => add(c, 0));
}

function renderCrumb() {
  const crumb = $('#crumb');
  crumb.innerHTML = '';
  const chain = [];
  for (let n = byId.get(cur); n && n.id !== tree[0].id; n = byId.get(n.parentId)) chain.unshift(n);
  chain.forEach((n, i) => {
    if (i) crumb.append(Object.assign(document.createElement('span'), { textContent: '›' }));
    const a = Object.assign(document.createElement('a'), { textContent: n.title || 'Root' });
    a.onclick = () => go(n.id);
    crumb.append(a);
  });
}

function go(id) { cur = id; sel.clear(); render(); }

function activate(n, newTab = false) {
  if (n.children) go(n.id);
  else chrome.tabs.create({ url: n.url, active: !newTab });
}

function dropPos(e, t) {
  const r = t.getBoundingClientRect();
  const [v, s, l] = view === 'list' ? [e.clientY, r.top, r.height] : [e.clientX, r.left, r.width];
  return { mid: v > s + l * 0.25 && v < s + l * 0.75, before: v < s + l / 2 };
}

function makeTile(n) {
  // Bookmarks are real links so Brave's native right-click menu (and extension
  // items such as "open in container") appear. Alt+right-click or ⋯ = our menu.
  const t = document.createElement(n.url ? 'a' : 'div');
  if (n.url) t.href = n.url;
  t.draggable = false;
  t.className = 'tile' + (sel.has(n.id) ? ' sel' : '');
  t.dataset.id = n.id;
  t.title = n.url || n.title;
  const more = Object.assign(document.createElement('button'), { className: 'edit', textContent: '⋯', title: 'More actions' });
  more.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    sel = new Set([n.id]);
    const r = more.getBoundingClientRect();
    showMenu(r.left, r.bottom, n);
  };
  t.append(iconEl(n, icons), Object.assign(document.createElement('span'), { textContent: n.title || n.url || '(untitled)' }), more);
  t.onmouseenter = () => (hover = n.id);
  t.onmouseleave = () => hover === n.id && (hover = null);
  t.onclick = (e) => {
    if (n.url) e.preventDefault();
    if (suppressClick) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) { sel.has(n.id) ? sel.delete(n.id) : sel.add(n.id); t.classList.toggle('sel'); return; }
    if (view === 'canvas') { sel = new Set([n.id]); document.querySelectorAll('.tile').forEach((x) => x.classList.toggle('sel', x === t)); return; }
    activate(n);
  };
  t.ondblclick = () => view === 'canvas' && activate(n);
  t.oncontextmenu = (e) => {
    if (n.url && !e.altKey) return; // native Brave menu
    e.preventDefault();
    if (!sel.has(n.id)) { sel = new Set([n.id]); document.querySelectorAll('.tile').forEach((x) => x.classList.toggle('sel', x === t)); }
    showMenu(e.clientX, e.clientY, n);
  };
  // drop: image -> icon; bookmarks -> move/reorder (grid)
  t.ondragover = (e) => {
    e.preventDefault();
    t.classList.toggle('dropinto', !dragIds.length || (n.children && dropPos(e, t).mid));
  };
  t.ondragleave = () => t.classList.remove('dropinto');
  t.ondrop = async (e) => {
    e.preventDefault(); e.stopPropagation();
    t.classList.remove('dropinto');
    if (!dragIds.length) { try { const b = await blobFromDrop(e.dataTransfer); if (b) setFromBlob(n, b); } catch {} return; }
    const ids = dragIds.filter((id) => id !== n.id); dragIds = [];
    const { mid, before } = dropPos(e, t);
    if (n.children && mid) { for (const id of ids) await B.move(id, { parentId: n.id }).catch(() => {}); return; }
    let idx = before ? n.index : n.index + 1;
    for (const id of ids) await B.move(id, { parentId: n.parentId, index: idx++ }).catch(() => {});
  };
  t.ondragstart = (e) => {
    dragIds = sel.has(n.id) ? [...sel] : [n.id];
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', n.title);
  };
  t.ondragend = () => (dragIds = []);
  return t;
}

function renderGrid() {
  main.className = view === 'list' ? 'grid list' : 'grid';
  main.onwheel = main.onpointerdown = null;
  main.innerHTML = '';
  const kids = byId.get(cur).children;
  kids.forEach((n) => { const t = makeTile(n); t.draggable = true; main.append(t); });
  // note: anchors need draggable=true explicitly so our drag handlers (not native link drag) run
  if (!kids.length) main.innerHTML = '<div class="empty">Empty folder – drop links here or use ＋ Bookmark</div>';
}
// drop links onto empty space = new bookmark
main.addEventListener('dragover', (e) => e.preventDefault());
main.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (dragIds.length) { for (const id of dragIds) await B.move(id, { parentId: cur }).catch(() => {}); dragIds = []; return; }
  const u = (e.dataTransfer.getData('text/uri-list') || '').split('\n')[0].trim();
  if (/^https?:/.test(u) && !IMG_EXT.test(u)) B.create({ parentId: cur, title: e.dataTransfer.getData('text/plain') || u, url: u });
});

function renderCanvas() {
  main.className = 'canvas';
  main.innerHTML = '';
  const v = views.get(cur) || { x: 0, y: 0, z: 1 };
  views.set(cur, v);
  const world = Object.assign(document.createElement('div'), { className: 'world' });
  const apply = () => (world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`);
  apply();
  main.append(world);
  byId.get(cur).children.forEach((n, i) => {
    const p = layout.get(n.id) || defaultPos(i);
    const t = makeTile(n);
    t.style.left = p.x + 'px';
    t.style.top = p.y + 'px';
    t.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const sx = e.clientX, sy = e.clientY, x0 = parseFloat(t.style.left), y0 = parseFloat(t.style.top);
      let moved = false;
      t.setPointerCapture(e.pointerId);
      t.onpointermove = (ev) => {
        const dx = (ev.clientX - sx) / v.z, dy = (ev.clientY - sy) / v.z;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) { t.style.left = x0 + dx + 'px'; t.style.top = y0 + dy + 'px'; }
      };
      t.onpointerup = async () => {
        t.onpointermove = t.onpointerup = null;
        if (!moved) return;
        suppressClick = true;
        setTimeout(() => (suppressClick = false), 0);
        const pos = { x: parseFloat(t.style.left), y: parseFloat(t.style.top) };
        layout.set(n.id, pos);
        await db.setLayout(n.id, pos);
      };
    });
    world.append(t);
  });
  main.onwheel = (e) => {
    e.preventDefault();
    const r = main.getBoundingClientRect();
    Object.assign(v, zoomAt(v, e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top));
    apply();
  };
  main.onpointerdown = (e) => {
    if (e.target !== main && e.target !== world) return;
    main.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY, ox = v.x, oy = v.y;
    main.onpointermove = (ev) => { v.x = ox + ev.clientX - sx; v.y = oy + ev.clientY - sy; apply(); };
    main.onpointerup = () => (main.onpointermove = main.onpointerup = null);
  };
}

/* ---------- context menu ---------- */
function showMenu(x, y, n) {
  const m = $('#ctx');
  const targets = [...sel].map((id) => byId.get(id)).filter(Boolean);
  const items = [];
  items.push([n.children ? 'Open folder' : 'Open', () => activate(n)]);
  if (!n.children) items.push(['Open in new background tab', () => activate(n, true)]);
  items.push(['Set icon…', () => editIcon(n)]);
  if (icons.has(n.id)) items.push(['Remove custom icon', () => applyRec(n, 'reset')]);
  items.push(['Edit…', () => editProps(n)]);
  items.push([targets.length > 1 ? `Delete ${targets.length} items` : 'Delete', async () => {
    if (!confirm(`Delete ${targets.length} item(s)?`)) return;
    for (const t of targets) await B.removeTree(t.id).catch(() => {});
  }]);
  m.innerHTML = '';
  items.forEach(([label, fn]) => {
    const d = Object.assign(document.createElement('div'), { textContent: label });
    d.onclick = () => { m.hidden = true; fn(); };
    m.append(d);
  });
  m.hidden = false;
  m.style.left = Math.min(x, innerWidth - 200) + 'px';
  m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + 'px';
}
document.addEventListener('click', () => ($('#ctx').hidden = true));


/* ---------- properties dialog ---------- */
function askProps({ heading, title = '', url }) {
  return new Promise((res) => {
    const d = $('#props');
    $('#pt').textContent = heading;
    $('#ptitle').value = title;
    $('#purlL').hidden = url === undefined;
    $('#purl').value = url || '';
    d.addEventListener('close', () => res(d.returnValue === 'ok' ? { title: $('#ptitle').value, url: $('#purl').value } : null), { once: true });
    d.returnValue = '';
    d.showModal();
  });
}
async function editProps(n) {
  const r = await askProps({ heading: 'Edit', title: n.title, url: n.children ? undefined : n.url });
  if (r) await B.update(n.id, n.children ? { title: r.title } : { title: r.title, url: r.url });
}
$('#newFolder').onclick = async () => {
  const r = await askProps({ heading: 'New folder' });
  if (r?.title) B.create({ parentId: cur, title: r.title });
};
$('#newMark').onclick = async () => {
  const r = await askProps({ heading: 'New bookmark', url: 'https://' });
  if (r?.url) B.create({ parentId: cur, title: r.title || r.url, url: r.url });
};

/* ---------- toolbar ---------- */
document.querySelectorAll('#seg button').forEach((b) => (b.onclick = () => { view = b.dataset.v; localStorage.setItem('view', view); render(); }));
$('#export').onclick = async () => {
  const data = await exportData(icons, layout, B.flatten(tree));
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })),
    download: `iconic-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
};
$('#import').onclick = () => $('#importFile').click();
$('#importFile').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const r = importData(JSON.parse(await f.text()), B.flatten(tree));
    for (const [id, rec] of r.icons) await db.setIcon(id, rec);
    for (const [id, pos] of r.layout) await db.setLayout(id, pos);
    alert(`Imported ${r.icons.size} icons.` + (r.skipped ? ` ${r.skipped} entries had no matching bookmark.` : ''));
    await load();
  } catch (err) { alert('Import failed: ' + err.message); }
  e.target.value = '';
};

/* ---------- paste image onto hovered/selected tile ---------- */
document.addEventListener('paste', (e) => {
  if (document.querySelector('dialog[open]')) return;
  const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  const id = hover || (sel.size === 1 ? [...sel][0] : null);
  if (it && id && byId.has(id)) setFromBlob(byId.get(id), it.getAsFile());
});

/* ---------- launcher (Ctrl+K) ---------- */
let lList = [], lSel = 0;
const lq = $('#lq');
function openLauncher() {
  $('#launcher').hidden = false;
  lq.value = '';
  lq.focus();
  lRender();
}
function closeLauncher() { $('#launcher').hidden = true; }
function lRender() {
  lList = search(lq.value, B.flatten(tree), 30);
  lSel = Math.min(lSel, Math.max(0, lList.length - 1));
  const box = $('#lres');
  box.innerHTML = '';
  lList.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'lrow' + (i === lSel ? ' on' : '');
    const txt = document.createElement('div');
    txt.innerHTML = '<b></b><small></small>';
    txt.firstChild.textContent = r.title || r.url || '(untitled)';
    txt.lastChild.textContent = r.url || r.path || 'Folder';
    row.append(iconEl(r.node, icons), txt);
    row.onclick = () => choose(r, false);
    box.append(row);
  });
  box.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
}
function choose(r, newTab) {
  closeLauncher();
  if (r.node.children) go(r.id); else chrome.tabs.create({ url: r.url, active: !newTab });
}
lq.oninput = () => { lSel = 0; lRender(); };
lq.onkeydown = (e) => {
  if (e.key === 'ArrowDown') { lSel = Math.min(lSel + 1, lList.length - 1); lRender(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { lSel = Math.max(lSel - 1, 0); lRender(); e.preventDefault(); }
  else if (e.key === 'Enter' && lList[lSel]) choose(lList[lSel], e.ctrlKey);
  else if (e.key === 'Escape') closeLauncher();
};
$('#launcher').onclick = (e) => e.target.id === 'launcher' && closeLauncher();
$('#launch').onclick = openLauncher;
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openLauncher(); }
  if (e.key === 'Delete' && sel.size && !document.querySelector('dialog[open]') && document.activeElement === document.body) {
    const t = [...sel].map((id) => byId.get(id)).filter(Boolean);
    if (confirm(`Delete ${t.length} item(s)?`)) t.forEach((n) => B.removeTree(n.id));
  }
});

/* ---------- boot ---------- */
(async () => {
  await load();
  const h = location.hash;
  if (h === '#launcher') openLauncher();
  const m = h.match(/^#edit=(.+)$/);
  if (m && byId.has(m[1])) {
    const n = byId.get(m[1]);
    cur = n.parentId;
    render();
    editIcon(n);
  }
})();
