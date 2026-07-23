import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { LANGUAGES, EXTENSIONS, SAMPLE } from './setup.js';
import { triggerDownload } from '../../lib/file.js';
import RunnerWorker from './runner.worker.js?worker';

const RUN_TIMEOUT_MS = 8000;

// Editor de codigo estilo VS Code, embebido con Monaco Editor.
// Da resaltado de sintaxis, autocompletado, validacion en linea y los
// atajos habituales (Ctrl+F buscar, Ctrl+/, multi-cursor, etc.).
export default function CodeEditor() {
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('vs-dark');
  const [value, setValue] = useState(SAMPLE);
  const [copied, setCopied] = useState(false);
  const [output, setOutput] = useState([]);
  const [running, setRunning] = useState(false);
  const editorRef = useRef(null);
  const workerRef = useRef(null);
  const timeoutRef = useRef(null);
  const lineIdRef = useRef(0);
  const consoleBodyRef = useRef(null);

  const canRun = language === 'javascript';

  function handleMount(editor, monaco) {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runCode());
  }

  function appendLine(level, text) {
    const id = lineIdRef.current + 1;
    lineIdRef.current = id;
    setOutput((prev) => [...prev, { id, level, text }]);
  }

  function stopWorker(reason) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      if (reason) appendLine('error', reason);
    }
    setRunning(false);
  }

  function runCode() {
    if (!canRun) return;
    stopWorker();
    setOutput([]);
    lineIdRef.current = 0;
    setRunning(true);

    const worker = new RunnerWorker();
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'console') {
        appendLine(payload.level, payload.text);
      } else if (type === 'done') {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        setRunning(false);
      }
    };

    worker.onerror = (event) => {
      appendLine('error', event.message);
      stopWorker();
    };

    worker.postMessage(editorRef.current ? editorRef.current.getValue() : value);

    timeoutRef.current = setTimeout(() => {
      stopWorker('Ejecución detenida: se superó el límite de 8 segundos.');
    }, RUN_TIMEOUT_MS);
  }

  function clearConsole() {
    setOutput([]);
  }

  useEffect(() => () => stopWorker(), []);

  useEffect(() => {
    if (!canRun) stopWorker();
  }, [canRun]);

  useEffect(() => {
    if (consoleBodyRef.current) {
      consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
    }
  }, [output]);

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
          {canRun &&
            (running ? (
              <button onClick={() => stopWorker()} className="code-btn code-btn-stop">
                ◼ Detener
              </button>
            ) : (
              <button onClick={runCode} className="code-btn code-btn-run">
                ▶ Ejecutar
              </button>
            ))}
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

      {canRun && (
        <div className="code-console">
          <div className="code-console-header">
            <span>Consola {running && <span className="code-console-running">ejecutando…</span>}</span>
            <button onClick={clearConsole} className="code-btn code-btn-small">
              Limpiar
            </button>
          </div>
          <div className="code-console-body" ref={consoleBodyRef}>
            {output.length === 0 ? (
              <div className="code-console-empty">
                Sin salida todavía. Ejecuta el código con «Ejecutar» o Ctrl+Enter.
              </div>
            ) : (
              output.map((line) => (
                <div key={line.id} className={`console-line console-${line.level}`}>
                  {line.text}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
