// Genera un PDF con forma de "libro" a partir de texto, usando jsPDF.
//
// Estructura del documento:
//   1. Portada: título, imagen opcional, autor y datos libres.
//   2. Una página en blanco (opcional).
//   3. El texto principal, con márgenes, justificado y paginado.
//   4. Número de página al pie de cada página de contenido.
//
// Todo corre en el navegador; jsPDF se empaqueta con la app, así que no
// hace falta conexión. Las fuentes estándar (Times/Helvetica/Courier) usan
// WinAnsiEncoding, por lo que los acentos y signos del español (á, ñ, ¿, ¡)
// se ven correctamente en cualquier visor.
import { jsPDF } from 'jspdf';

// 1 punto tipográfico = 1/72 pulgada = 25.4/72 mm.
const PT_TO_MM = 25.4 / 72;

// Dibuja una línea ya "cortada" al ancho útil. Si `justify` es true y la
// línea tiene al menos dos palabras, reparte el espacio sobrante entre las
// palabras (justificado real, colocando cada palabra por su cuenta: el
// justificado nativo de jsPDF no estira una línea suelta).
function drawLine(doc, line, x, y, usableW, justify) {
  if (!justify) {
    doc.text(line, x, y);
    return;
  }
  const words = line.split(' ').filter((w) => w.length > 0);
  if (words.length < 2) {
    doc.text(line, x, y);
    return;
  }
  const wordsWidth = words.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
  const gap = (usableW - wordsWidth) / (words.length - 1);
  let cx = x;
  for (const w of words) {
    doc.text(w, cx, y);
    cx += doc.getTextWidth(w) + gap;
  }
}

// Maqueta la portada (primera página).
function drawCover(doc, o) {
  const { title, author, coverImage, coverLines, fontFamily, pageW, pageH, margin, usableW } = o;
  const cx = pageW / 2;

  // Título centrado, en negrita, en el tercio superior.
  let y = pageH * 0.28;
  if (title.trim()) {
    const titleSize = 26;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(titleSize);
    const titleLH = titleSize * PT_TO_MM * 1.2;
    for (const l of doc.splitTextToSize(title.trim(), usableW)) {
      doc.text(l, cx, y, { align: 'center' });
      y += titleLH;
    }
  }

  // Imagen opcional, centrada bajo el título, con tamaño acotado.
  if (coverImage && coverImage.dataUrl) {
    const maxW = Math.min(usableW * 0.6, 75);
    const maxH = pageH * 0.32;
    let w = maxW;
    let h = (coverImage.h / coverImage.w) * w;
    if (h > maxH) {
      h = maxH;
      w = (coverImage.w / coverImage.h) * h;
    }
    const imgY = y + 8;
    const fmt = coverImage.dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    doc.addImage(coverImage.dataUrl, fmt, cx - w / 2, imgY, w, h);
    y = imgY + h;
  }

  // Autor, centrado bajo el bloque anterior.
  if (author.trim()) {
    const size = 14;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(size);
    y += 16;
    for (const l of doc.splitTextToSize(author.trim(), usableW)) {
      doc.text(l, cx, y, { align: 'center' });
      y += size * PT_TO_MM * 1.3;
    }
  }

  // Datos libres, anclados hacia la parte baja de la portada.
  const extra = coverLines
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra.length) {
    const size = 11;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(size);
    const lh = size * PT_TO_MM * 1.4;
    // Los ubicamos abajo, sin invadir el bloque de arriba.
    let by = Math.max(pageH - margin - (extra.length - 1) * lh - 4, y + 14);
    for (const l of extra) {
      doc.text(l, cx, by, { align: 'center' });
      by += lh;
    }
  }
}

export function buildBookPdf(opts) {
  const {
    title = '',
    author = '',
    coverImage = null, // { dataUrl, w, h } | null
    coverLines = '',
    body = '',
    fontFamily = 'times',
    fontSize = 12,
    pageSize = 'a4',
    margin = 25,
    lineSpacing = 1.5,
    justify = true,
    numberPages = true,
    blankPage = true,
  } = opts;

  const doc = new jsPDF({ unit: 'mm', format: pageSize, orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usableW = pageW - margin * 2;

  // ---------- Portada ----------
  drawCover(doc, { title, author, coverImage, coverLines, fontFamily, pageW, pageH, margin, usableW });

  // ---------- Página en blanco ----------
  if (blankPage) doc.addPage();

  // ---------- Contenido ----------
  const lineHeight = fontSize * PT_TO_MM * lineSpacing;
  const paragraphGap = lineHeight * 0.45;
  const footerH = 12; // espacio reservado abajo para el folio
  const topY = margin;
  const bottomLimit = pageH - margin - (numberPages ? footerH : 0);

  doc.addPage();
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(fontSize);
  let y = topY;
  let contentPageNo = 1;

  const drawFooter = () => {
    if (!numberPages) return;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10);
    doc.text(String(contentPageNo), pageW / 2, pageH - margin / 2, { align: 'center' });
    doc.setFontSize(fontSize);
  };

  const newContentPage = () => {
    drawFooter();
    doc.addPage();
    contentPageNo += 1;
    y = topY;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(fontSize);
  };

  // Cada línea del texto es un párrafo; las líneas vacías dejan un espacio.
  const paragraphs = String(body).replace(/\r\n/g, '\n').split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') {
      y += paragraphGap;
      continue;
    }
    const lines = doc.splitTextToSize(para, usableW);
    for (let li = 0; li < lines.length; li++) {
      if (y + lineHeight > bottomLimit) newContentPage();
      const isLastLine = li === lines.length - 1;
      drawLine(doc, lines[li], margin, y, usableW, justify && !isLastLine);
      y += lineHeight;
    }
    y += paragraphGap;
  }
  drawFooter(); // folio de la última página de contenido

  return doc;
}

// Convierte un título en un nombre de archivo razonable.
export function slugifyFilename(title) {
  const base = (title || 'documento')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'documento'}.pdf`;
}
