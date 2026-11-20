import * as db from './lib/db.js';

const manager = (hash = '') => chrome.runtime.getURL('manager/manager.html') + hash;

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'open-launcher') chrome.tabs.create({ url: manager('#launcher') });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'iconic-add', title: 'Bookmark page with custom icon…', contexts: ['page'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'iconic-add' || !tab?.url) return;
  let [bm] = await chrome.bookmarks.search({ url: tab.url });
  if (!bm) {
    const tree = await chrome.bookmarks.getTree();
    bm = await chrome.bookmarks.create({ parentId: tree[0].children[0].id, title: tab.title, url: tab.url });
  }
  chrome.tabs.create({ url: manager('#edit=' + bm.id) });
});

// Drop icon data when bookmarks are deleted.
chrome.bookmarks.onRemoved.addListener((id, info) => {
  (function walk(n) {
    db.delIcon(n.id);
    db.delLayout(n.id);
    n.children?.forEach(walk);
  })(info.node || { id });
});
