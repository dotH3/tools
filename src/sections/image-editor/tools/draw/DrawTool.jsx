import { useEffect, useRef, useState } from 'react';
import { Pencil, Square, Circle, Minus, ArrowUpRight, PaintBucket, Undo2, Trash2, Download } from 'lucide-react';
import { extForMime, extFromMime, canvasToBlob } from '../../../../lib/image.js';
import { triggerDownload } from '../../../../lib/file.js';

const TOOLS = [
  { id: 'pencil', label: 'Lápiz', Icon: Pencil },
  { id: 'rect', label: 'Rectángulo', Icon: Square },
  { id: 'ellipse', label: 'Elipse', Icon: Circle },
  { id: 'line', label: 'Línea', Icon: Minus },
  { id: 'arrow', label: 'Flecha', Icon: ArrowUpRight },
];

const FILLABLE = new Set(['rect', 'ellipse']);

// Paleta estilo WhatsApp: blanco, negro, gris y colores vivos.
const PALETTE = [
  '#ffffff', '#000000', '#8e8e93',
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
  '#00c7be', '#007aff', '#af52de', '#ff2d55',
];

const WIDTHS = [2, 6, 12, 22];

// Dibuja una forma en el contexto usando coordenadas en px reales de la imagen.
function drawShape(ctx, s) {
  ctx.lineWidth = s.lineWidth;
  ctx.strokeStyle = s.stroke;
  ctx.fillStyle = s.fill;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.type === 'pencil') {
    if (s.points.length < 2) {
      const p = s.points[0];
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = s.stroke;
        ctx.fill();
      }
      return;
    }
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.stroke();
    return;
  }

  const { sx, sy, ex, ey } = s;
  if (s.type === 'rect') {
    if (s.useFill) ctx.fillRect(sx, sy, ex - sx, ey - sy);
    if (s.lineWidth > 0) ctx.strokeRect(sx, sy, ex - sx, ey - sy);
  } else if (s.type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse((sx + ex) / 2, (sy + ey) / 2, Math.abs(ex - sx) / 2, Math.abs(ey - sy) / 2, 0, 0, Math.PI * 2);
    if (s.useFill) ctx.fill();
    if (s.lineWidth > 0) ctx.stroke();
  } else if (s.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  } else if (s.type === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const ang = Math.atan2(ey - sy, ex - sx);
    const head = Math.max(s.lineWidth * 3, 12);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - head * Math.cos(ang - Math.PI / 6), ey - head * Math.sin(ang - Math.PI / 6));
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - head * Math.cos(ang + Math.PI / 6), ey - head * Math.sin(ang + Math.PI / 6));
    ctx.stroke();
  }
}

function hasSize(s) {
  if (s.type === 'pencil') return s.points.length >= 1;
  return Math.abs(s.ex - s.sx) > 2 || Math.abs(s.ey - s.sy) > 2;
}

export default function DrawTool({ file, url }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const shapesRef = useRef([]);
  const draftRef = useRef(null);
  const [shapes, setShapes] = useState([]);
  const [ready, setReady] = useState(false);

  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#ff3b30');
  const [useFill, setUseFill] = useState(false);
  const [lineWidth, setLineWidth] = useState(6);

  // Redibuja el fondo (imagen) y todas las formas + el borrador en curso.
  function render() {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const s of shapesRef.current) drawShape(ctx, s);
    if (draftRef.current) drawShape(ctx, draftRef.current);
  }

  useEffect(() => {
    shapesRef.current = shapes;
    render();
  }, [shapes]);

  // Carga la imagen de fondo y ajusta el canvas a su resolución real.
  useEffect(() => {
    setReady(false);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const c = canvasRef.current;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      setReady(true);
      render();
    };
    img.src = url;
    // El object URL lo administra el editor; no lo revocamos aquí.
  }, [url]);

  function coords(e) {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
  }

  function onMove(e) {
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

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    const d = draftRef.current;
    draftRef.current = null;
    if (d && hasSize(d)) setShapes((prev) => [...prev, d]);
    else render();
  }

  function onDown(e) {
    if (!ready) return;
    e.preventDefault();
    const p = coords(e);
    const base = { type: tool, stroke: color, fill: color, useFill, lineWidth };
    draftRef.current =
      tool === 'pencil' ? { ...base, points: [p] } : { ...base, sx: p.x, sy: p.y, ex: p.x, ey: p.y };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  async function download() {
    const c = canvasRef.current;
    if (!c) return;
    const type = extForMime[file.type] ? file.type : 'image/png';
    const out = document.createElement('canvas');
    out.width = c.width;
    out.height = c.height;
    const ctx = out.getContext('2d');
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.drawImage(c, 0, 0);
    const quality = type === 'image/jpeg' || type === 'image/webp' ? 0.92 : undefined;
    const blob = await canvasToBlob(out, type, quality);
    const base = file.name.replace(/\.[^.]+$/, '');
    triggerDownload(blob, `${base}-editada.${extFromMime(type)}`);
  }

  const supportsFill = FILLABLE.has(tool);
  const customActive = !PALETTE.includes(color.toLowerCase());

  return (
    <div className="draw-tool">
      <div className="draw-toolbar">
        <div className="tool-group">
          {TOOLS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`icon-btn${id === tool ? ' active' : ''}`}
              onClick={() => setTool(id)}
              title={label}
              aria-label={label}
            >
              <Icon size={20} />
            </button>
          ))}
        </div>

        <div className="tool-group">
          <button
            className={`icon-btn${useFill ? ' active' : ''}`}
            onClick={() => setUseFill((v) => !v)}
            disabled={!supportsFill}
            title="Relleno"
            aria-label="Relleno"
          >
            <PaintBucket size={20} />
          </button>
          <span className="tool-divider" />
          <button
            className="icon-btn"
            onClick={() => setShapes((prev) => prev.slice(0, -1))}
            disabled={!shapes.length}
            title="Deshacer"
            aria-label="Deshacer"
          >
            <Undo2 size={20} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setShapes([])}
            disabled={!shapes.length}
            title="Borrar dibujos"
            aria-label="Borrar dibujos"
          >
            <Trash2 size={20} />
          </button>
          <button
            className="icon-btn"
            onClick={download}
            disabled={!ready}
            title="Descargar"
            aria-label="Descargar"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="draw-canvas" onPointerDown={onDown} />

      <div className="draw-bottom">
        <div className="palette">
          {PALETTE.map((c) => (
            <button
              key={c}
              className={`swatch${c.toLowerCase() === color.toLowerCase() ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              title={c}
              aria-label={`Color ${c}`}
            />
          ))}
          <label
            className={`swatch swatch-custom${customActive ? ' active' : ''}`}
            title="Color personalizado"
          >
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
        </div>

        <div className="width-dots">
          {WIDTHS.map((w) => {
            const size = Math.min(Math.max(w, 4), 22);
            return (
              <button
                key={w}
                className={`width-dot${w === lineWidth ? ' active' : ''}`}
                onClick={() => setLineWidth(w)}
                title={`${w} px`}
                aria-label={`Grosor ${w} px`}
              >
                <span style={{ width: size, height: size }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
