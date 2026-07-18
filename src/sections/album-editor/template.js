// Plantillas para renombrar los archivos del álbum.
//
// Tokens disponibles (entre llaves), insensibles a mayúsculas:
//   {n}           número de pista con dos dígitos (01, 02, …)
//   {track}       número de pista tal cual (1, 2, …)
//   {title}       título de la pista
//   {artist}      artista de la pista
//   {albumartist} artista del álbum
//   {album}       nombre del álbum
//   {year}        año
//   {genre}       género

export const PRESETS = [
  { label: 'Nº - Título', value: '{n} - {title}' },
  { label: 'Artista - Título', value: '{artist} - {title}' },
  { label: 'Artista - Álbum - Título', value: '{artist} - {album} - {title}' },
  { label: 'Álbum - Nº - Título', value: '{album} - {n} - {title}' },
];

// Reemplaza los caracteres no válidos en nombres de archivo por un guion.
function sanitize(value) {
  return String(value ?? '')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Genera el nombre de archivo de una pista a partir de la plantilla.
 * @param {string} template
 * @param {object} ctx  { n, track, title, artist, albumArtist, album, year, genre, ext }
 * @returns {string} nombre con extensión
 */
export function renderName(template, ctx) {
  const map = {
    n: ctx.n,
    track: ctx.track || ctx.n,
    title: ctx.title,
    artist: ctx.artist,
    albumartist: ctx.albumArtist,
    album: ctx.album,
    year: ctx.year,
    genre: ctx.genre,
  };
  let out = String(template || '')
    .replace(/\{(\w+)\}/g, (_, key) => sanitize(map[key.toLowerCase()] ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
  if (!out) out = String(ctx.n);
  return out + (ctx.ext || '.mp3');
}

// Devuelve la extensión de un nombre de archivo (con el punto), o ".mp3".
export function extensionOf(name) {
  const dot = String(name || '').lastIndexOf('.');
  return dot === -1 ? '.mp3' : name.slice(dot);
}
