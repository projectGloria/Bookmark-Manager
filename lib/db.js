// IndexedDB wrapper: stores `icons` (id -> record) and `layout` (id -> {x,y}).
const NAME = 'iconic';
let dbp;

function open() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('icons');
      r.result.createObjectStore('layout');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const rq = fn(t.objectStore(store));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

async function entries(store) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, 'readonly');
    const s = t.objectStore(store);
    const k = s.getAllKeys();
    const v = s.getAll();
    t.oncomplete = () => res(k.result.map((key, i) => [key, v.result[i]]));
    t.onerror = () => rej(t.error);
  });
}

export const getIcon = (id) => run('icons', 'readonly', (s) => s.get(id));
export const setIcon = (id, rec) => run('icons', 'readwrite', (s) => s.put(rec, id));
export const delIcon = (id) => run('icons', 'readwrite', (s) => s.delete(id));
export const allIcons = () => entries('icons');
export const setLayout = (id, pos) => run('layout', 'readwrite', (s) => s.put(pos, id));
export const delLayout = (id) => run('layout', 'readwrite', (s) => s.delete(id));
export const allLayout = () => entries('layout');
