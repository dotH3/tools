import { useEffect, useRef, useState } from 'react';
import { useDragReorder } from './useDragReorder.js';
import TrackRow from './TrackRow.jsx';
import { readTags, writeTags } from './id3.js';
import { renderName, extensionOf, PRESETS } from './template.js';
import { buildZip, dedupeNames } from '../image-converter/zip.js';
import { triggerDownload } from '../../lib/file.js';

const EMPTY_ALBUM = { album: '', albumArtist: '', year: '', genre: '', cover: null };

function isMp3(file) {
  return file.type === 'audio/mpeg' || /\.mp3$/i.test(file.name);
}

// Número de pista a partir del frame TRCK ("3" o "3/12"). Las pistas sin
// número quedan al final, conservando su orden relativo (orden estable).
function trackNumber(value) {
  const n = parseInt(String(value || '').split('/')[0], 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

// Convierte un cover { mime, bytes } en algo con URL para previsualizar.
function coverWithUrl(cover) {
  if (!cover) return null;
  const blob = new Blob([cover.bytes], { type: cover.mime });
  return { ...cover, url: URL.createObjectURL(blob) };
}

export default function AlbumEditor() {
  const [tracks, setTracks] = useState([]);
  const [album, setAlbum] = useState(EMPTY_ALBUM);
  const [template, setTemplate] = useState('{n} - {title}');
  const [renumber, setRenumber] = useState(true);
  const [zipping, setZipping] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const fileRef = useRef(null);
  const coverRef = useRef(null);
  const listRef = useRef(null);
  // Un único <audio> compartido reproduce la preview: así solo suena una pista a
  // la vez y reutilizamos un object URL que liberamos al cambiar de pista.
  const audioRef = useRef(null);
  const previewUrlRef = useRef(null);
  const { draggingId, dragHandleProps } = useDragReorder(listRef, tracks, setTracks);

  // Liberamos el object URL de la carátula al reemplazarla o al desmontar.
  useEffect(() => {
    return () => {
      if (album.cover && album.cover.url) URL.revokeObjectURL(album.cover.url);
    };
  }, [album.cover]);

  // Al desmontar, liberamos el object URL de la preview en curso.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // Detiene la preview y libera su object URL. Se usa al terminar la pista, al
  // quitarla de la lista o al vaciar el álbum.
  function stopPreview() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPlayingId(null);
  }

  // Reproduce/pausa la preview de una pista. Si ya sonaba, la pausa; si no,
  // apunta el <audio> compartido al MP3 original y lo reproduce.
  function togglePreview(track) {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(track.file);
    audio.src = previewUrlRef.current;
    setPlayingId(track.id);
    audio.play().catch(() => setPlayingId(null));
  }

  const hasTracks = tracks.length > 0;

  async function addFiles(fileList) {
    const files = Array.from(fileList).filter(isMp3);
    if (!files.length) return;

    const loaded = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const tags = readTags(buffer);
      loaded.push({
        id: crypto.randomUUID(),
        file,
        buffer,
        ext: extensionOf(file.name),
        title: tags.title || file.name.replace(/\.[^.]+$/, ''),
        artist: tags.artist || '',
        trackNo: tags.track,
        parsed: tags,
      });
    }

    // Ordenamos el lote por su número de pista embebido para respetar el orden
    // original del álbum (el navegador entrega los archivos en orden alfabético,
    // no en el del disco). Los lotes posteriores se anexan al final, de modo que
    // los bonus tracks añadidos después quedan donde el usuario los pone.
    loaded.sort((a, b) => trackNumber(a.trackNo) - trackNumber(b.trackNo));

    setTracks((prev) => [...prev, ...loaded]);

    // Al cargar el primer lote, precargamos los datos del álbum a partir de la
    // primera pista para ahorrar tecleo (el usuario puede corregirlos).
    setAlbum((prev) => {
      if (prev.album || prev.albumArtist || prev.cover) return prev;
      const first = loaded[0].parsed;
      return {
        album: first.album || '',
        albumArtist: first.albumArtist || first.artist || '',
        year: first.year || '',
        genre: first.genre || '',
        cover: coverWithUrl(first.cover),
      };
    });
  }

  function updateTrack(id, patch) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTrack(id) {
    if (playingId === id) stopPreview();
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }

  function setAlbumField(patch) {
    setAlbum((prev) => ({ ...prev, ...patch }));
  }

  async function loadCover(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (album.cover && album.cover.url) URL.revokeObjectURL(album.cover.url);
    setAlbumField({ cover: coverWithUrl({ mime: file.type, bytes }) });
  }

  // Etiquetas finales de una pista, combinando datos de pista y de álbum.
  function tagsFor(track, index) {
    const number = renumber ? index + 1 : track.trackNo || index + 1;
    return {
      title: track.title,
      artist: track.artist || album.albumArtist,
      album: album.album,
      albumArtist: album.albumArtist,
      year: album.year,
      genre: album.genre,
      track: `${number}/${tracks.length}`,
      cover: album.cover,
    };
  }

  function nameFor(track, index) {
    const num = renumber ? index + 1 : parseInt(track.trackNo, 10) || index + 1;
    return renderName(template, {
      n: String(num).padStart(2, '0'),
      track: String(num),
      title: track.title,
      artist: track.artist || album.albumArtist,
      albumArtist: album.albumArtist,
      album: album.album,
      year: album.year,
      genre: album.genre,
      ext: track.ext,
    });
  }

  function downloadTrack(track) {
    const index = tracks.findIndex((t) => t.id === track.id);
    const out = writeTags(track.buffer, tagsFor(track, index));
    triggerDownload(new Blob([out], { type: 'audio/mpeg' }), nameFor(track, index));
  }

  async function downloadAlbumZip() {
    if (!hasTracks) return;
    setZipping(true);
    try {
      const entries = tracks.map((track, index) => ({
        name: nameFor(track, index),
        blob: new Blob([writeTags(track.buffer, tagsFor(track, index))], { type: 'audio/mpeg' }),
      }));
      const zipBlob = await buildZip(dedupeNames(entries));
      triggerDownload(zipBlob, `${album.album || 'album'}.zip`);
    } finally {
      setZipping(false);
    }
  }

  function clearAll() {
    stopPreview();
    if (album.cover && album.cover.url) URL.revokeObjectURL(album.cover.url);
    setTracks([]);
    setAlbum(EMPTY_ALBUM);
  }

  return (
    <>
      <p>Todo se procesa en tu navegador. Ningún archivo se sube a internet. Solo MP3 (ID3v2).</p>

      {!hasTracks ? (
        <div className="drop" onClick={() => fileRef.current.click()}>
          Arrastra los MP3 del álbum aquí o haz clic para seleccionarlos
          <input
            type="file"
            ref={fileRef}
            accept="audio/mpeg,.mp3"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <>
          {/* Carátula + datos del álbum */}
          <div className="album-top">
            <div className="album-cover">
              <div className="cover-box" onClick={() => coverRef.current.click()}>
                {album.cover ? (
                  <img src={album.cover.url} alt="Carátula" />
                ) : (
                  <span>Añadir carátula</span>
                )}
              </div>
              <input
                type="file"
                ref={coverRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  loadCover(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="album-fields">
              <label className="field field-wide">
                Álbum
                <input
                  value={album.album}
                  onChange={(e) => setAlbumField({ album: e.target.value })}
                />
              </label>
              <label className="field">
                Artista del álbum
                <input
                  value={album.albumArtist}
                  onChange={(e) => setAlbumField({ albumArtist: e.target.value })}
                />
              </label>
              <label className="field">
                Año
                <input
                  value={album.year}
                  onChange={(e) => setAlbumField({ year: e.target.value })}
                />
              </label>
              <label className="field">
                Género
                <input
                  value={album.genre}
                  onChange={(e) => setAlbumField({ genre: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* Formato del nombre de archivo */}
          <div className="template-bar">
            <div className="template-row">
              <input
                className="template-input"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
              {PRESETS.map((p) => (
                <button key={p.value} className="preset-btn" onClick={() => setTemplate(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="template-hint">
              Tokens: <code>{'{n}'}</code> <code>{'{track}'}</code> <code>{'{title}'}</code>{' '}
              <code>{'{artist}'}</code> <code>{'{album}'}</code> <code>{'{albumartist}'}</code>{' '}
              <code>{'{year}'}</code> <code>{'{genre}'}</code>
              <label className="renumber">
                <input
                  type="checkbox"
                  checked={renumber}
                  onChange={(e) => setRenumber(e.target.checked)}
                />
                Renumerar pistas según el orden
              </label>
            </div>
          </div>

          {/* Lista de pistas */}
          <div className="track-list" ref={listRef}>
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                previewName={nameFor(track, index)}
                playing={playingId === track.id}
                dragging={draggingId === track.id}
                dragHandleProps={dragHandleProps(track.id)}
                onChange={updateTrack}
                onRemove={removeTrack}
                onDownload={downloadTrack}
                onTogglePlay={togglePreview}
              />
            ))}
          </div>

          {/* Acciones */}
          <div className="album-actions">
            <button className="mini-btn" onClick={() => fileRef.current.click()}>
              Añadir pistas
            </button>
            <input
              type="file"
              ref={fileRef}
              accept="audio/mpeg,.mp3"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button className="mini-btn" onClick={clearAll}>
              Vaciar
            </button>
            <button className="primary-btn" disabled={zipping} onClick={downloadAlbumZip}>
              {zipping ? 'Generando ZIP…' : 'Descargar álbum (ZIP)'}
            </button>
          </div>

          {/* Reproductor compartido para la preview; oculto y sin controles. */}
          <audio ref={audioRef} onEnded={stopPreview} className="hidden" />
        </>
      )}
    </>
  );
}
