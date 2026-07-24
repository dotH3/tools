// Web Worker que ejecuta el JS del editor en un hilo aparte: si el código
// tiene un bucle infinito o tarda mucho, no congela la interfaz. Tampoco
// tiene acceso al DOM ni al resto de la app, solo a las APIs propias de un
// worker (console, setTimeout, fetch, etc.).

function send(type, payload) {
  self.postMessage({ type, payload });
}

function serialize(value) {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
  const original = console[level] ? console[level].bind(console) : () => {};
  console[level] = (...args) => {
    original(...args);
    send('console', { level, text: args.map(serialize).join(' ') });
  };
});

self.addEventListener('error', (event) => {
  send('console', { level: 'error', text: event.message });
  event.preventDefault();
});

self.addEventListener('unhandledrejection', (event) => {
  send('console', { level: 'error', text: `Promesa rechazada sin capturar: ${serialize(event.reason)}` });
});

self.addEventListener('message', (event) => {
  try {
    const result = new Function(event.data)();
    if (typeof result !== 'undefined') {
      send('console', { level: 'result', text: `⇒ ${serialize(result)}` });
    }
  } catch (err) {
    send('console', { level: 'error', text: serialize(err) });
  }
  send('done');
});
