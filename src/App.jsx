import { useEffect, useState } from 'react';
import { sections, getSection, defaultSectionId } from './sections/registry.js';

// Ruteo mínimo por hash (#id), sin dependencias. Mantiene la sección
// activa al recargar y permite enlazar secciones directamente.
function useHashSection() {
  const read = () => window.location.hash.replace(/^#/, '') || defaultSectionId;
  const [id, setId] = useState(read);

  useEffect(() => {
    const onChange = () => setId(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = (next) => {
    window.location.hash = next;
  };

  return [id, go];
}

export default function App() {
  const [activeId, go] = useHashSection();
  const active = getSection(activeId);
  const Section = active.component;

  return (
    <div className="layout">
      <nav className="nav">
        <div className="nav-title">Herramientas</div>
        {sections.map((s) => (
          <button
            key={s.id}
            className={`nav-item${s.id === active.id ? ' active' : ''}`}
            onClick={() => go(s.id)}
          >
            {s.icon && <span className="nav-icon">{s.icon}</span>}
            {s.label}
          </button>
        ))}
      </nav>

      <main className="content">
        <h1>
          {active.icon && <span>{active.icon} </span>}
          {active.label}
        </h1>
        <Section />
      </main>
    </div>
  );
}
