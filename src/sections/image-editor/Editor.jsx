import { useEffect, useRef, useState } from 'react';
import Toolbar from './Toolbar.jsx';
import ToolOptions from './ToolOptions.jsx';
import { drawShape, hasSize, shapeBBox, mapShape, hitShape } from './shapes.js';
import { extForMime, extFromMime, canvasToBlob } from '../../lib/image.js';
import { triggerDownload } from '../../lib/file.js';

// Manijas de redimensión y su posición relativa (0..1) dentro del recuadro.
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_POS = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5],
  se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
};

// Selección de recorte inicial: un recuadro centrado con margen.
const DEFAULT_SEL = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Rectángulo normalizado (x,y,w,h en fracciones) a partir de dos puntos.
function rectFrom(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

// Caja en px reales normalizada (ancho/alto mínimo de 1px) a partir de bordes.
function boxFromEdges(x0, y0, x1, y1) {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.max(Math.abs(x1 - x0), 1),
    h: Math.max(Math.abs(y1 - y0), 1),
  };
}

// Escala una forma desde su caja original (ob) a la nueva (nb).
function scaleShape(s, ob, nb) {
  const sx = ob.w ? nb.w / ob.w : 0;
  const sy = ob.h ? nb.h / ob.h : 0;
  return mapShape(s, (p) => ({ x: nb.x + (p.x - ob.x) * sx, y: nb.y + (p.y - ob.y) * sy }));
}

/**
 * Editor de imágenes unificado. El recorte y el dibujo son herramientas de un
 * mismo lienzo. Cada estado del historial es un documento { base, shapes }:
 *   base   → canvas raster (imagen + lo ya «aplanado» por recortes)
 *   shapes → formas vectoriales encima, que se pueden seleccionar, mover y
 *            redimensionar hasta que se recorta o se descarga.
 * Recortar aplana las formas y recorta; descargar aplana para exportar.
 */
