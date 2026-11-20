import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search, score } from '../lib/search.js';
import { defaultPos, zoomAt, clampZoom } from '../lib/layout.js';
import { exportData, importData, matchImport } from '../lib/backup.js';
import { readFileSync } from 'node:fs';

const items = [
  { title: 'GitHub', url: 'https://github.com', path: 'Bar / Dev' },
  { title: 'YouTube', url: 'https://youtube.com', path: 'Bar' },
  { title: 'Hacker News', url: 'https://news.ycombinator.com', path: 'Bar / News' },
];

test('search: substring, fuzzy, multi-term', () => {
  assert.equal(search('git', items)[0].title, 'GitHub');
  assert.equal(search('ytb', items)[0].title, 'YouTube');
  assert.equal(search('news ycomb', items)[0].title, 'Hacker News');
  assert.equal(search('zzzz', items).length, 0);
  assert.equal(search('', items).length, 3);
  assert.ok(score('a', 'abc') > score('c', 'abc'));
});

test('layout math', () => {
  assert.deepEqual(defaultPos(0), { x: 40, y: 40 });
  assert.deepEqual(defaultPos(7, 6), { x: 170, y: 180 });
  assert.equal(clampZoom(99), 3);
  const v = { x: 10, y: 20, z: 1 };
  const r = zoomAt(v, 2, 100, 100);
  // point under cursor stays fixed
  assert.equal((100 - v.x) / v.z, (100 - r.x) / r.z);
  assert.equal((100 - v.y) / v.z, (100 - r.y) / r.z);
});

test('backup roundtrip + matching by url when ids differ', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/png' });
  const icons = new Map([['5', { blob, shape: 'circle', effect: 'glow', play: 'hover' }]]);
  const layout = new Map([['5', { x: 1, y: 2 }], ['9', { x: 3, y: 4 }]]);
  const nodes = [{ id: '5', title: 'GitHub', url: 'https://github.com', path: 'Bar' }, { id: '9', title: 'Dev', path: 'Bar' }];
  const json = JSON.parse(JSON.stringify(await exportData(icons, layout, nodes)));
  assert.equal(json.items.length, 2);
  const newNodes = [{ id: '77', title: 'GitHub!', url: 'https://github.com', path: 'Bar' }, { id: '80', title: 'Dev', path: 'Bar' }];
  const r = importData(json, newNodes);
  assert.equal(r.icons.get('77').shape, 'circle');
  assert.deepEqual([...new Uint8Array(await r.icons.get('77').blob.arrayBuffer())], [1, 2, 3, 250]);
  assert.deepEqual(r.layout.get('80'), { x: 3, y: 4 });
  assert.equal(r.skipped, 0);
  assert.throws(() => importData({}, []));
  assert.equal(matchImport([{ id: 'x', title: 'Nope', url: 'u' }], newNodes).size, 0);
});

test('manifest is valid MV3 and referenced files exist', () => {
  const m = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
  assert.equal(m.manifest_version, 3);
  for (const f of [m.action.default_popup, m.options_page, m.background.service_worker]) {
    readFileSync(new URL('../' + f, import.meta.url));
  }
});
