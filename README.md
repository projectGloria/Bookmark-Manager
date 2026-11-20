# Iconic Bookmarks

A bookmark manager for Brave / Chromium where **any picture can be the icon of a bookmark or folder**.
It works on your real browser bookmarks (via `chrome.bookmarks`).

## Install (Brave)
1. Open `brave://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Pin the extension. Optional: `brave://extensions/shortcuts` to change the launcher shortcut (default `Ctrl+Shift+K`).

## Features
- **Any image as icon**: drag-drop, paste (Ctrl+V on a hovered tile), file picker, image URL, or drag an image from a web page. Pan/zoom crop.
- **Generated icons**: emoji / text on a gradient.
- **Shapes** (squircle, circle, square, hex), **hover effects** (tilt, glow, bounce).
- **Animated GIF/WebP**: play on hover or always.
- **Folders** auto-show a 2×2 mosaic of their contents, or a custom cover image.
- **Full manager** (extension options page or ⤢ in popup): grid view with drag-reorder / move into folders, multi-select (Ctrl-click), context menu, **spatial canvas** (free-position tiles, pan, wheel-zoom).
- **Launcher**: `Ctrl+K` in the manager; `Ctrl+Shift+K` anywhere opens it.
- **Right-click a page** → "Bookmark page with custom icon…".
- **Export / Import** all icons + canvas layout as JSON.

## Limits
Extensions cannot restyle Brave's native bookmark bar / `brave://bookmarks`; custom icons appear in this extension's UI only. Icons are stored locally (IndexedDB) and do not sync between devices — use Export/Import.

## Tests
`npm test` (Node 18+).
