// Helpers genéricos de imagen, reutilizables por cualquier sección.

export const extForMime = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

// Devuelve una extensión de archivo a partir de un MIME (png por defecto).
export function extFromMime(mime) {
  return extForMime[mime] || 'png';
}

// Carga un File como HTMLImageElement. Revoca el object URL al terminar,
// por lo que la imagen resultante sirve para dibujar en canvas, no para
// mostrarla en el DOM (para eso conserva tú mismo el object URL).
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Formato no soportado por el navegador'))),
      type,
      quality
    );
  });
}
