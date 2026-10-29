# LostNetWEB · Dashboard, primera fase visual

Fecha de validación: 25 de octubre de 2026. Proyecto modificado: `C:\Users\david\OneDrive\Escritorio\LostNetWEB`.

## Alcance y resultado

Se implementó únicamente la nueva pantalla principal. El mapa ocupa todo el viewport, con búsqueda flotante, categorías horizontales, acciones de zoom/ubicación/actualización, acceso a alertas y perfil y una acción destacada para reportar. El panel ofrece Explorar, Tú y ¿Cómo funciona?.

En móvil inicia compacto para dar prioridad al mapa y se expande mediante la cabecera o las pestañas. En escritorio es una tarjeta flotante a la izquierda. Las alturas pequeñas usan un único scroll para mantener accesibles filtros y resultados; en horizontal móvil el panel ocupa solo parte del ancho.

No se modificaron Android, backend, dependencias, configuración Astro ni la página de inicio de sesión. Se conservó el formulario de creación y la vista de detalle; únicamente se añadieron etiquetas accesibles y gestión de foco a sus contenedores.

## Análisis previo

### Android consultado remotamente

Repositorio accesible por GitHub, rama master, commit `fdfa8bc217333812a99e589955e8286c26c72db9`. No estaba clonado ni se ejecutó Android. No se encontraron capturas de la interfaz en el árbol revisado; solo logos e iconos. Por ello, las referencias visuales fueron XML, drawables y Java, sin afirmar una comparación con capturas inexistentes.

Proyecto Java/XML con módulo app, Java 11, SDK mínimo 29 y compile/target 36. Dependencias principales: Material/AppCompat/ConstraintLayout, Google Maps y ubicación, Google Sign-In/Firebase, Retrofit/Gson y Glide.

Archivos revisados:

