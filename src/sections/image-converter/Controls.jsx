export default function Controls({
  format,
  onFormatChange,
  quality,
  onQualityChange,
  showQuality,
  hasItems,
  hasResults,
  converting,
  zipping,
  onConvert,
  onDownloadZip,
  onClear,
}) {
  return (
    <div className="controls">
      <label>
        Convertir a:{' '}
        <select value={format} onChange={(e) => onFormatChange(e.target.value)}>
          <option value="image/png">PNG</option>
          <option value="image/jpeg">JPEG</option>
          <option value="image/webp">WebP</option>
        </select>
      </label>

      {showQuality && (
        <span className="quality-wrap">
          <label>Calidad: {quality}</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={quality}
            onChange={(e) => onQualityChange(parseFloat(e.target.value))}
          />
        </span>
      )}

      <button disabled={!hasItems || converting} onClick={onConvert}>
        {converting ? 'Convirtiendo…' : 'Convertir'}
      </button>
      <button disabled={!hasResults || zipping} onClick={onDownloadZip}>
        {zipping ? 'Generando ZIP…' : 'Descargar ZIP'}
      </button>
      <button disabled={!hasItems} onClick={onClear}>
        Limpiar
      </button>
    </div>
  );
}
