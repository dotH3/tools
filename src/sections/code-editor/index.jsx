import { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { LANGUAGES, EXTENSIONS, SAMPLE } from './setup.js';
import { triggerDownload } from '../../lib/file.js';

// Editor de codigo estilo VS Code, embebido con Monaco Editor.
// Da resaltado de sintaxis, autocompletado, validacion en linea y los
// atajos habituales (Ctrl+F buscar, Ctrl+/, multi-cursor, etc.).
export default function CodeEditor() {
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('vs-dark');
  const [value, setValue] = useState(SAMPLE);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef(null);

  function handleMount(editor) {
    editorRef.current = editor;
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Si el navegador bloquea el portapapeles, no hacemos nada.
    }
  }

  function download() {
    const ext = EXTENSIONS[language] || 'txt';
    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `codigo.${ext}`);
  }

  function format() {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }

  return (
    <div className="code-editor">
      <div className="code-toolbar">
        <label className="code-field">
          <span>Lenguaje</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="code-field">
          <span>Tema</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="vs-dark">Oscuro</option>
            <option value="light">Claro</option>
            <option value="hc-black">Alto contraste</option>
          </select>
        </label>

        <div className="code-actions">
          <button onClick={format} className="code-btn">
            Formatear
          </button>
          <button onClick={copyAll} className="code-btn">
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button onClick={download} className="code-btn code-btn-primary">
            Descargar
          </button>
        </div>
      </div>

      <div className="code-surface">
        <Editor
          height="100%"
          language={language}
          theme={theme}
          value={value}
          onChange={(v) => setValue(v ?? '')}
          onMount={handleMount}
          loading={<div className="code-loading">Cargando editor…</div>}
          options={{
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
        />
      </div>
    </div>
  );
}
