import * as B from '../lib/bookmarks.js';
import * as db from '../lib/db.js';
import { iconEl } from '../lib/render.js';
import { openEditor } from '../lib/editor.js';
import { blobToRecord, fetchImage } from '../lib/icons.js';

const $ = (s) => document.querySelector(s);
let tree, byId, icons, cur, hover = null;

async function load() {
  tree = await B.getTree();
  byId = B.index(tree);
  icons = new Map(await db.allIcons());
  if (!cur || !byId.has(cur)) cur = (await chrome.storage.local.get('popupFolder')).popupFolder;
  if (!cur || !byId.has(cur)) cur = tree[0].children[0].id;
  render();
}

async function setRec(n, rec) {
  if (rec === 'reset') { await db.delIcon(n.id); icons.delete(n.id); }
  else if (rec) { await db.setIcon(n.id, rec); icons.set(n.id, rec); }
  render();
}
const editIcon = async (n) => setRec(n, await openEditor(n, icons.get(n.id)));

function go(id) {
  cur = id;
  chrome.storage.local.set({ popupFolder: id });
  render();
}

function tile(n) {
  // Real link => Brave's native right-click menu (containers etc.). Alt+right-click = icon editor.
  const t = document.createElement(n.url ? 'a' : 'div');
  if (n.url) t.href = n.url;
  t.className = 'tile';
  t.title = n.url || n.title;
  const l = document.createElement('span');
  l.textContent = n.title || n.url || '(untitled)';
  const e = document.createElement('button');
  e.className = 'edit';
  e.textContent = '✎';
  e.onclick = (ev) => { ev.stopPropagation(); editIcon(n); };
  t.append(iconEl(n, icons), l, e);
  t.onmouseenter = () => (hover = n);
  t.onmouseleave = () => hover === n && (hover = null);
  t.onclick = (ev) => {
    ev.preventDefault();
    if (n.children) go(n.id);
    else { chrome.tabs.create({ url: n.url }); window.close(); }
  };
  t.oncontextmenu = (ev) => {
    if (n.url && !ev.altKey) return;
    ev.preventDefault();
    editIcon(n);
  };
  t.draggable = false;
  t.ondragover = (ev) => ev.preventDefault();
  t.ondrop = async (ev) => {
    ev.preventDefault();
    const f = [...ev.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    try {
      const blob = f || (await fetchImage((ev.dataTransfer.getData('text/uri-list') || '').split('\n')[0]));
      setRec(n, await blobToRecord(blob, icons.get(n.id)));
    } catch {}
  };
  return t;
}

function render() {
  const grid = $('#grid');
  grid.classList.toggle('list', localStorage.getItem('popupList') === '1');
  grid.innerHTML = '';
  const crumb = $('#crumb');
  crumb.innerHTML = '';
  const par = byId.get(cur)?.parentId;
  $('#back').disabled = !par || par === tree[0].id;
  const chain = [];
  for (let n = byId.get(cur); n && n.id !== tree[0].id; n = byId.get(n.parentId)) chain.unshift(n);
  chain.forEach((n, i) => {
    const a = document.createElement('a');
    a.textContent = (i ? '› ' : '') + (n.title || 'Root');
    a.onclick = () => go(n.id);
    crumb.append(a);
  });
  const kids = byId.get(cur).children;
  kids.forEach((n) => grid.append(tile(n)));
  if (!kids.length) grid.innerHTML = '<div class="empty">Empty folder</div>';
}

$('#back').onclick = () => { const par = byId.get(cur)?.parentId; if (par && par !== tree[0].id) go(par); };
$('#list').onclick = () => { localStorage.setItem('popupList', localStorage.getItem('popupList') === '1' ? '0' : '1'); render(); };
$('#open').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('manager/manager.html') });
$('#add').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  const n = await B.create({ parentId: cur, title: tab.title, url: tab.url });
  await load();
  editIcon(byId.get(n.id));
};
document.addEventListener('paste', async (e) => {
  const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (it && hover) setRec(hover, await blobToRecord(it.getAsFile(), icons.get(hover.id)));
});
B.onChange(() => load());
load();
