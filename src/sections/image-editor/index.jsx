import { useEffect, useState } from 'react';
import FilePicker from './FilePicker.jsx';
import Editor from './Editor.jsx';

export default function ImageEditor() {
  const [source, setSource] = useState(null); // { file, url }

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

  return (
    <>
      <p className="editor-intro">Recorta y dibuja sobre tu imagen. Todo se procesa en tu navegador; ningún archivo se sube a internet.</p>

      {!source ? (
        <FilePicker onFile={loadFile} />
      ) : (
        <Editor
          key={source.url}
          file={source.file}
          url={source.url}
          onChangeImage={() => setSource(null)}
        />
      )}
    </>
  );
}