- [activity_main.xml](https://github.com/AbrahamEsquivel/LostNet/blob/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/res/layout/activity_main.xml): mapa completo, búsqueda 48dp/radio24, avatar48dp, chips horizontales, FAB48dp y panel inferior.
- [dialog_reporte.xml](https://github.com/AbrahamEsquivel/LostNet/blob/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/res/layout/dialog_reporte.xml): formulario, radios28/12, padding24 y separación16–24.
- [layout_profile_panel.xml](https://github.com/AbrahamEsquivel/LostNet/blob/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/res/layout/layout_profile_panel.xml): identidad, accesos y cierre de sesión.
- [colors.xml](https://github.com/AbrahamEsquivel/LostNet/blob/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/res/values/colors.xml) y [drawables](https://github.com/AbrahamEsquivel/LostNet/tree/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/res/drawable): selectores, búsqueda, panel, handle, tabs, campos, botones y badges.
- [MainActivity.java](https://github.com/AbrahamEsquivel/LostNet/blob/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/java/com/example/lostnet/MainActivity.java), ReportesGmapsAdapter.java, NotificacionesActivity.java, LostNetApi.java y item_reporte_gmaps.xml: navegación, filtros, reportes, GPS, detalle y alertas.

El dashboard usa realmente azul `#1A73E8`, azul suave `#E8F0FE`, blanco y texto `#202124`/`#5F6368`. Aunque colors.xml declara un primario violeta `#6C63FF`, este no domina la pantalla principal. No se encontró una fuente personalizada. El panel Android tiene altura expandida520dp, peek80dp, radios superiores20dp y barra de navegación64dp.

Java confirma chips de selección única, puntos seguros siempre visibles, tarjetas que colapsan el panel y centran el mapa, GPS zoom16, perfil y alertas. La búsqueda está presente en XML, pero no se encontró TextWatcher ni uso de etBusqueda en MainActivity: solo se verificó su apariencia.

### Web y correspondencias

Astro5, Tailwind4 mediante Vite, Leaflet1.9 y leaflet-routing-machine3.2. El dashboard era monolítico, con cabecera, panel izquierdo, alertas a la derecha y modales; app.js concentra REST, sesión y Leaflet. global.css solo importa Tailwind.

| Elemento Android | Adaptación web |
|---|---|
| Mapa y controles superpuestos | Leaflet existente a pantalla completa |
| Búsqueda flotante | Búsqueda web funcional por descripción |
| Chips de selección única | Se conserva multiselección web y se añade Todos |
| Panel Explorar/Tú/Ayuda | Pestañas con teclado y panel colapsable |
| Perfil | Datos de la sesión existente, sin endpoint nuevo |
| Reportar en centro de cámara | Se mantiene la selección web por clic y sus coordenadas |
| Cercanía/propios | Se conservan los filtros web y su radio de2.5km |
| Marcadores azul/rojo/verde | Se mantienen colores recibidos desde la API y puntos seguros visibles |

## Archivos modificados y añadidos

| Archivo | Cambio |
|---|---|
| `src/pages/dashboard.astro` | Nueva composición principal; conserva IDs, formulario y vista secundaria |
| `src/styles/dashboard.css` (nuevo) | Tokens, overlays, chips, panel, tarjetas, responsive y foco |
| `src/components/Icon.astro` (nuevo) | Iconos SVG coherentes sin biblioteca adicional |
| `src/scripts/dashboard-ui.js` (nuevo) | Presentación: tabs, panel, gesto de arrastre, perfil, filtros rápidos y estados |
| `src/scripts/app.js` | Conecta nueva UI con la lógica existente; tarjetas accesibles, alertas, selección, feedback GPS y foco de diálogos |
| `src/layouts/Layout.astro` | Idioma español, título recibido y viewport con safe areas |
| `docs/DASHBOARD_PHASE1.md` (nuevo) | Este informe |

## Decisiones de diseño e implementación

- Se tomó el azul del dashboard Android y una tipografía de sistema, sin descargar fuentes.
- La búsqueda, categorías y acción principal permanecen sobre el mapa; no se sacrificó la búsqueda ni la multiselección existentes.
- El perfil usa nombre/email/foto de SessionManager, con iniciales si falta la imagen.
- Cambiar pestañas solo modifica presentación: no vuelve a renderizar marcadores ni elimina rutas.
- Los nuevos resultados usan botones nativos, nombres accesibles y una acción separada para eliminar.
- Tabs con aria-selected, roving tabindex, flechas/Home/End; diálogos con Escape, foco contenido y restauración; contenido oculto fuera de navegación.
- Se conservaron atribuciones de Leaflet y OpenStreetMap. No se añadieron dependencias.

## Validación realizada

### Compilación y preservación

- `npm run build`: PASS, la ejecución de la entrega inicial generó las dos páginas estáticas en5.01s.
- `node --check` para app.js y dashboard-ui.js: PASS.
- Smoke checks de presentación: PASS para inicio móvil, apertura/cierre, teclado, recuperación de foco, gesto de pointer sin doble clic, limpieza de filtros, perfil y selección.
- Comparación automática con baseline: CONFIG y ApiService idénticos; cuerpo multipart idéntico; form-report idéntico; todos los IDs anteriores conservados y sin duplicados.
- `git diff --check`: PASS. package.json, package-lock.json y astro.config.mjs sin cambios.
- No hay fixtures, usuario de QA ni interceptores de prueba dentro de src o del código de producción.

Vite avisa de imports internos no usados de Astro y de un chunk JS de aproximadamente734kB (124kB gzip). Son advertencias no bloqueantes. No se amplió esta fase con separación de bundles.

OneDrive produjo errores EPERM por atributos de solo lectura en caché/salida generada. Se quitaron esos atributos únicamente en la caché de Vite y dist. La compilación final pasó sin cambiar la configuración del proyecto.

### Navegador real

Pruebas mediante navegador integrado Chromium contra build servido localmente. Para casos controlados se usó un servidor temporal fuera del repositorio, que inyecta una sesión ficticia, ubicación simulada y respuestas de API solo en memoria. Las capturas entregadas muestran esos datos de prueba (7 reportes/2 puntos seguros); no se añadió un modo demo a la aplicación.

| Prueba | Resultado |
|---|---|
| Búsqueda Llaves | 1 resultado, coincide con mapa/contador |
| Electrónica / Electrónica+Ropa | 2 / 3 resultados; 2 puntos seguros permanecen |
| Todos y limpiar filtros | Restablecen las categorías y los7 reportes |
| Mis reportes | 2 resultados propios |
| Cercanía con ubicación simulada | 6 resultados dentro de2.5km |
| GPS rechazado | Filtro vuelve a desactivado y aparece mensaje; botón GPS informa el error |
| Perfil y accesos | Nombre, email, iniciales, contador y navegación correctos |
| Alertas | 6 elementos cercanos; Escape cierra y devuelve foco al acceso original |
| Selección de reporte | Activa cursor/indicación, clic de mapa llena lat/lon en formulario original |
| Cancelación | Botón y Escape desactivan selección |
| Modal de creación | Abre/cierra; Shift+Tab desde primer control lleva al último |
| Tarjeta y detalle | Centra, abre popup y colapsa panel móvil; detalle carga comentarios simulados |
| Ruta en auto y a pie | Servicio existente devuelve instrucciones,5 filas en ambos casos |
| Cambio de pestañas con ruta | La ruta continúa visible |
| Zoom y desplazamiento por teclado | Controles operativos y transformación del mapa cambia |
| Actualización | Recarga datos y restablece aria-busy |
| API no disponible simulada | Mensaje Sin conexión; mapa y controles siguen activos |
| Guard y logout | Dashboard sin sesión redirige al login; cerrar sesión vuelve al login |
| Responsive | 1440×900,1024×600,390×844,360×640,320×568 y667×375; sin overflow horizontal |
| Pantallas bajas | Última tarjeta accesible mediante scroll; GPS y reportar siguen visibles |

### API real

La descripción del repositorio indicaba servidores apagados, pero durante esta validación la API respondió:

- GET /api/reportes: HTTP200, JSON,2 registros.
- GET /api/puntos-seguros: HTTP200, JSON,50 registros.
- GET /api/config: HTTP200, objeto JSON.

También se validó la carga desde el navegador con solicitudes GET reales y una sesión local ficticia: estado En línea,2 marcadores de reportes y50 puntos seguros. Las escrituras estaban bloqueadas por el servidor de QA.

### Límites y siguientes fases

- No se publicaron/eliminaron reportes ni se enviaron comentarios reales. Permanecen intactos los contratos y campos; falta prueba autenticada de persistencia.
- Google Sign-In real no se completó: el client ID existente no admite el origen local de prueba. No se cambió su configuración.
- No se verificaron WhatsApp/contacto real, carga de foto de extremo a extremo ni permisos en un dispositivo físico.
- El gesto del panel se probó con eventos de pointer en el smoke harness; falta validación táctil en hardware y lector de pantalla.
- No se ejecutó Android ni se probaron otros motores de navegador.
- Las siguientes fases pueden abordar diseño de formularios, detalle/comentarios y vistas secundarias, con referencias o capturas Android adicionales.
- Se puede evaluar separación del bundle de rutas y pruebas de accesibilidad/cross-browser como trabajo posterior.

## Evidencia

Se entregan `dashboard-desktop.jpg` (1440×900) y `dashboard-mobile.jpg` (390×844), con datos ficticios de prueba, además de este informe.

## Ajuste de limpieza de textos

Se retiraron los eslóganes del logo, la introducción de Explorar, el perfil y la ayuda. La cabecera del panel muestra el título funcional de la pestaña activa. Se simplificaron los pasos de ayuda y el estado de actualización, se eliminaron estilos sin uso y se redujo la altura máxima del panel de escritorio a 560px. La compilación posterior pasó con las mismas advertencias no bloqueantes de Astro/Vite. Esta revisión no cambia la lógica del mapa ni la API.

Las capturas adjuntas corresponden a la entrega inicial, anterior a esta limpieza de textos. La compilación de esta revisión generó ambas páginas en 9.75s.

## Reorganización de filtros y accesos

Se eliminó el botón de abrir filtros del buscador y el acceso duplicado a Cómo funciona del perfil. La pestaña principal de ayuda permanece. Las categorías, cercanía, reportes propios y Limpiar filtros ahora están agrupados dentro de Explorar. Las categorías conservan desplazamiento horizontal; limpiar restablece la selección y el scroll al inicio.

Validación: npm run build pasó (3.43s), sintaxis JS correcta y CONFIG/ApiService/formulario original sin cambios. En navegador con datos ficticios: Electrónica muestra 2 reportes; Ropa muestra 1; limpiar vuelve a 7 y a Todos con scrollLeft=0. Se comprobó escritorio 1440×900, móvil 390×844 y 320×568; sin overflow horizontal y última tarjeta accesible. Capturas de esta revisión: dashboard-filtros-desktop.jpg y dashboard-filtros-mobile.jpg. Los datos de estas capturas son de prueba y no acreditan que se haya restablecido la API real.

## Reversión de ubicación de filtros

Por solicitud del usuario, las categorías vuelven a flotar sobre el mapa y Limpiar filtros vuelve a la cabecera de resultados de Explorar. Se conservan eliminados el botón de filtros del buscador y el acceso duplicado de ayuda del perfil. No se modificaron la API ni el servidor.
