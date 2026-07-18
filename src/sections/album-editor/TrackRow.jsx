import { fmtSize } from '../../lib/file.js';

// Una pista dentro del álbum: número, título/artista editables, controles de
// orden y una vista previa del nombre de archivo resultante.
export default function TrackRow({
  track,
  index,
  total,
  previewName,
  onChange,
  onMove,
  onRemove,
  onDownload,
}) {
  return (
    <div className="track-item">
      <div className="track-main">
        <div className="track-order">
          <span className="track-num">{index + 1}</span>
          <div className="track-move">
            <button
              className="mini-btn"
              title="Subir"
              disabled={index === 0}
              onClick={() => onMove(track.id, -1)}
            >
              ↑
            </button>
            <button
              className="mini-btn"
              title="Bajar"
              disabled={index === total - 1}
              onClick={() => onMove(track.id, 1)}
            >
              ↓
            </button>
          </div>
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
