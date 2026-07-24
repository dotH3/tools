import { useEffect, useRef, useState } from 'react';
import { buildBookPdf, slugifyFilename } from './pdf.js';
import { triggerDownload } from '../../lib/file.js';

// Texto de ejemplo para que la herramienta no arranque vacía.
const SAMPLE_BODY = `Este es el comienzo de tu escrito. Reemplaza este texto por el tuyo.

Cada línea vacía separa un párrafo. El texto se ajusta solo a los márgenes de la página y, si es largo, sigue en las páginas siguientes.

Cuando termines, presioná «Descargar PDF» y ya lo podés compartir con tus amigos.`;

// Reduce una imagen a un tamaño manejable y la devuelve como data URL PNG,
// junto con sus dimensiones, para usarla en la portada del PDF.
function loadCoverImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxSide = 1000;
      let { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxSide / Math.max(w, h));
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: canvas.toDataURL('image/png'), w, h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = url;
  });
}

export default function PdfMaker() {
  const [title, setTitle] = useState('El título de tu obra');
  const [author, setAuthor] = useState('Tu nombre');
  const [coverImage, setCoverImage] = useState(null); // { dataUrl, w, h }
  const [coverLines, setCoverLines] = useState('Edición de autor\n2026');
  const [body, setBody] = useState(SAMPLE_BODY);

  const [fontFamily, setFontFamily] = useState('times');
  const [fontSize, setFontSize] = useState(12);
  const [pageSize, setPageSize] = useState('a4');
  const [margin, setMargin] = useState(25);
  const [lineSpacing, setLineSpacing] = useState(1.5);
  const [justify, setJustify] = useState(true);
  const [numberPages, setNumberPages] = useState(true);
  const [blankPage, setBlankPage] = useState(true);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const imageInputRef = useRef(null);
  const previewUrlRef = useRef(null);

  const options = {
    title,
    author,
    coverImage,
    coverLines,
    body,
    fontFamily,
    fontSize: Number(fontSize),
    pageSize,
    margin: Number(margin),
    lineSpacing: Number(lineSpacing),
    justify,
    numberPages,
    blankPage,
  };

  // Regenera la vista previa con un pequeño retraso, para no rearmar el PDF
  // en cada tecla. Libera el object URL anterior al reemplazarlo.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const doc = buildBookPdf(options);
        const url = doc.output('bloburl');
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(String(url));
        setError('');
      } catch (err) {
        setError(err?.message || 'No se pudo generar la vista previa.');
      }
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title, author, coverImage, coverLines, body,
    fontFamily, fontSize, pageSize, margin, lineSpacing,
    justify, numberPages, blankPage,
  ]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const img = await loadCoverImage(file);
      setCoverImage(img);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  function removeImage() {
    setCoverImage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function download() {
    try {
      const doc = buildBookPdf(options);
      triggerDownload(doc.output('blob'), slugifyFilename(title));
    } catch (err) {
      setError(err?.message || 'No se pudo generar el PDF.');
    }
  }

  return (
    <div className="pdf-maker">
      <div className="pdf-form">
        <fieldset className="pdf-group">
          <legend>Portada</legend>

          <label className="pdf-field">
            <span>Título</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del escrito" />
          </label>

          <label className="pdf-field">
            <span>Autor</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Nombre del autor" />
          </label>

          <label className="pdf-field">
            <span>Imagen de portada (opcional)</span>
            <input ref={imageInputRef} type="file" accept="image/*" onChange={onPickImage} />
          </label>

          {coverImage && (
            <div className="pdf-image-preview">
              <img src={coverImage.dataUrl} alt="Portada" />
              <button type="button" className="code-btn code-btn-small" onClick={removeImage}>
                Quitar imagen
              </button>
            </div>
          )}

          <label className="pdf-field">
            <span>Datos de portada (una línea por renglón)</span>
            <textarea
              rows={3}
              value={coverLines}
              onChange={(e) => setCoverLines(e.target.value)}
              placeholder="Fecha, dedicatoria, edición…"
            />
          </label>
        </fieldset>

        <fieldset className="pdf-group">
          <legend>Contenido</legend>
          <label className="pdf-field">
            <span>Texto principal</span>
            <textarea
              className="pdf-body-input"
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Pegá aquí tu escrito…"
            />
          </label>
        </fieldset>

        <fieldset className="pdf-group">
          <legend>Formato</legend>
          <div className="pdf-options">
            <label className="pdf-field">
              <span>Fuente</span>
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                <option value="times">Times (con serifa)</option>
                <option value="helvetica">Helvetica (sin serifa)</option>
                <option value="courier">Courier (monoespaciada)</option>
              </select>
            </label>

            <label className="pdf-field">
              <span>Tamaño</span>
              <select value={fontSize} onChange={(e) => setFontSize(e.target.value)}>
                {[10, 11, 12, 13, 14, 16].map((s) => (
                  <option key={s} value={s}>{s} pt</option>
                ))}
              </select>
            </label>

            <label className="pdf-field">
              <span>Página</span>
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <option value="a4">A4</option>
                <option value="letter">Carta</option>
              </select>
            </label>

            <label className="pdf-field">
              <span>Interlineado</span>
              <select value={lineSpacing} onChange={(e) => setLineSpacing(e.target.value)}>
                <option value={1.15}>Sencillo</option>
                <option value={1.5}>1,5 líneas</option>
                <option value={2}>Doble</option>
              </select>
            </label>

            <label className="pdf-field">
              <span>Márgenes: {margin} mm</span>
              <input
                type="range"
                min={15}
                max={40}
                step={1}
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
              />
            </label>
          </div>

          <div className="pdf-checks">
            <label className="pdf-check">
              <input type="checkbox" checked={justify} onChange={(e) => setJustify(e.target.checked)} />
              Justificar texto
            </label>
            <label className="pdf-check">
              <input type="checkbox" checked={numberPages} onChange={(e) => setNumberPages(e.target.checked)} />
              Numerar páginas
            </label>
            <label className="pdf-check">
              <input type="checkbox" checked={blankPage} onChange={(e) => setBlankPage(e.target.checked)} />
              Página en blanco tras la portada
            </label>
          </div>
        </fieldset>

        {error && <p className="pdf-error">{error}</p>}

        <button onClick={download} className="code-btn code-btn-primary pdf-download">
          Descargar PDF
        </button>
      </div>

      <div className="pdf-preview">
        <div className="pdf-preview-title">Vista previa</div>
        {previewUrl ? (
          <iframe title="Vista previa del PDF" src={previewUrl} className="pdf-preview-frame" />
        ) : (
          <div className="code-loading">Generando vista previa…</div>
        )}
      </div>
    </div>
  );
}
