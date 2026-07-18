// Configuración de Monaco Editor (el motor real de VS Code) para que se
// cargue de forma LOCAL, sin depender de ningún CDN. Así el editor funciona
// offline y trae los "workers" que dan el IntelliSense (autocompletado,
// validación, formateo) estilo VS Code.
//
// Este archivo se importa una sola vez desde index.jsx. Los imports con el
// sufijo `?worker` son una característica de Vite: convierten cada worker de
// Monaco en un Web Worker empaquetado con la app.
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Monaco pide un worker según el lenguaje que esté editando.
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

// Le decimos al wrapper de React que use esta instancia local de Monaco
// en lugar de descargarla desde internet.
loader.config({ monaco });

// Lenguajes que ofrecemos en el selector. Monaco reconoce muchos más
// (resaltado de sintaxis básico); estos cubren lo más común.
export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'python', label: 'Python' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'sql', label: 'SQL' },
  { id: 'shell', label: 'Shell / Bash' },
  { id: 'xml', label: 'XML' },
  { id: 'yaml', label: 'YAML' },
  { id: 'plaintext', label: 'Texto plano' },
];

// Extensión de archivo sugerida al descargar, según el lenguaje.
export const EXTENSIONS = {
  javascript: 'js',
  typescript: 'ts',
  html: 'html',
  css: 'css',
  json: 'json',
  python: 'py',
  markdown: 'md',
  sql: 'sql',
  shell: 'sh',
  xml: 'xml',
  yaml: 'yaml',
  plaintext: 'txt',
};

// Contenido de ejemplo para que el editor no arranque vacío.
export const SAMPLE = `// Escribe aqui tu codigo.
// Tienes autocompletado, errores en linea y atajos como en VS Code.

function saludar(nombre) {
  return \`Hola, \${nombre}!\`;
}

console.log(saludar('mundo'));
`;
