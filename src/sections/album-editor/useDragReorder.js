import { useRef, useState } from 'react';

// Reordenamiento por arrastre con pointer events nativos (mouse y táctil), sin
// dependencias. Al tomar el asa se captura el puntero, de modo que los eventos
// siguen llegando aunque el cursor salga del elemento. Mientras se arrastra, la
// lista se reordena en vivo según la fila que esté bajo el puntero.
//
// Uso:
//   const { draggingId, dragHandleProps } = useDragReorder(listRef, items, setItems);
//   <div ref={listRef}> {items.map(it =>
//     <Row data-row-id={it.id} dragging={draggingId === it.id}
//          dragHandleProps={dragHandleProps(it.id)} />)} </div>
//
// Cada fila debe exponer su id en el atributo `data-row-id`.
export function useDragReorder(listRef, items, setItems) {
  const [draggingId, setDraggingId] = useState(null);
  const dragId = useRef(null);

  function start(e, id) {
    // Solo botón principal / toque; ignoramos clic derecho.
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture no soportado: seguimos igual */
    }
    dragId.current = id;
    setDraggingId(id);
  }

  function move(e) {
    if (dragId.current == null || !listRef.current) return;
    const rows = listRef.current.querySelectorAll('[data-row-id]');
    if (!rows.length) return;

    const y = e.clientY;
    let targetId = null;
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) {
        targetId = row.getAttribute('data-row-id');
        break;
      }
    }
    // Fuera de rango: fijamos al primero (arriba) o al último (abajo).
    if (targetId == null) {
      const firstR = rows[0].getBoundingClientRect();
      if (y < firstR.top) targetId = rows[0].getAttribute('data-row-id');
      else targetId = rows[rows.length - 1].getAttribute('data-row-id');
    }

    const from = dragId.current;
    if (targetId == null || targetId === from) return;

    setItems((prev) => {
      const i = prev.findIndex((t) => t.id === from);
      const j = prev.findIndex((t) => t.id === targetId);
      if (i < 0 || j < 0 || i === j) return prev;
      const next = prev.slice();
      const [moved] = next.splice(i, 1);
      next.splice(j, 0, moved);
      return next;
    });
  }

  function end() {
    dragId.current = null;
    setDraggingId(null);
  }

  const dragHandleProps = (id) => ({
    onPointerDown: (e) => start(e, id),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  });

  return { draggingId, dragHandleProps };
}
