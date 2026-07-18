import { useRef, useState } from 'react';
import { extForMime, extFromMime, canvasToBlob } from '../../../../lib/image.js';
import { triggerDownload } from '../../../../lib/file.js';

// Manijas de redimensión y su posición relativa (0..1) dentro de la selección.
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_POS = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5],
  se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
};

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

export default function CropTool({ file, url }) {
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const [nat, setNat] = useState(null); // { w, h } en px reales
  const [sel, setSel] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }); // fracciones
  const [busy, setBusy] = useState(false);

  function fracFromEvent(e) {
    const r = stageRef.current.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top) / r.height),
    };
  }

  function onMove(e) {
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

  function onUp() {
    dragRef.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }

  function startDrag(mode, handle, e) {
    e.preventDefault();
    if (mode !== 'create') e.stopPropagation();
    dragRef.current = { mode, handle, start: fracFromEvent(e), orig: sel };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const cropW = nat ? Math.round(sel.w * nat.w) : 0;
  const cropH = nat ? Math.round(sel.h * nat.h) : 0;
  const hasArea = cropW >= 1 && cropH >= 1;

  async function apply() {
    const img = imgRef.current;
    if (!img || !nat || !hasArea) return;
    setBusy(true);
    try {
      const sx = Math.round(sel.x * nat.w);
      const sy = Math.round(sel.y * nat.h);
      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');

      // Conservamos el formato original si es soportado; si no, PNG.
      const type = extForMime[file.type] ? file.type : 'image/png';
      if (type === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cropW, cropH);
      }
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

      const quality = type === 'image/jpeg' || type === 'image/webp' ? 0.92 : undefined;
      const blob = await canvasToBlob(canvas, type, quality);
      const base = file.name.replace(/\.[^.]+$/, '');
      triggerDownload(blob, `${base}-recortada.${extFromMime(type)}`);
    } finally {
      setBusy(false);
    }
  }

  const box = (v) => `${v * 100}%`;

  return (
    <div className="crop-tool">
      <div className="crop-stage" ref={stageRef}>
        <img
          ref={imgRef}
          src={url}
          alt=""
          draggable={false}
          className="crop-img"
          onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
        />
        <div className="crop-overlay" onPointerDown={(e) => startDrag('create', null, e)} />
        <div
          className="crop-sel"
          style={{ left: box(sel.x), top: box(sel.y), width: box(sel.w), height: box(sel.h) }}
          onPointerDown={(e) => startDrag('move', null, e)}
        >
          {HANDLES.map((h) => (
            <span
              key={h}
              className={`crop-handle ${h}`}
              style={{ left: box(HANDLE_POS[h][0]), top: box(HANDLE_POS[h][1]) }}
              onPointerDown={(e) => startDrag('resize', h, e)}
            />
          ))}
        </div>
      </div>

      <div className="crop-info">
        {nat ? `Selección: ${cropW} × ${cropH} px  ·  Original: ${nat.w} × ${nat.h} px` : 'Cargando imagen…'}
      </div>

      <div className="controls">
        <button onClick={() => setSel({ x: 0, y: 0, w: 1, h: 1 })}>Seleccionar todo</button>
        <button onClick={apply} disabled={busy || !hasArea}>
          {busy ? 'Recortando…' : 'Recortar y descargar'}
        </button>
      </div>
    </div>
  );
}
