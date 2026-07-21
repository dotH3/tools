import { PaintBucket } from 'lucide-react';
import { PALETTE, WIDTHS, FILLABLE } from './shapes.js';

/**
 * Panel de opciones contextual: muestra los controles de la herramienta
 * activa debajo del lienzo. Para recortar, el tamaño de la selección y el
 * botón de aplicar; para dibujar, color, grosor y relleno.
 */
export default function ToolOptions({
  tool,
  color,
  onColor,
  lineWidth,
  onLineWidth,
  useFill,
  onUseFill,
  cropW,
  cropH,
  hasArea,
  onApplyCrop,
  onFullSelection,
  busy,
}) {
  if (tool === 'crop') {
    return (
      <div className="tool-options">
        <div className="option-info">
          {hasArea
            ? `Selección: ${cropW} × ${cropH} px`
            : 'Arrastra sobre la imagen para elegir el área'}
        </div>
        <div className="option-actions">
          <button className="ghost-btn" onClick={onFullSelection}>
            Seleccionar todo
          </button>
          <button className="editor-download" onClick={onApplyCrop} disabled={busy || !hasArea}>
            {busy ? 'Recortando…' : 'Aplicar recorte'}
          </button>
        </div>
      </div>
    );
  }

  const supportsFill = FILLABLE.has(tool);
  const customActive = !PALETTE.includes(color.toLowerCase());

  return (
    <div className="tool-options">
      <div className="palette">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`swatch${c.toLowerCase() === color.toLowerCase() ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => onColor(c)}
            title={c}
            aria-label={`Color ${c}`}
          />
        ))}
        <label className={`swatch swatch-custom${customActive ? ' active' : ''}`} title="Color personalizado">
          <input type="color" value={color} onChange={(e) => onColor(e.target.value)} />
        </label>
      </div>

      <div className="option-right">
        <div className="width-dots">
          {WIDTHS.map((w) => {
            const size = Math.min(Math.max(w, 4), 22);
            return (
              <button
                key={w}
                className={`width-dot${w === lineWidth ? ' active' : ''}`}
                onClick={() => onLineWidth(w)}
                title={`${w} px`}
                aria-label={`Grosor ${w} px`}
              >
                <span style={{ width: size, height: size }} />
              </button>
            );
          })}
        </div>

        <button
          className={`icon-btn${useFill ? ' active' : ''}`}
          onClick={() => onUseFill(!useFill)}
          disabled={!supportsFill}
          title="Relleno"
          aria-label="Relleno"
        >
          <PaintBucket size={20} />
        </button>
      </div>
    </div>
  );
}
