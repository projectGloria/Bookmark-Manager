// Promise helpers around chrome.bookmarks.
export const getTree = () => chrome.bookmarks.getTree();
export const create = (o) => chrome.bookmarks.create(o);
export const update = (id, o) => chrome.bookmarks.update(id, o);
export const move = (id, o) => chrome.bookmarks.move(id, o);
export const removeTree = (id) => chrome.bookmarks.removeTree(id);

export function index(tree) {
  const m = new Map();
  (function walk(n) {
    m.set(n.id, n);
    n.children?.forEach(walk);
  })(tree[0]);
  return m;
}

/** Flat list of every node (without the invisible root): {id,title,url,path,node} */
export function flatten(tree) {
  const out = [];
  (function walk(n, path) {
    for (const c of n.children || []) {
      out.push({ id: c.id, title: c.title, url: c.url, path: path.join(' / '), node: c });
      if (c.children) walk(c, [...path, c.title]);
    }
  })(tree[0], []);
  return out;
}

export function onChange(cb) {
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
    chrome.bookmarks[ev].addListener(cb);
  }
}
