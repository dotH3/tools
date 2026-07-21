import { Pencil, Square, Circle, Minus, ArrowUpRight } from 'lucide-react';

// Herramientas de dibujo (además del recorte, que vive en el editor).
export const DRAW_TOOLS = [
  { id: 'pencil', label: 'Lápiz', Icon: Pencil },
  { id: 'rect', label: 'Rectángulo', Icon: Square },
  { id: 'ellipse', label: 'Elipse', Icon: Circle },
  { id: 'line', label: 'Línea', Icon: Minus },
  { id: 'arrow', label: 'Flecha', Icon: ArrowUpRight },
];

// Herramientas que admiten relleno.
export const FILLABLE = new Set(['rect', 'ellipse']);

// Paleta estilo WhatsApp: blanco, negro, gris y colores vivos.
export const PALETTE = [
  '#ffffff', '#000000', '#8e8e93',
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
  '#00c7be', '#007aff', '#af52de', '#ff2d55',
];

export const WIDTHS = [2, 6, 12, 22];

// Dibuja una forma en el contexto usando coordenadas en px reales de la imagen.
export function drawShape(ctx, s) {
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

// ¿La forma tiene tamaño suficiente para conservarla?
export function hasSize(s) {
  if (s.type === 'pencil') return s.points.length >= 1;
  return Math.abs(s.ex - s.sx) > 2 || Math.abs(s.ey - s.sy) > 2;
}