export default function Editor({ file, url, onChangeImage }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null); // lienzo visible
  const historyRef = useRef([]); // pila de documentos { base, shapes }
  const draftRef = useRef(null); // forma de dibujo en curso
  const cropDragRef = useRef(null); // arrastre de recorte en curso
  const editDragRef = useRef(null); // arrastre de mover/redimensionar en curso
  const liveRef = useRef(null); // forma editada en vivo (espejo de `live`)
  const idRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0); // largo del historial, fuerza re-render
  const [dims, setDims] = useState(null); // { w, h } de la imagen actual

  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#ff3b30');
  const [useFill, setUseFill] = useState(false);
  const [lineWidth, setLineWidth] = useState(6);
  const [sel, setSel] = useState(DEFAULT_SEL); // selección de recorte
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [live, setLive] = useState(null); // forma en edición (mover/escalar)

  const isCrop = tool === 'crop';
  const isSelect = tool === 'select';
  const current = () => historyRef.current[historyRef.current.length - 1];

  // Forma seleccionada (la versión en vivo mientras se arrastra).
  const doc = current();
  const committedSel = doc ? doc.shapes.find((s) => s.id === selectedId) : null;
  const selShape = live && live.id === selectedId ? live : committedSel;

  // Redibuja el lienzo con la base, las formas (con la editada en vivo) y el borrador.
  function render() {
    const view = canvasRef.current;
    const st = current();
    if (!view || !st) return;
    const { base, shapes } = st;
    if (view.width !== base.width || view.height !== base.height) {
      view.width = base.width;
      view.height = base.height;
    }
    const ctx = view.getContext('2d');
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(base, 0, 0);
    const l = liveRef.current;
    for (const s of shapes) drawShape(ctx, l && s.id === l.id ? l : s);
    if (draftRef.current) drawShape(ctx, draftRef.current);
  }

  // Carga la imagen original como primer documento del historial.
  useEffect(() => {
    setReady(false);
    const img = new Image();
    img.onload = () => {
      const base = document.createElement('canvas');
      base.width = img.naturalWidth;
      base.height = img.naturalHeight;
      base.getContext('2d').drawImage(img, 0, 0);
      historyRef.current = [{ base, shapes: [] }];
      setDims({ w: base.width, h: base.height });
      setSel(DEFAULT_SEL);
      setSelectedId(null);
      setStep(1);
      setReady(true);
    };
    img.src = url;
    // El object URL lo administra el contenedor; aquí no lo revocamos.
  }, [url]);

  useEffect(() => {
    if (ready) render();
  }, [step, live, ready]);

  // --- Historial ---
  function pushDoc(nextDoc) {
    historyRef.current = [...historyRef.current, nextDoc];
    setDims({ w: nextDoc.base.width, h: nextDoc.base.height });
    setStep(historyRef.current.length);
  }

  function commitShapes(shapes) {
    pushDoc({ base: current().base, shapes });
  }

  function undo() {
    if (historyRef.current.length <= 1) return;
    historyRef.current = historyRef.current.slice(0, -1);
    const d = current();
    setDims({ w: d.base.width, h: d.base.height });
    setSelectedId(null);
    setStep(historyRef.current.length);
  }

  function reset() {
    if (historyRef.current.length <= 1) return;
    historyRef.current = historyRef.current.slice(0, 1);
    const d = current();
    setDims({ w: d.base.width, h: d.base.height });
    setSelectedId(null);
    setStep(1);
  }

  function onTool(id) {
    setTool(id);
    setSelectedId(null);
    liveRef.current = null;
    setLive(null);
  }

  // Aplana base + formas en un solo canvas (para recortar o exportar).
  function flatten() {
    const { base, shapes } = current();
    const c = document.createElement('canvas');
    c.width = base.width;
    c.height = base.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0);
    for (const s of shapes) drawShape(ctx, s);
    return c;
  }

  // --- Coordenadas en px reales de la imagen a partir de un evento ---
  function coords(e) {
    const view = canvasRef.current;
    const r = view.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (view.width / r.width),
      y: (e.clientY - r.top) * (view.height / r.height),
    };
  }

  // --- Dibujar (herramientas de forma) ---
  function onDrawMove(e) {
    const d = draftRef.current;
    if (!d) return;
    const p = coords(e);
    if (d.type === 'pencil') d.points.push(p);
    else {
      d.ex = p.x;
      d.ey = p.y;
    }
    render();
  }

  function onDrawUp() {
    window.removeEventListener('pointermove', onDrawMove);
    window.removeEventListener('pointerup', onDrawUp);
    const d = draftRef.current;
    draftRef.current = null;
    if (d && hasSize(d)) {
      commitShapes([...current().shapes, d]);
    } else {
      render();
    }
  }

  // --- Mover / redimensionar la forma seleccionada ---
  function onEditMove(e) {
    const d = editDragRef.current;
    if (!d) return;
    const p = coords(e);
    let ns;
    if (d.mode === 'move') {
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      ns = mapShape(d.orig, (q) => ({ x: q.x + dx, y: q.y + dy }));
    } else {
      const b = d.box;
      let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
      if (d.handle.includes('w')) x0 = p.x;
      if (d.handle.includes('e')) x1 = p.x;
      if (d.handle.includes('n')) y0 = p.y;
      if (d.handle.includes('s')) y1 = p.y;
      ns = scaleShape(d.orig, b, boxFromEdges(x0, y0, x1, y1));
    }
    liveRef.current = ns;
    setLive(ns);
  }

  function onEditUp() {
    window.removeEventListener('pointermove', onEditMove);
    window.removeEventListener('pointerup', onEditUp);
    editDragRef.current = null;
    const ns = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (ns) commitShapes(current().shapes.map((s) => (s.id === ns.id ? ns : s)));
  }

  function startMove(shape, e) {
    editDragRef.current = { mode: 'move', orig: shape, start: coords(e) };
    window.addEventListener('pointermove', onEditMove);
    window.addEventListener('pointerup', onEditUp);
  }

  function startResize(handle, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!selShape) return;
    editDragRef.current = { mode: 'resize', handle, orig: selShape, box: shapeBBox(selShape) };
    window.addEventListener('pointermove', onEditMove);
    window.addEventListener('pointerup', onEditUp);
  }

  // --- Pointer sobre el lienzo (dibujar o seleccionar según la herramienta) ---
  function onCanvasDown(e) {
    if (!ready || isCrop) return;
    e.preventDefault();

    if (isSelect) {
      const p = coords(e);
      const shapes = current().shapes;
      let hit = null;
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (hitShape(shapes[i], p)) {
          hit = shapes[i];
          break;
        }
      }
      if (hit) {
        setSelectedId(hit.id);
        startMove(hit, e);
      } else {
        setSelectedId(null);
      }
      return;
    }

    const p = coords(e);
    const base = { id: ++idRef.current, type: tool, stroke: color, fill: color, useFill, lineWidth };
    draftRef.current =
      tool === 'pencil' ? { ...base, points: [p] } : { ...base, sx: p.x, sy: p.y, ex: p.x, ey: p.y };
    window.addEventListener('pointermove', onDrawMove);
    window.addEventListener('pointerup', onDrawUp);
  }

  // --- Recorte ---
  function fracFromEvent(e) {
    const r = stageRef.current.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top) / r.height),
    };
  }

  function onCropMove(e) {
    const d = cropDragRef.current;
    if (!d) return;
    const f = fracFromEvent(e);
    if (d.mode === 'create') {
      setSel(rectFrom(d.start, f));
    } else if (d.mode === 'move') {
      const dx = f.x - d.start.x;
      const dy = f.y - d.start.y;
      setSel({
        x: Math.max(0, Math.min(d.orig.x + dx, 1 - d.orig.w)),
        y: Math.max(0, Math.min(d.orig.y + dy, 1 - d.orig.h)),
        w: d.orig.w,
        h: d.orig.h,
      });
    } else {
      const { x, y, w, h } = d.orig;
      let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
      if (d.handle.includes('w')) x0 = f.x;
      if (d.handle.includes('e')) x1 = f.x;
      if (d.handle.includes('n')) y0 = f.y;
      if (d.handle.includes('s')) y1 = f.y;
      setSel(rectFrom({ x: x0, y: y0 }, { x: x1, y: y1 }));
    }
  }

  function onCropUp() {
    cropDragRef.current = null;
    window.removeEventListener('pointermove', onCropMove);
    window.removeEventListener('pointerup', onCropUp);
  }

  function startCropDrag(mode, handle, e) {
    e.preventDefault();
    if (mode !== 'create') e.stopPropagation();
    cropDragRef.current = { mode, handle, start: fracFromEvent(e), orig: sel };
    window.addEventListener('pointermove', onCropMove);
    window.addEventListener('pointerup', onCropUp);
  }

  const cropW = dims ? Math.round(sel.w * dims.w) : 0;
  const cropH = dims ? Math.round(sel.h * dims.h) : 0;
  const hasArea = cropW >= 1 && cropH >= 1;

  function applyCrop() {
    if (!dims || !hasArea) return;
    setBusy(true);
    try {
      const flat = flatten();
      const sx = Math.round(sel.x * dims.w);
      const sy = Math.round(sel.y * dims.h);
      const base = document.createElement('canvas');
      base.width = cropW;
      base.height = cropH;
      base.getContext('2d').drawImage(flat, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
      setSelectedId(null);
      pushDoc({ base, shapes: [] });
      setSel(DEFAULT_SEL);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!current()) return;
    setBusy(true);
    try {
      const src = flatten();
      const type = extForMime[file.type] ? file.type : 'image/png';
      const out = document.createElement('canvas');
      out.width = src.width;
      out.height = src.height;
      const ctx = out.getContext('2d');
      if (type === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, out.width, out.height);
      }
      ctx.drawImage(src, 0, 0);
      const quality = type === 'image/jpeg' || type === 'image/webp' ? 0.92 : undefined;
      const blob = await canvasToBlob(out, type, quality);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      triggerDownload(blob, `${baseName}-editada.${extFromMime(type)}`);
    } finally {
      setBusy(false);
    }
  }

  const box = (v) => `${v * 100}%`;
  const selBox = selShape && dims ? shapeBBox(selShape) : null;
  const showSelection = isSelect && ready && selBox;
  const canvasCursor = isCrop ? 'default' : isSelect ? 'default' : 'crosshair';

  return (
    <div className="img-editor">
      <Toolbar
        tool={tool}
        onTool={onTool}
        canUndo={step > 1}
        onUndo={undo}
        onReset={reset}
        onChangeImage={onChangeImage}
        onDownload={download}
        ready={ready}
        busy={busy}
      />

      <div className="editor-stage-wrap">
        <div className="editor-stage" ref={stageRef}>
          <canvas
            ref={canvasRef}
            className="editor-canvas"
            onPointerDown={onCanvasDown}
            style={{ cursor: canvasCursor }}
          />

          {isCrop && ready && (
            <>
              <div className="crop-overlay" onPointerDown={(e) => startCropDrag('create', null, e)} />
              <div
                className="crop-sel"
                style={{ left: box(sel.x), top: box(sel.y), width: box(sel.w), height: box(sel.h) }}
                onPointerDown={(e) => startCropDrag('move', null, e)}
              >
                {HANDLES.map((h) => (
                  <span
                    key={h}
                    className={`crop-handle ${h}`}
                    style={{ left: box(HANDLE_POS[h][0]), top: box(HANDLE_POS[h][1]) }}
                    onPointerDown={(e) => startCropDrag('resize', h, e)}
                  />
                ))}
              </div>
            </>
          )}

          {showSelection && (
            <div
              className="shape-sel"
              style={{
                left: box(selBox.x / dims.w),
                top: box(selBox.y / dims.h),
                width: box(selBox.w / dims.w),
                height: box(selBox.h / dims.h),
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                startMove(selShape, e);
              }}
            >
              {HANDLES.map((h) => (
                <span
                  key={h}
                  className={`crop-handle ${h}`}
                  style={{ left: box(HANDLE_POS[h][0]), top: box(HANDLE_POS[h][1]) }}
                  onPointerDown={(e) => startResize(h, e)}
                />
              ))}
            </div>
          )}

          {!ready && <div className="editor-loading">Cargando imagen…</div>}
        </div>
      </div>

      <ToolOptions
        tool={tool}
        hasSelection={!!selShape}
        color={color}
        onColor={setColor}
        lineWidth={lineWidth}
        onLineWidth={setLineWidth}
        useFill={useFill}
        onUseFill={setUseFill}
        cropW={cropW}
        cropH={cropH}
        hasArea={hasArea}
        onApplyCrop={applyCrop}
        onFullSelection={() => setSel({ x: 0, y: 0, w: 1, h: 1 })}
        busy={busy}
      />

      {dims && (
        <div className="editor-meta">
          Imagen actual: {dims.w} × {dims.h} px
        </div>
      )}
    </div>
  );
}
