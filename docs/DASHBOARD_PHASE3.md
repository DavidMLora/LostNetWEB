# LostNetWEB — Fase 3: exploración y detalles

Implementado el 25 de octubre de 2026. Alcance: tarjetas, marcadores y sus acciones, detalle del reporte y comentarios. Se conserva la composición del dashboard, la posición de los filtros de categorías y el formulario de publicación.

## Referencias revisadas antes de implementar

Se inspeccionaron `dashboard.astro`, `app.js`, los estilos y componentes de las fases anteriores, el servicio de API, las reglas de propiedad y los flujos de filtros, geolocalización, rutas y comentarios.

El repositorio Android no estaba disponible localmente. Se consultó su versión pública en GitHub, fijada al commit `fdfa8bc217333812a99e589955e8286c26c72db9` de AbrahamEsquivel/LostNet. Archivos revisados:

- `item_reporte.xml`, `item_reporte_gmaps.xml`, `dialog_detalle_reporte.xml`.
- `ReportesAdapter.java`, `ReportesGmapsAdapter.java`, `ReporteModelo.java`, `MainActivity.java`.

La lista activa de Android utiliza ReportesGmapsAdapter; la otra plantilla conserva un estado PERDIDO fijo y no se tomó como contrato. Se adaptaron las miniaturas, la jerarquía de descripción/categoría/estado, los colores rojo y verde, las secciones de contacto y seguridad y la lista de comentarios. Android sirve como referencia de código; no se ejecutó ni se verificaron capturas de esa aplicación durante esta fase.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `src/pages/dashboard.astro` | Sustituye el antiguo bloque de detalles por ReportDetail. |
| `src/scripts/app.js` | Integra tarjetas/detalles, sincroniza marcadores, conserva instantáneas y gestiona carga/error. |
| `src/components/ReportDetail.astro` | Estructura accesible del modal y del compositor de comentarios. |
| `src/styles/reports.css` | Tarjetas, popups y detalle responsive con foco visible y movimiento reducido. |
| `src/scripts/reports-utils.js` | Normalización compartida de datos, coordenadas, fechas, imágenes, contacto y claves. |
| `src/scripts/report-cards.js` | Construcción segura de tarjetas y acciones independientes. |
| `src/scripts/report-popup.js` | Popups de Leaflet con detalle, rutas y eliminación autorizada. |
| `src/scripts/report-detail.js` | Detalle, comentarios, borradores, errores, bloqueo de duplicados y protección ante respuestas tardías. |
| `docs/DASHBOARD_PHASE3.md` | Este informe. |

## Comportamiento y decisiones

- Las tarjetas incluyen foto o alternativa, descripción, estado real, categoría, fecha real si existe, ubicación/distancia y distintivo de propiedad. Los datos ausentes no se sustituyen por fechas ni estados inventados.
- El servidor real entrega `created_at` en formato GMT. Se admite junto con el `timestamp` existente. No se presenta la fecha de vencimiento como fecha de creación.
- El botón principal localiza el objeto; una acción explícita abre los detalles. Un objeto sin coordenadas válidas abre directamente su detalle. Las coordenadas cero son válidas.
- Los marcadores se actualizan por clave estable y se retiran solo cuando dejan de pertenecer al conjunto visible. Se deduplican reportes por ID y se separan los espacios de claves de reportes y puntos seguros. Las rutas permanecen durante filtros/actualización; abrir un popup conserva el comportamiento previo de limpiar la ruta.
- El detalle usa dos columnas en escritorio y una en móvil; desplaza internamente el contenido y mantiene fijos el cierre y el compositor. Usa VisualViewport para adaptarse a la altura disponible. Se reutiliza la gestión existente de modal, Escape, foco contenido y restitución del foco.
- Se mantiene el email enmascarado y la pregunta de seguridad, sin mostrar su respuesta. WhatsApp utiliza únicamente el teléfono público ya recibido y validado; no se consulta información adicional ni se añade un prefijo de país supuesto. No se envió ningún mensaje por WhatsApp.
- Los puntos seguros conservan su detalle, sin habilitar comentarios o eliminación de reportes por coincidencia de ID.
- Los comentarios conservan GET `/comentarios?report_id=...` y POST `/comentar` con JSON exacto `{report_id, user_name, text}`. El envío requiere sesión vigente, texto no vacío y una única solicitud pendiente por reporte. Se conserva el borrador ante errores/cierre y solo se confirma después de la respuesta satisfactoria.
- Las respuestas tardías de un reporte no sobrescriben otro abierto. Si el POST se confirma y falla la recarga de comentarios, se conserva el comentario confirmado y se informa del problema de actualización.
- Carga inicial con esqueletos, resultados vacíos y reintento ante error. Una actualización fallida conserva los últimos datos exitosos. Si falla una sola fuente se indica conexión parcial y cuál no pudo actualizarse.

