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

// Triángulo de "reproducir".
function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  );
}

// Dos barras de "pausar".
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="4" y="2.5" width="3" height="11" rx="1" />
      <rect x="9" y="2.5" width="3" height="11" rx="1" />
    </svg>
  );
}

// Una pista dentro del álbum: asa para arrastrar, número, título/artista
// editables y una vista previa del nombre de archivo resultante.
export default function TrackRow({
  track,
  index,
  previewName,
  playing,
  dragging,
  dragHandleProps,
  onChange,
  onRemove,
  onDownload,
  onTogglePlay,
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
          <button
            className={`mini-btn play-btn${playing ? ' playing' : ''}`}
            title={playing ? 'Pausar preview' : 'Escuchar preview'}
            aria-label={playing ? 'Pausar preview' : 'Escuchar preview'}
            aria-pressed={playing}
            onClick={() => onTogglePlay(track)}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
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
