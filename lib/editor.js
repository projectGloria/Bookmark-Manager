// Icon editor dialog. Resolves: record (save) | 'reset' (use favicon) | null (cancel).
import { toBitmap, isAnimated, drawCover, drawGenerated, canvasBlob, fetchImage, ICON_SIZE } from './icons.js';

const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

export function openEditor(node, existing = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'editor';
    dlg.innerHTML = `
      <h3>Icon for “${(node.title || node.url || 'item').replace(/</g, '&lt;')}”</h3>
      <div class="tabs"><button data-m="image" class="on">Image</button><button data-m="gen">Emoji / Text / Gradient</button></div>
      <div id="p-image">
        <div class="drop" id="drop">Drop, paste (Ctrl+V) or click to choose an image<br><small>PNG, JPG, SVG, GIF, WebP…</small></div>
        <input type="file" accept="image/*" id="file" hidden>
        <div class="row"><input id="url" placeholder="…or image URL"><button id="fetch">Fetch</button></div>
        <label>Zoom <input type="range" id="zoom" min="1" max="4" step="0.01" value="1"></label>
        <small style="color:var(--mut)">Drag the preview to reposition.</small>
      </div>
      <div id="p-gen" hidden>
        <label>Emoji or text<input id="text" maxlength="12"></label>
        <div class="three">
          <label>Color 1<input type="color" id="c1"></label>
          <label>Color 2<input type="color" id="c2"></label>
          <label>Text<input type="color" id="fg" value="#ffffff"></label>
        </div>
      </div>
      <div class="pv"><canvas id="cv" width="${ICON_SIZE}" height="${ICON_SIZE}"></canvas></div>
      <div class="three">
        <label>Shape<select id="shape"><option>squircle</option><option>circle</option><option>square</option><option>hex</option></select></label>
        <label>Hover<select id="effect"><option>none</option><option>tilt</option><option>glow</option><option>bounce</option></select></label>
        <label>Animation<select id="play"><option value="hover">on hover</option><option value="always">always</option></select></label>
      </div>
      <div class="err" id="err"></div>
      <menu><button id="reset">Use favicon</button><button id="cancel">Cancel</button><button id="save" class="primary">Save</button></menu>`;
    document.body.append(dlg);
    const $ = (s) => dlg.querySelector(s);
    const cv = $('#cv');
    const ctx = cv.getContext('2d');
    const seed = hue(node.title || node.url || 'x');
    const hsl = (h) => {
      const c = document.createElement('canvas').getContext('2d');
      c.fillStyle = `hsl(${h} 70% 55%)`;
      return c.fillStyle;
    };
    $('#text').value = ([...(node.title || '?')][0] || '?').toUpperCase();
    $('#c1').value = hsl(seed);
    $('#c2').value = hsl(seed + 60);
    $('#shape').value = existing.shape || 'squircle';
    $('#effect').value = existing.effect || 'none';
    $('#play').value = existing.play || 'hover';

    const st = { mode: 'image', bmp: null, anim: null, fresh: false, touched: false, zoom: 1, ox: 0, oy: 0 };
    let result = null;

    const gen = () => ({ text: $('#text').value, c1: $('#c1').value, c2: $('#c2').value, fg: $('#fg').value });
    const redraw = () => {
      cv.className = 'shape-' + $('#shape').value;
      if (st.mode === 'gen') drawGenerated(ctx, ICON_SIZE, gen());
      else if (st.bmp) drawCover(ctx, st.bmp, ICON_SIZE, st.zoom, st.ox, st.oy);
      else ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
    };
    const err = (m = '') => ($('#err').textContent = m);

    async function load(blob, fresh) {
      try {
        err();
        st.bmp = await toBitmap(blob);
        st.anim = (await isAnimated(blob)) ? blob : null;
        st.fresh = fresh;
        st.zoom = 1; st.ox = st.oy = 0;
        $('#zoom').value = 1;
        $('#zoom').disabled = !!st.anim;
        redraw();
      } catch (e) {
        err('Could not read image: ' + e.message);
      }
    }

    if (existing.blob) {
      load(existing.still || existing.blob, false).then(() => {
        if (existing.animated) { st.anim = existing.blob; $('#zoom').disabled = true; }
      });
    } else redraw();

    // tabs
    dlg.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
      st.mode = b.dataset.m;
      dlg.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
      $('#p-image').hidden = st.mode !== 'image';
      $('#p-gen').hidden = st.mode !== 'gen';
      redraw();
    }));
    // inputs
    const drop = $('#drop');
    drop.onclick = () => $('#file').click();
    $('#file').onchange = (e) => e.target.files[0] && load(e.target.files[0], true);
    for (const t of ['dragover', 'dragenter']) dlg.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); });
    dlg.addEventListener('dragleave', () => drop.classList.remove('over'));
    dlg.addEventListener('drop', async (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
      if (f) return load(f, true);
      const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (u) { $('#url').value = u.split('\n')[0]; $('#fetch').click(); }
    });
    const onPaste = (e) => {
      const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (it) { e.preventDefault(); load(it.getAsFile(), true); }
    };
    document.addEventListener('paste', onPaste);
    $('#fetch').onclick = async () => {
      try { err(); await load(await fetchImage($('#url').value.trim()), true); }
      catch (e) { err('Fetch failed: ' + e.message); }
    };
    $('#zoom').oninput = (e) => { st.zoom = +e.target.value; st.touched = true; redraw(); };
    for (const id of ['#text', '#c1', '#c2', '#fg', '#shape']) $(id).oninput = redraw;
    let drag = null;
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy }; };
    cv.onpointermove = (e) => {
      if (!drag || st.anim) return;
      const k = ICON_SIZE / cv.clientWidth;
      st.ox = drag.ox + (e.clientX - drag.x) * k;
      st.oy = drag.oy + (e.clientY - drag.y) * k;
      st.touched = true;
      redraw();
    };
    cv.onpointerup = () => (drag = null);

    $('#cancel').onclick = () => dlg.close();
    $('#reset').onclick = () => { result = 'reset'; dlg.close(); };
    $('#save').onclick = async () => {
      const rec = { ...existing, shape: $('#shape').value, effect: $('#effect').value, play: $('#play').value };
      if (st.mode === 'gen') {
        rec.blob = await canvasBlob(cv);
        rec.animated = false;
        delete rec.still;
      } else if (st.bmp && (st.fresh || st.touched)) {
        const still = await canvasBlob(cv);
        if (st.anim) { rec.blob = st.anim; rec.still = still; rec.animated = true; }
        else { rec.blob = still; rec.animated = false; delete rec.still; }
      }
      result = rec;
      dlg.close();
    };
    dlg.addEventListener('close', () => {
      document.removeEventListener('paste', onPaste);
      dlg.remove();
      resolve(result);
    });
    dlg.showModal();
  });
}
