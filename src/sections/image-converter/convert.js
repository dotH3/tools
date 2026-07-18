import { extForMime, loadImage, canvasToBlob } from '../../lib/image.js';

// Re-exportado por compatibilidad con el resto de la sección.
export const extFor = extForMime;

/**
 * Convierte un File de imagen al formato dado usando un canvas.
 * Devuelve { blob, name }.
 */
export async function convertImage(file, format, quality) {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');

  // JPEG no tiene transparencia: rellenamos con blanco para evitar fondo negro.
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);

  const useQuality = format === 'image/jpeg' || format === 'image/webp' ? quality : undefined;
  const blob = await canvasToBlob(canvas, format, useQuality);
  const base = file.name.replace(/\.[^.]+$/, '');
  return { blob, name: base + '.' + extForMime[format] };
}
