import { useState } from 'react';
import DropZone from './DropZone.jsx';
import Controls from './Controls.jsx';
import Row from './Row.jsx';
import { convertImage } from './convert.js';
import { buildZip, dedupeNames } from './zip.js';
import { triggerDownload } from '../../lib/file.js';

export default function ImageConverter() {
  const [items, setItems] = useState([]);
  const [format, setFormat] = useState('image/png');
  const [quality, setQuality] = useState(0.92);
  const [converting, setConverting] = useState(false);
  const [zipping, setZipping] = useState(false);

  const showQuality = format === 'image/jpeg' || format === 'image/webp';
  const hasItems = items.length > 0;
  const hasResults = items.some((i) => i.resultBlob);

  function addFiles(fileList) {
    const newItems = [];
    for (const file of fileList) {
      if (!file.type.startsWith('image/')) continue;
      newItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        resultBlob: null,
        resultName: null,
        status: 'wait',
        error: null,
      });
    }
    if (newItems.length) setItems((prev) => [...prev, ...newItems]);
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function convertAll() {
    setConverting(true);
    for (const item of items) {
      updateItem(item.id, { status: 'converting', error: null });
      try {
        const { blob, name } = await convertImage(item.file, format, quality);
        updateItem(item.id, { status: 'ok', resultBlob: blob, resultName: name });
      } catch (err) {
        updateItem(item.id, { status: 'err', error: err.message });
      }
    }
    setConverting(false);
  }

  function downloadItem(item) {
    triggerDownload(item.resultBlob, item.resultName);
  }

  async function downloadAllZip() {
    const done = items.filter((i) => i.resultBlob);
    if (!done.length) return;
    setZipping(true);
    try {
      const entries = dedupeNames(done.map((i) => ({ name: i.resultName, blob: i.resultBlob })));
      const zipBlob = await buildZip(entries);
      triggerDownload(zipBlob, 'imagenes-convertidas.zip');
    } finally {
      setZipping(false);
    }
  }

  function clearAll() {
    items.forEach((i) => {
      if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
    });
    setItems([]);
  }

  return (
    <>
      <p>Todo se procesa en tu navegador. Ningún archivo se sube a internet.</p>

      <DropZone onFiles={addFiles} />

      <Controls
        format={format}
        onFormatChange={setFormat}
        quality={quality}
        onQualityChange={setQuality}
        showQuality={showQuality}
        hasItems={hasItems}
        hasResults={hasResults}
        converting={converting}
        zipping={zipping}
        onConvert={convertAll}
        onDownloadZip={downloadAllZip}
        onClear={clearAll}
      />

      <table className={hasItems ? '' : 'hidden'}>
        <thead>
          <tr>
            <th></th>
            <th>Archivo</th>
            <th>Original</th>
            <th>Convertido</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Row key={item.id} item={item} onDownload={downloadItem} />
          ))}
        </tbody>
      </table>
    </>
  );
}
