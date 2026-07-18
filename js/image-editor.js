/*
 * Image editor
 * ------------
 * An object-based annotation editor. Every annotation (text, rectangle,
 * ellipse, arrow, freehand stroke) is a data object stored in `state.objects`,
 * rendered to the DOM for editing, and re-rendered to a canvas on export.
 *
 * Because annotations are objects rather than pixels baked into the image, they
 * can be selected, MOVED, resized and restyled at any time after being created.
 *
 * Geometry is stored in the image's own (natural) pixel space and multiplied by
 * `state.scale` at render time, so the same numbers drive both the on-screen
 * editor and the exported PNG.
 */
'use strict';

(function () {
  /* -------------------------------------------------------------- elements */
  const $ = (sel) => document.querySelector(sel);
  const viewport = $('#viewport');
  const stage = $('#stage');
  const layer = $('#layer');
  const baseImage = $('#baseImage');
  const emptyState = $('#emptyState');
  const dropOverlay = $('#dropOverlay');
  const fileInput = $('#fileInput');
  const fileNameEl = $('#fileName');

  const elementPanel = $('#elementPanel');
  const hintPanel = $('#hintPanel');
  const fillRow = $('#fillRow');
  const strokeRow = $('#strokeRow');
  const fontRow = $('#fontRow');

  /* ----------------------------------------------------------------- state */
  const state = {
    image: null,        // HTMLImageElement
    naturalW: 0,
    naturalH: 0,
    scale: 1,           // display px per natural px
    objects: [],
    selectedId: null,
    tool: 'select',
    filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0 },
    // style used for the next created object
    brush: { color: '#f43f5e', strokeWidth: 3, fontSize: 32, opacity: 100, fill: false },
  };

  const history = { past: [], future: [], current: null };

  /* -------------------------------------------------------------- helpers */
  let idSeq = 1;
  const uid = () => 'o' + idSeq++;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const selected = () => state.objects.find((o) => o.id === state.selectedId) || null;

  function filterString() {
    const f = state.filters;
    return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) blur(${f.blur}px) grayscale(${f.grayscale}%)`;
  }

  // Convert a client (mouse/touch) coordinate to natural image coordinates.
  function toNatural(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    return {
      x: (clientX - r.left) / state.scale,
      y: (clientY - r.top) / state.scale,
    };
  }

  /* --------------------------------------------------------------- history */
  function serialize() {
    return JSON.stringify({ objects: state.objects, filters: state.filters });
  }
  function deserialize(str) {
    const data = JSON.parse(str);
    state.objects = data.objects;
    state.filters = data.filters;
    applyFilters();
    syncFilterInputs();
    renderAll();
    if (!state.objects.some((o) => o.id === state.selectedId)) select(null);
    else refreshPanel();
  }
  function resetHistory() {
    history.past = [];
    history.future = [];
    history.current = serialize();
    updateHistoryButtons();
  }
  function commit() {
    if (history.current !== null) history.past.push(history.current);
    if (history.past.length > 100) history.past.shift();
    history.future = [];
    history.current = serialize();
    updateHistoryButtons();
  }
  function undo() {
    if (!history.past.length) return;
    history.future.push(history.current);
    history.current = history.past.pop();
    deserialize(history.current);
    updateHistoryButtons();
  }
  function redo() {
    if (!history.future.length) return;
    history.past.push(history.current);
    history.current = history.future.pop();
    deserialize(history.current);
    updateHistoryButtons();
  }
  function updateHistoryButtons() {
    $('#undoBtn').disabled = history.past.length === 0;
    $('#redoBtn').disabled = history.future.length === 0;
  }

  /* --------------------------------------------------------- image loading */
  function loadImageFromSrc(src, name) {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.naturalW = img.naturalWidth;
      state.naturalH = img.naturalHeight;
      baseImage.src = src;
      state.objects = [];
      select(null);
      emptyState.classList.add('hidden');
      stage.classList.remove('hidden');
      $('#exportBtn').disabled = false;
      fileNameEl.textContent = name || 'imagen';
      fitStage();
      resetFilters(true);
      resetHistory();
    };
    img.src = src;
  }

  function loadImageFromFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => loadImageFromSrc(e.target.result, file.name);
    reader.readAsDataURL(file);
  }

  // Build a sample image on a canvas so the "Ejemplo" button works offline.
  function makeSampleImage() {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 1200, 800);
    g.addColorStop(0, '#6366f1');
    g.addColorStop(0.5, '#8b5cf6');
    g.addColorStop(1, '#ec4899');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1200, 800);
    // soft circles
    const blobs = [[300, 250, 180, 'rgba(255,255,255,0.12)'], [950, 600, 240, 'rgba(255,255,255,0.10)'], [700, 200, 120, 'rgba(0,0,0,0.10)']];
    for (const [x, y, r, col] of blobs) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '600 96px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Imagen de ejemplo', 120, 400);
    ctx.font = '400 40px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Anota, mueve y exporta', 122, 470);
    return c.toDataURL('image/png');
  }

  /* --------------------------------------------------------- stage sizing */
  function fitStage() {
    if (!state.image) return;
    const pad = 48; // matches p-8 on the viewport, roughly
    const availW = viewport.clientWidth - pad;
    const availH = viewport.clientHeight - pad;
    const scale = Math.min(availW / state.naturalW, availH / state.naturalH, 1);
    state.scale = scale > 0 ? scale : 1;
    const w = Math.round(state.naturalW * state.scale);
    const h = Math.round(state.naturalH * state.scale);
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    baseImage.style.width = w + 'px';
    baseImage.style.height = h + 'px';
    renderAll();
  }

  /* --------------------------------------------------------------- filters */
  function applyFilters() {
    baseImage.style.filter = filterString();
  }
  function syncFilterInputs() {
    document.querySelectorAll('[data-filter]').forEach((input) => {
      const key = input.dataset.filter;
      input.value = state.filters[key];
    });
    updateFilterOutputs();
  }
  function updateFilterOutputs() {
    document.querySelectorAll('[data-out]').forEach((out) => {
      const key = out.dataset.out;
      const v = state.filters[key];
      out.textContent = key === 'blur' ? `${v} px` : `${v}%`;
    });
  }
  function resetFilters(silent) {
    state.filters = { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0 };
    applyFilters();
    syncFilterInputs();
    if (!silent) commit();
  }

  /* -------------------------------------------------------- object factory */
  function createObject(type, x, y) {
    const b = state.brush;
    const obj = {
      id: uid(),
      type,
      x,
      y,
      w: 1,
      h: 1,
      color: b.color,
      fill: b.fill,
      strokeWidth: b.strokeWidth,
      opacity: b.opacity,
      fontSize: b.fontSize,
      text: '',
      points: [],
    };
    state.objects.push(obj);
    return obj;
  }

  /* ------------------------------------------------------------- rendering */
  function renderAll() {
    layer.innerHTML = '';
    for (const obj of state.objects) layer.appendChild(buildElement(obj));
    if (state.selectedId) decorateSelected();
  }

  function rerenderOne(obj) {
    const old = layer.querySelector(`[data-id="${obj.id}"]`);
    const el = buildElement(obj);
    if (old) layer.replaceChild(el, old);
    else layer.appendChild(el);
    if (obj.id === state.selectedId) decorateSelected();
  }

  function buildElement(obj) {
    const s = state.scale;
    const el = document.createElement('div');
    el.className = 'obj';
    el.dataset.id = obj.id;
    el.dataset.selectable = 'true';
    el.style.left = obj.x * s + 'px';
    el.style.top = obj.y * s + 'px';
    el.style.opacity = obj.opacity / 100;
    if (obj.id === state.selectedId) el.classList.add('is-selected');

    if (obj.type === 'text') {
      // text: box auto-sizes; geometry width/height not enforced
      const t = document.createElement('div');
      t.className = 'obj-text';
      t.style.color = obj.color;
      t.style.fontSize = obj.fontSize * s + 'px';
      t.style.fontWeight = '600';
      t.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
      t.textContent = obj.text;
      t.setAttribute('spellcheck', 'false');
      el.appendChild(t);
    } else {
      el.style.width = obj.w * s + 'px';
      el.style.height = obj.h * s + 'px';
      if (obj.type === 'rect' || obj.type === 'ellipse') {
        el.style.border = `${Math.max(obj.strokeWidth * s, 1)}px solid ${obj.color}`;
        if (obj.type === 'ellipse') el.style.borderRadius = '50%';
        if (obj.fill) el.style.background = hexToRgba(obj.color, 0.22);
      } else if (obj.type === 'draw' || obj.type === 'arrow') {
        el.appendChild(buildVector(obj));
      }
    }
    return el;
  }

  function buildVector(obj) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    const w = Math.max(obj.w, 1);
    const h = Math.max(obj.h, 1);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.overflow = 'visible';
    svg.style.display = 'block';

    if (obj.type === 'draw') {
      const path = document.createElementNS(svgNS, 'polyline');
      path.setAttribute('points', obj.points.map((p) => `${p.x},${p.y}`).join(' '));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', obj.color);
      path.setAttribute('stroke-width', obj.strokeWidth);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    } else if (obj.type === 'arrow') {
      const [p0, p1] = arrowPoints(obj);
      const d = arrowPath(p0, p1, obj.strokeWidth);
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', obj.color);
      path.setAttribute('stroke-width', obj.strokeWidth);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    }
    return svg;
  }

  // arrow stores two points relative to its box
  function arrowPoints(obj) {
    const pts = obj.points.length === 2 ? obj.points : [{ x: 0, y: 0 }, { x: obj.w, y: obj.h }];
    return [pts[0], pts[1]];
  }
  function arrowPath(p0, p1, sw) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const head = clamp(sw * 3.2, 10, Math.max(12, len * 0.4));
    const ang = Math.PI / 7;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    // rotate the reversed direction by +/- ang, scale by head
    const lx = -ux * cos + uy * sin;
    const ly = -uy * cos - ux * sin;
    const rx = -ux * cos - uy * sin;
    const ry = -uy * cos + ux * sin;
    const h1x = p1.x + lx * head, h1y = p1.y + ly * head;
    const h2x = p1.x + rx * head, h2y = p1.y + ry * head;
    return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} M ${h1x} ${h1y} L ${p1.x} ${p1.y} L ${h2x} ${h2y}`;
  }

  function hexToRgba(hex, a) {
    const m = hex.replace('#', '');
    const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ------------------------------------------------------ selection + handles */
  const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function select(id) {
    state.selectedId = id;
    // toggle .is-selected + handles
    layer.querySelectorAll('.obj').forEach((el) => {
      el.classList.toggle('is-selected', el.dataset.id === id);
      el.querySelectorAll('.handle').forEach((h) => h.remove());
    });
    if (id) decorateSelected();
    refreshPanel();
  }

  function decorateSelected() {
    const obj = selected();
    if (!obj) return;
    const el = layer.querySelector(`[data-id="${obj.id}"]`);
    if (!el) return;
    el.querySelectorAll('.handle').forEach((h) => h.remove());
    if (obj.type === 'text') return; // text is move-only
    for (const dir of HANDLE_DIRS) {
      const h = document.createElement('div');
      h.className = `handle handle-${dir}`;
      h.dataset.dir = dir;
      el.appendChild(h);
    }
  }

  /* -------------------------------------------------- pointer interactions */
  let drag = null; // active gesture descriptor

  stage.addEventListener('pointerdown', onStagePointerDown);

  function onStagePointerDown(e) {
    if (!state.image) return;
    const handle = e.target.closest('.handle');
    const objEl = e.target.closest('.obj');

    // 1) resize handle
    if (handle && state.tool === 'select') {
      e.preventDefault();
      startResize(e, handle.dataset.dir);
      return;
    }

    // 2) select tool → select / move existing object
    if (state.tool === 'select') {
      if (objEl) {
        const obj = state.objects.find((o) => o.id === objEl.dataset.id);
        if (obj) {
          if (state.selectedId !== obj.id) select(obj.id);
          // don't start a move if the user is editing this text
          if (obj.type === 'text' && objEl.querySelector('.obj-text').isContentEditable) return;
          startMove(e, obj);
        }
        return;
      }
      select(null);
      return;
    }

    // 3) creation tools
    e.preventDefault();
    const pt = toNatural(e.clientX, e.clientY);
    if (state.tool === 'text') {
      createText(pt);
      return;
    }
    if (state.tool === 'draw') {
      startDraw(e, pt);
      return;
    }
    // rect / ellipse / arrow → drag to size
    startCreateDrag(e, pt);
  }

  function bindDrag(onMove, onUp) {
    function move(ev) { onMove(ev); }
    function up(ev) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (onUp) onUp(ev);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /* --- move --- */
  function startMove(e, obj) {
    const start = toNatural(e.clientX, e.clientY);
    const ox = obj.x, oy = obj.y;
    let moved = false;
    bindDrag(
      (ev) => {
        const p = toNatural(ev.clientX, ev.clientY);
        obj.x = ox + (p.x - start.x);
        obj.y = oy + (p.y - start.y);
        moved = true;
        positionOnly(obj);
      },
      () => { if (moved) commit(); }
    );
  }

  // Cheap update while dragging: only reposition, keep handles.
  function positionOnly(obj) {
    const el = layer.querySelector(`[data-id="${obj.id}"]`);
    if (!el) return;
    el.style.left = obj.x * state.scale + 'px';
    el.style.top = obj.y * state.scale + 'px';
  }

  /* --- resize --- */
  function startResize(e, dir) {
    const obj = selected();
    if (!obj) return;
    const start = toNatural(e.clientX, e.clientY);
    const o = { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    const minW = obj.w, minH = obj.h;
    let changed = false;
    bindDrag(
      (ev) => {
        const p = toNatural(ev.clientX, ev.clientY);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        let { x, y, w, h } = o;
        if (dir.includes('e')) w = o.w + dx;
        if (dir.includes('s')) h = o.h + dy;
        if (dir.includes('w')) { w = o.w - dx; x = o.x + dx; }
        if (dir.includes('n')) { h = o.h - dy; y = o.y + dy; }
        const MIN = 8;
        if (w < MIN) { if (dir.includes('w')) x = o.x + o.w - MIN; w = MIN; }
        if (h < MIN) { if (dir.includes('n')) y = o.y + o.h - MIN; h = MIN; }
        // scale vector points with the box
        if ((obj.type === 'draw' || obj.type === 'arrow') && obj.points.length) {
          const sx = w / (o.w || 1);
          const sy = h / (o.h || 1);
          if (!obj._basePoints) obj._basePoints = obj.points.map((pp) => ({ ...pp }));
          obj.points = obj._basePoints.map((pp) => ({ x: pp.x * sx, y: pp.y * sy }));
        }
        obj.x = x; obj.y = y; obj.w = w; obj.h = h;
        changed = true;
        rerenderOne(obj);
      },
      () => { delete obj._basePoints; if (changed) commit(); }
    );
  }

  /* --- create by drag (rect / ellipse / arrow) --- */
  function startCreateDrag(e, startPt) {
    const type = state.tool;
    const obj = createObject(type, startPt.x, startPt.y);
    rerenderOne(obj);
    bindDrag(
      (ev) => {
        const p = toNatural(ev.clientX, ev.clientY);
        const x = Math.min(startPt.x, p.x);
        const y = Math.min(startPt.y, p.y);
        const w = Math.abs(p.x - startPt.x);
        const h = Math.abs(p.y - startPt.y);
        obj.x = x; obj.y = y; obj.w = Math.max(w, 1); obj.h = Math.max(h, 1);
        if (type === 'arrow') {
          obj.points = [
            { x: startPt.x - x, y: startPt.y - y },
            { x: p.x - x, y: p.y - y },
          ];
        }
        rerenderOne(obj);
      },
      () => {
        // discard trivially small shapes
        if (obj.w < 6 && obj.h < 6) {
          removeObject(obj.id, true);
        } else {
          setTool('select');
          select(obj.id);
          commit();
        }
      }
    );
  }

  /* --- freehand draw --- */
  function startDraw(e, startPt) {
    const obj = createObject('draw', startPt.x, startPt.y);
    const raw = [{ x: startPt.x, y: startPt.y }];
    bindDrag(
      (ev) => {
        const p = toNatural(ev.clientX, ev.clientY);
        raw.push(p);
        // recompute bbox + relative points live
        const xs = raw.map((r) => r.x), ys = raw.map((r) => r.y);
        const minX = Math.min(...xs), minY = Math.min(...ys);
        obj.x = minX; obj.y = minY;
        obj.w = Math.max(Math.max(...xs) - minX, 1);
        obj.h = Math.max(Math.max(...ys) - minY, 1);
        obj.points = raw.map((r) => ({ x: r.x - minX, y: r.y - minY }));
        rerenderOne(obj);
      },
      () => {
        if (raw.length < 2) { removeObject(obj.id, true); return; }
        setTool('select');
        select(obj.id);
        commit();
      }
    );
  }

  /* --- text --- */
  function createText(pt) {
    const obj = createObject('text', pt.x, pt.y);
    obj.text = '';
    rerenderOne(obj);
    setTool('select');
    select(obj.id);
    editText(obj);
    commit();
  }

  function editText(obj) {
    const el = layer.querySelector(`[data-id="${obj.id}"] .obj-text`);
    if (!el) return;
    el.setAttribute('contenteditable', 'true');
    el.focus();
    // place caret at end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = () => {
      el.removeAttribute('contenteditable');
      const text = el.textContent;
      if (text !== obj.text) { obj.text = text; commit(); }
      if (!obj.text.trim()) removeObject(obj.id, true);
      el.removeEventListener('blur', finish);
    };
    el.addEventListener('blur', finish);
    el.addEventListener('input', () => { obj.text = el.textContent; });
  }

  // double-click a text object to re-edit
  layer.addEventListener('dblclick', (e) => {
    const objEl = e.target.closest('.obj');
    if (!objEl) return;
    const obj = state.objects.find((o) => o.id === objEl.dataset.id);
    if (obj && obj.type === 'text') { select(obj.id); editText(obj); }
  });

  /* ------------------------------------------------------- object commands */
  function removeObject(id, silent) {
    state.objects = state.objects.filter((o) => o.id !== id);
    if (state.selectedId === id) select(null);
    renderAll();
    if (!silent) commit();
  }
  function duplicateSelected() {
    const obj = selected();
    if (!obj) return;
    const copy = JSON.parse(JSON.stringify(obj));
    copy.id = uid();
    copy.x += 16;
    copy.y += 16;
    delete copy._basePoints;
    state.objects.push(copy);
    renderAll();
    select(copy.id);
    commit();
  }
  function reorder(delta) {
    const obj = selected();
    if (!obj) return;
    const i = state.objects.indexOf(obj);
    const j = clamp(i + delta, 0, state.objects.length - 1);
    if (i === j) return;
    state.objects.splice(i, 1);
    state.objects.splice(j, 0, obj);
    renderAll();
    select(obj.id);
    commit();
  }

  /* --------------------------------------------------------- properties UI */
  function refreshPanel() {
    const obj = selected();
    $('#deleteBtn').disabled = !obj;
    $('#duplicateBtn').disabled = !obj;
    if (!obj) {
      elementPanel.classList.add('hidden');
      hintPanel.classList.remove('hidden');
      return;
    }
    elementPanel.classList.remove('hidden');
    hintPanel.classList.add('hidden');

    $('#propColor').value = obj.color;
    $('#propOpacity').value = obj.opacity;
    $('#opacityVal').textContent = obj.opacity + '%';

    const isText = obj.type === 'text';
    const isShape = obj.type === 'rect' || obj.type === 'ellipse';
    fontRow.classList.toggle('hidden', !isText);
    strokeRow.classList.toggle('hidden', isText);
    fillRow.classList.toggle('hidden', !isShape);

    if (isText) {
      $('#propFont').value = obj.fontSize;
      $('#fontVal').textContent = obj.fontSize + ' px';
    } else {
      $('#propStroke').value = obj.strokeWidth;
      $('#strokeVal').textContent = obj.strokeWidth + ' px';
    }
    if (isShape) {
      const on = !!obj.fill;
      $('#propFill').dataset.on = String(on);
      $('#propFill').textContent = on ? 'Sólido' : 'Ninguno';
    }
  }

  // wire property controls: update selected object + remember as brush default
  function bindProp(id, apply, outFn) {
    const input = $(id);
    input.addEventListener('input', () => {
      const obj = selected();
      if (!obj) return;
      apply(obj, input.value);
      if (outFn) outFn(input.value);
      rerenderOne(obj);
    });
    input.addEventListener('change', () => { if (selected()) commit(); });
  }
  bindProp('#propColor', (o, v) => { o.color = v; state.brush.color = v; });
  bindProp('#propStroke', (o, v) => { o.strokeWidth = +v; state.brush.strokeWidth = +v; }, (v) => ($('#strokeVal').textContent = v + ' px'));
  bindProp('#propFont', (o, v) => { o.fontSize = +v; state.brush.fontSize = +v; }, (v) => ($('#fontVal').textContent = v + ' px'));
  bindProp('#propOpacity', (o, v) => { o.opacity = +v; state.brush.opacity = +v; }, (v) => ($('#opacityVal').textContent = v + '%'));

  $('#propFill').addEventListener('click', () => {
    const obj = selected();
    if (!obj) return;
    obj.fill = !(obj.fill);
    state.brush.fill = obj.fill;
    refreshPanel();
    rerenderOne(obj);
    commit();
  });
  $('#forwardBtn').addEventListener('click', () => reorder(+1));
  $('#backwardBtn').addEventListener('click', () => reorder(-1));

  /* ------------------------------------------------------------- toolbar */
  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll('[data-tool]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
    });
    stage.style.cursor = tool === 'select' ? 'default' : 'crosshair';
  }
  document.querySelectorAll('[data-tool]').forEach((b) => {
    b.addEventListener('click', () => setTool(b.dataset.tool));
  });

  $('#deleteBtn').addEventListener('click', () => { if (selected()) removeObject(state.selectedId); });
  $('#duplicateBtn').addEventListener('click', duplicateSelected);

  /* --------------------------------------------------------- top bar wiring */
  const openFile = () => fileInput.click();
  $('#loadBtn').addEventListener('click', openFile);
  $('#loadBtn2').addEventListener('click', openFile);
  fileInput.addEventListener('change', (e) => loadImageFromFile(e.target.files[0]));
  const loadSample = () => loadImageFromSrc(makeSampleImage(), 'ejemplo.png');
  $('#sampleBtn').addEventListener('click', loadSample);
  $('#sampleBtn2').addEventListener('click', loadSample);
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#resetFilters').addEventListener('click', () => resetFilters(false));
  $('#exportBtn').addEventListener('click', exportPNG);

  document.querySelectorAll('[data-filter]').forEach((input) => {
    input.addEventListener('input', () => {
      state.filters[input.dataset.filter] = +input.value;
      applyFilters();
      updateFilterOutputs();
    });
    input.addEventListener('change', () => commit());
  });

  /* ------------------------------------------------------- drag & drop */
  ['dragenter', 'dragover'].forEach((ev) =>
    viewport.addEventListener(ev, (e) => {
      e.preventDefault();
      dropOverlay.classList.remove('hidden');
      dropOverlay.classList.add('flex');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    viewport.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === 'dragleave' && e.relatedTarget && viewport.contains(e.relatedTarget)) return;
      dropOverlay.classList.add('hidden');
      dropOverlay.classList.remove('flex');
    })
  );
  viewport.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) loadImageFromFile(file);
  });

  /* ------------------------------------------------------------ keyboard */
  window.addEventListener('keydown', (e) => {
    const editing = document.activeElement && document.activeElement.isContentEditable;
    if (editing) return;
    const meta = e.ctrlKey || e.metaKey;

    if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selected()) { e.preventDefault(); removeObject(state.selectedId); }
      return;
    }
    if (e.key === 'Escape') { select(null); setTool('select'); return; }

    // nudge selected object with arrow keys
    const obj = selected();
    if (obj && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') obj.x -= step;
      if (e.key === 'ArrowRight') obj.x += step;
      if (e.key === 'ArrowUp') obj.y -= step;
      if (e.key === 'ArrowDown') obj.y += step;
      positionOnly(obj);
      commit();
      return;
    }

    // tool shortcuts
    const map = { v: 'select', t: 'text', r: 'rect', o: 'ellipse', a: 'arrow', d: 'draw' };
    if (!meta && map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
  });

  /* -------------------------------------------------------------- export */
  function exportPNG() {
    if (!state.image) return;
    const c = document.createElement('canvas');
    c.width = state.naturalW;
    c.height = state.naturalH;
    const ctx = c.getContext('2d');
    ctx.filter = filterString();
    ctx.drawImage(state.image, 0, 0, state.naturalW, state.naturalH);
    ctx.filter = 'none';

    for (const obj of state.objects) drawObject(ctx, obj);

    c.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'edicion.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  function drawObject(ctx, obj) {
    ctx.save();
    ctx.globalAlpha = obj.opacity / 100;
    ctx.strokeStyle = obj.color;
    ctx.fillStyle = obj.color;
    ctx.lineWidth = obj.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (obj.type === 'rect') {
      if (obj.fill) { ctx.globalAlpha = (obj.opacity / 100) * 0.22; ctx.fillRect(obj.x, obj.y, obj.w, obj.h); ctx.globalAlpha = obj.opacity / 100; }
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    } else if (obj.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(obj.x + obj.w / 2, obj.y + obj.h / 2, obj.w / 2, obj.h / 2, 0, 0, Math.PI * 2);
      if (obj.fill) { ctx.globalAlpha = (obj.opacity / 100) * 0.22; ctx.fill(); ctx.globalAlpha = obj.opacity / 100; }
      ctx.stroke();
    } else if (obj.type === 'draw') {
      ctx.beginPath();
      obj.points.forEach((p, i) => {
        const x = obj.x + p.x, y = obj.y + p.y;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    } else if (obj.type === 'arrow') {
      const [p0, p1] = arrowPoints(obj);
      const d = arrowPath({ x: obj.x + p0.x, y: obj.y + p0.y }, { x: obj.x + p1.x, y: obj.y + p1.y }, obj.strokeWidth);
      ctx.stroke(new Path2D(d));
    } else if (obj.type === 'text') {
      ctx.font = `600 ${obj.fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      const lines = obj.text.split('\n');
      lines.forEach((line, i) => ctx.fillText(line, obj.x, obj.y + i * obj.fontSize * 1.2));
    }
    ctx.restore();
  }

  /* -------------------------------------------------------------- resize */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitStage, 120);
  });

  /* ----------------------------------------------------------------- init */
  setTool('select');
  refreshPanel();
  syncFilterInputs();
})();
