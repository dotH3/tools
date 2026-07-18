import { fmtSize } from '../../lib/file.js';

// Ícono de "asa" para arrastrar (seis puntos), como en las listas reordenables.
function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="4" r="1.3" />
      <circle cx="10" cy="4" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="10" cy="12" r="1.3" />
    </svg>
  );
}

// Una pista dentro del álbum: asa para arrastrar, número, título/artista
// editables y una vista previa del nombre de archivo resultante.
export default function TrackRow({
  track,
  index,
  previewName,
  dragging,
  dragHandleProps,
  onChange,
  onRemove,
  onDownload,
}) {
  return (
    <div className={`track-item${dragging ? ' dragging' : ''}`} data-row-id={track.id}>
      <div className="track-main">
        <div className="track-order">
          <button
            className="drag-handle"
            title="Arrastra para reordenar"
            aria-label="Arrastra para reordenar"
            {...dragHandleProps}
          >
            <GripIcon />
          </button>
          <span className="track-num">{index + 1}</span>
        </div>

        <div className="track-fields">
          <input
            className="track-in"
            placeholder="Título"
            value={track.title}
            onChange={(e) => onChange(track.id, { title: e.target.value })}
          />
          <input
            className="track-in"
            placeholder="Artista"
            value={track.artist}
            onChange={(e) => onChange(track.id, { artist: e.target.value })}
          />
        </div>

        <div className="track-actions">
          <button className="mini-btn" title="Descargar pista" onClick={() => onDownload(track)}>
            Descargar
          </button>
          <button
            className="mini-btn danger"
            title="Quitar del álbum"
            onClick={() => onRemove(track.id)}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="track-preview">
        {previewName} · {fmtSize(track.buffer.byteLength)}
      </div>
    </div>
  );
}
