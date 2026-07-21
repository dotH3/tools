import { Move, Crop, Undo2, Trash2, ImagePlus, Download } from 'lucide-react';
import { DRAW_TOOLS } from './shapes.js';

/**
 * Barra superior del editor: a la izquierda las herramientas (mover, recortar
 * y dibujar, todas juntas); a la derecha las acciones sobre la imagen
 * (deshacer, restablecer, cambiar imagen y descargar).
 */
export default function Toolbar({
  tool,
  onTool,
  canUndo,
  onUndo,
  onReset,
  onChangeImage,
  onDownload,
  ready,
  busy,
}) {
  return (
    <div className="editor-toolbar">
      <div className="tool-group">
        <button
          className={`icon-btn${tool === 'select' ? ' active' : ''}`}
          onClick={() => onTool('select')}
          disabled={!ready}
          title="Mover / redimensionar"
          aria-label="Mover / redimensionar"
        >
          <Move size={20} />
        </button>
        <button
          className={`icon-btn${tool === 'crop' ? ' active' : ''}`}
          onClick={() => onTool('crop')}
          disabled={!ready}
          title="Recortar"
          aria-label="Recortar"
        >
          <Crop size={20} />
        </button>
        <span className="tool-divider" />
        {DRAW_TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`icon-btn${id === tool ? ' active' : ''}`}
            onClick={() => onTool(id)}
            disabled={!ready}
            title={label}
            aria-label={label}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>

      <div className="tool-group">
        <button
          className="icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Deshacer"
          aria-label="Deshacer"
        >
          <Undo2 size={20} />
        </button>
        <button
          className="icon-btn"
          onClick={onReset}
          disabled={!canUndo}
          title="Volver al original"
          aria-label="Volver al original"
        >
          <Trash2 size={20} />
        </button>
        <span className="tool-divider" />
        <button
          className="icon-btn"
          onClick={onChangeImage}
          title="Cambiar imagen"
          aria-label="Cambiar imagen"
        >
          <ImagePlus size={20} />
        </button>
        <button className="editor-download" onClick={onDownload} disabled={!ready || busy}>
          <Download size={16} />
          {busy ? 'Guardando…' : 'Descargar'}
        </button>
      </div>
    </div>
  );
}
