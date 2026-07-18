import { useEffect, useState } from 'react';
import FilePicker from './FilePicker.jsx';
import { tools, getTool } from './tools/registry.js';

export default function ImageEditor() {
  const [source, setSource] = useState(null); // { file, url }
  const [toolId, setToolId] = useState(tools[0].id);

  // Liberamos el object URL al reemplazar la imagen o al desmontar.
  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.url);
    };
  }, [source]);

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    setSource({ file, url: URL.createObjectURL(file) });
  }

  const activeTool = getTool(toolId);
  const Tool = activeTool.component;

  return (
    <>
      <p>Todo se procesa en tu navegador. Ningún archivo se sube a internet.</p>

      {!source ? (
        <FilePicker onFile={loadFile} />
      ) : (
        <>
          <div className="editor-bar">
            {tools.length > 1 ? (
              <div className="tool-tabs">
                {tools.map((t) => (
                  <button
                    key={t.id}
                    className={`tool-tab${t.id === activeTool.id ? ' active' : ''}`}
                    onClick={() => setToolId(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <span />
            )}
            <button onClick={() => setSource(null)}>Cargar otra imagen</button>
          </div>

          <Tool key={source.url} file={source.file} url={source.url} />
        </>
      )}
    </>
  );
}
