import CropTool from './crop/CropTool.jsx';
import DrawTool from './draw/DrawTool.jsx';

/**
 * Registro de herramientas del editor de imágenes.
 *
 * Para agregar una herramienta nueva:
 *   1. Crea una carpeta en tools/mi-herramienta/ con su componente.
 *   2. El componente recibe las props { file, url }:
 *        file → el File original (nombre, tipo, tamaño)
 *        url  → object URL vivo para mostrar la imagen en el DOM
 *   3. Impórtalo aquí y añade una entrada al array.
 *
 * Campos:
 *   id        → identificador único de la herramienta
 *   label     → texto de la pestaña
 *   component → componente de React que se renderiza al seleccionarla
 */
export const tools = [
  {
    id: 'crop',
    label: 'Recortar',
    component: CropTool,
  },
  {
    id: 'draw',
    label: 'Dibujar',
    component: DrawTool,
  },
];

export function getTool(id) {
  return tools.find((t) => t.id === id) || tools[0];
}
