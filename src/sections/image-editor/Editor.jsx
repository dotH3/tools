import { useEffect, useRef, useState } from 'react';
import Toolbar from './Toolbar.jsx';
import ToolOptions from './ToolOptions.jsx';
import { drawShape, hasSize } from './shapes.js';
import { extForMime, extFromMime, canvasToBlob } from '../../lib/image.js';
import { triggerDownload } from '../../lib/file.js';

// Manijas de redimensión del recorte y su posición relativa (0..1).
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

/**
 * Editor de imágenes unificado. El recorte y el dibujo son herramientas de un
 * mismo lienzo: comparten el historial (deshacer / restablecer) y una sola
 * descarga. Cada recorte o trazo se «cuece» en un nuevo estado del historial,
 * por lo que deshacer funciona igual para todo.
 */
export default function Editor({ file, url, onChangeImage }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null); // lienzo visible
  const historyRef = useRef([]); // pila de canvas (cada uno a resolución real)
  const draftRef = useRef(null); // forma de dibujo en curso
  const dragRef = useRef(null); // arrastre de recorte en curso

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0); // largo del historial, fuerza re-render
  const [dims, setDims] = useState(null); // { w, h } de la imagen actual

  const [tool, setTool] = useState('crop');
  const [color, setColor] = useState('#ff3b30');
  const [useFill, setUseFill] = useState(false);
  const [lineWidth, setLineWidth] = useState(6);
  const [sel, setSel] = useState(DEFAULT_SEL);
  const [busy, setBusy] = useState(false);

  const isCrop = tool === 'crop';
  const current = () => historyRef.current[historyRef.current.length - 1];

  // Redibuja el lienzo visible con el estado actual + el borrador en curso.
  function render() {
    const view = canvasRef.current;
    const src = current();
    if (!view || !src) return;
    if (view.width !== src.width || view.height !== src.height) {
      view.width = src.width;
      view.height = src.height;
    }
    const ctx = view.getContext('2d');
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(src, 0, 0);
    if (draftRef.current) drawShape(ctx, draftRef.current);
  }

  // Carga la imagen original como primer estado del historial.
  useEffect(() => {
    setReady(false);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      historyRef.current = [c];
      setDims({ w: c.width, h: c.height });
      setSel(DEFAULT_SEL);
      setStep(1);
      setReady(true);
    };
    img.src = url;
    // El object URL lo administra el contenedor; aquí no lo revocamos.
  }, [url]);

  useEffect(() => {
    if (ready) render();
  }, [step, ready]);

  // Añade un estado nuevo al historial (tras recortar o dibujar).
  function pushCanvas(c) {
    historyRef.current = [...historyRef.current, c];
    setDims({ w: c.width, h: c.height });
    setStep(historyRef.current.length);
  }

  function undo() {
    if (historyRef.current.length <= 1) return;
    historyRef.current = historyRef.current.slice(0, -1);
    const c = current();
    setDims({ w: c.width, h: c.height });
    setStep(historyRef.current.length);
  }

  function reset() {
    if (historyRef.current.length <= 1) return;
    historyRef.current = historyRef.current.slice(0, 1);
    const c = current();
    setDims({ w: c.width, h: c.height });
    setStep(1);
  }

  // --- Dibujo (herramientas que no son recorte) ---
  function coords(e) {
    const view = canvasRef.current;
    const r = view.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (view.width / r.width),
      y: (e.clientY - r.top) * (view.height / r.height),
    };
  }

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
      const src = current();
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(src, 0, 0);
      drawShape(ctx, d);
      pushCanvas(c);
    } else {
      render();
    }
  }

  function onCanvasDown(e) {
    if (!ready || isCrop) return;
    e.preventDefault();
    const p = coords(e);
    const base = { type: tool, stroke: color, fill: color, useFill, lineWidth };
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
    const d = dragRef.current;
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
    dragRef.current = null;
    window.removeEventListener('pointermove', onCropMove);
    window.removeEventListener('pointerup', onCropUp);
  }

  function startCropDrag(mode, handle, e) {
    e.preventDefault();
    if (mode !== 'create') e.stopPropagation();
    dragRef.current = { mode, handle, start: fracFromEvent(e), orig: sel };
    window.addEventListener('pointermove', onCropMove);
    window.addEventListener('pointerup', onCropUp);
  }

  const cropW = dims ? Math.round(sel.w * dims.w) : 0;
  const cropH = dims ? Math.round(sel.h * dims.h) : 0;
  const hasArea = cropW >= 1 && cropH >= 1;

  function applyCrop() {
    const src = current();
    if (!src || !dims || !hasArea) return;
    setBusy(true);
    try {
      const sx = Math.round(sel.x * dims.w);
      const sy = Math.round(sel.y * dims.h);
      const c = document.createElement('canvas');
      c.width = cropW;
      c.height = cropH;
      c.getContext('2d').drawImage(src, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
      pushCanvas(c);
      setSel(DEFAULT_SEL);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const src = current();
    if (!src) return;
    setBusy(true);
    try {
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

  return (
    <div className="img-editor">
      <Toolbar
        tool={tool}
        onTool={setTool}
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
            style={{ cursor: isCrop ? 'default' : 'crosshair' }}
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

          {!ready && <div className="editor-loading">Cargando imagen…</div>}
        </div>
      </div>

      <ToolOptions
        tool={tool}
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
