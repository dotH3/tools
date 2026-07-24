import ImageConverter from './image-converter/index.jsx';
import ImageEditor from './image-editor/index.jsx';
import CodeEditor from './code-editor/index.jsx';
import AlbumEditor from './album-editor/index.jsx';
import PdfMaker from './pdf-maker/index.jsx';

/**
 * Registro central de secciones de la app.
 *
 * Para agregar una sección nueva:
 *   1. Crea una carpeta en src/sections/mi-seccion/ con un index.jsx
 *      que exporte por defecto un componente de React.
 *   2. Impórtalo aquí y añade una entrada al array de abajo.
 *
 * Campos de cada sección:
 *   id        → identificador único, se usa en el hash de la URL (#id)
 *   label     → texto que aparece en la navegación
 *   icon      → ícono opcional para la nav (texto/SVG, sin emojis)
 *   component → el componente de React que se renderiza
 */
export const sections = [
  {
    id: 'image-converter',
    label: 'Conversor de imágenes',
    component: ImageConverter,
  },
  {
    id: 'image-editor',
    label: 'Editor de imágenes',
    component: ImageEditor,
  },
  {
    id: 'code-editor',
    label: 'Editor de código',
    component: CodeEditor,
  },
  {
    id: 'album-editor',
    label: 'Editor de álbumes',
    component: AlbumEditor,
  },
  {
    id: 'pdf-maker',
    label: 'Armar PDF',
    component: PdfMaker,
  },
];

export const defaultSectionId = sections[0].id;

export function getSection(id) {
  return sections.find((s) => s.id === id) || sections[0];
}