## Validación realizada

| Comprobación | Resultado |
| --- | --- |
| `npm run build` | Correcto: dos páginas estáticas generadas. |
| Sintaxis JavaScript y `git diff --check` | Correctos; Git solo avisa sobre normalización LF/CRLF. |
| Harness del controlador de detalles con API simulada | Correcto: payload exacto, borradores, bloqueo por reporte, errores, respuesta tardía, POST confirmado con GET fallido y claves safe/report. |
| Listado y marcadores en navegador | 9 filas de prueba, una duplicada: 8 tarjetas únicas y 6 marcadores de reporte válidos; 2 puntos seguros. Sin duplicación tras actualizar. |
| Fotografías y datos incompletos | Foto válida, enlace roto, sin foto, sin fecha/categoría/ID, coordenadas ausentes/fuera de rango/cero comprobados. |
| Filtros | Categorías combinadas, búsqueda, cercanía, propios, limpiar y estado vacío comprobados. Tarjetas y mapa coinciden. |
| Tarjeta/marcador/detalle | Localización, apertura desde popup y separación de reporte/punto seguro con el mismo ID comprobadas. |
| Rutas | Ruta en automóvil calculada mediante el proveedor existente; permanece al actualizar y filtrar. El método/proveedor de automóvil y a pie se conserva idéntico al baseline; no se ejecutó un recorrido real ni una ruta a pie. |
| Comentarios en navegador | GET, lista vacía, HTML mostrado como texto, POST exitoso simulado, doble clic con un solo POST, error HTTP, borrador conservado y reintento comprobados. |
| Red | Fallo inicial con reintento, actualización fallida conservando datos y fallo parcial de puntos seguros comprobados con respuestas simuladas. |
| Responsive | Inspección en 1440×900, 900×700, 390×844, 320×568 y 390×400; sin desbordamiento horizontal del detalle y cierre/envío dentro del viewport. |
| Teclado | Foco inicial en cierre, ciclo Tab/Shift+Tab dentro del modal, Escape y retorno al botón de origen comprobados. |
| Privacidad | Datos externos renderizados como texto; pregunta visible, respuesta de seguridad ausente del DOM, email enmascarado y eliminación solo de propios. |
| Preservación | CONFIG, URLs/endpoints, ApiService, SessionManager, drawRouteTo, callback multipart y los tres archivos de formulario permanecen idénticos al inicio de esta fase. Dependencias sin cambios. |

Las pruebas de navegador utilizaron el build local y un servidor de fixtures fuera del repositorio que intercepta las escrituras. Las capturas muestran datos de prueba; el logotipo sustituye una fotografía de objeto en una de las fixtures. Las pruebas temporales no forman parte del código de producción.

## Integración real y límites

Se hicieron únicamente consultas de lectura al servidor real: `/reportes` y `/comentarios` respondieron HTTP 200. Esto permitió comprobar los nombres de campos y el formato real de fecha. No se publicó, eliminó ni comentó ningún reporte real. La autorización del servidor para esas escrituras queda pendiente de una prueba manual con cuenta y datos autorizados.

El build conserva avisos de Vite sobre el tamaño del bundle y una importación interna de Astro no utilizada; no impiden compilar. No se añadieron dependencias ni se actualizó la herramienta de compilación.

La altura reducida se probó mediante emulación del viewport, no con teclados físicos iOS/Android. No se ejecutó una matriz de navegadores ni un lector de pantalla. La entrega no afirma validación de esos entornos.

Se detectó que la función anterior de cercanía usada por alertas descarta latitud/longitud cero por una comprobación de falsedad. El listado y los marcadores de esta fase sí admiten cero. Se deja documentado sin modificar alertas, fuera del alcance solicitado.

Pendientes: prueba autorizada de escrituras reales, revisión en dispositivos físicos y navegadores adicionales, y tratamiento independiente de los avisos de bundle y del caso de alertas anterior. No se avanzó a perfil, alertas ni notificaciones.
