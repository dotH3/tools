import { useRef, useState } from 'react';

// Selector de una sola imagen (clic o arrastrar), para el editor.
export default function FilePicker({ onFile }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function pick(files) {
    if (files && files[0]) onFile(files[0]);
  }

  return (
    <div
      className={`drop${dragOver ? ' over' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        pick(e.dataTransfer && e.dataTransfer.files);
      }}
    >
      Arrastra una imagen aquí o haz clic para seleccionarla
      <input
        type="file"
        ref={inputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
