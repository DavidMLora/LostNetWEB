# LostNetWEB · Fase 2: creación de reportes

Proyecto: C:\Users\david\OneDrive\Escritorio\LostNetWEB  
Validación: 25 de octubre de 2026.

## Resultado y alcance

Se rediseñó únicamente la creación de reportes. El formulario ahora tiene un modal centrado, bordes redondeados, secciones claras, controles de categoría y tipo, vista previa de fotografía, estados de validación y publicación, y confirmación de éxito.

El encabezado y la publicación permanecen visibles mientras se desplaza el contenido. En móvil se adapta al ancho y al visualViewport para responder al espacio disponible cuando cambia la altura de la pantalla. No se rediseñaron el dashboard, la navegación, las alertas, los detalles ni los comentarios.

## Análisis previo y referencias

Se revisaron el formulario y su lógica actuales, incluyendo cambios de la Fase 1, antes de implementarlo.

Android fue consultado remotamente en el commit fdfa8bc217333812a99e589955e8286c26c72db9:

- [dialog_reporte.xml](https://github.com/AbrahamEsquivel/LostNet/blob/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/res/layout/dialog_reporte.xml): tarjeta blanca, radio de 28, campos outlined de radio 12, separación de 16–24, fotografía, seguridad y publicación.
- [MainActivity.java](https://github.com/AbrahamEsquivel/LostNet/blob/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/java/com/example/lostnet/MainActivity.java#L629): apertura del formulario, foto, campos, validación y envío.
- [MainActivity.java:665](https://github.com/AbrahamEsquivel/LostNet/blob/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/java/com/example/lostnet/MainActivity.java#L665) construye status como FOUND o LOST y lo envía en la solicitud.
- [LostNetApi.java](https://github.com/AbrahamEsquivel/LostNet/blob/fdfa8bc217333812a99e589955e8286c26c72db9/app/src/main/java/com/example/lostnet/LostNetApi.java#L39) define el multipart POST reportar con status y foto.
- AppConstants.java y RetrofitClient.java apuntan al mismo host y prefijo /api/ de la web.

El selector Perdido/Encontrado reutiliza ese campo status existente. Esta evidencia confirma el contrato usado por el cliente Android; no sustituye una prueba de persistencia real del servidor.

Se reutilizó Icon.astro sin modificarlo. El azul, la tipografía de sistema, los bordes y el estilo de enfoque siguen la Fase 1. No se añadieron dependencias.

## Archivos de esta fase

| Archivo | Cambio |
|---|---|
| src/components/ReportModal.astro | Nuevo componente del formulario y confirmación |
| src/styles/report-form.css | Estilos exclusivos del modal, responsive y estados |
| src/scripts/report-form.js | Validación, foto, borrador y estado de publicación |
| src/pages/dashboard.astro | Sustitución del markup antiguo por ReportModal |
| src/scripts/app.js | Integración con selección del mapa, sesión y publicación existentes |
| docs/DASHBOARD_PHASE2.md | Este informe |

La comparación automática contra el inicio de la fase confirmó que dashboard.css, dashboard-ui.js, Icon.astro, Layout.astro, global.css, astro.config.mjs y los archivos de dependencias permanecen idénticos. El resto del markup del dashboard también permanece idéntico.

## Contrato y validaciones conservados

No se cambiaron las URL, CONFIG ni ApiService. Se conserva POST /api/reportar como multipart con exactamente estas 12 partes cuando hay foto:

user_id, email, description, category, phone, security_question, security_answer, latitude, longitude, status, timestamp y foto.

| Dato | Comportamiento |
|---|---|
| Foto | Sigue siendo obligatoria en la web; archivo original sin conversión ni límite nuevo de tamaño |
| Descripción | Sigue siendo obligatoria y con máximo de 30 caracteres; se rechaza texto compuesto solo por espacios |
| Categoría | Mismos cuatro valores; Otros predeterminado, equivalente al valor del antiguo placeholder |
| Teléfono | Sigue siendo opcional; sin patrón ni longitud nuevos |
| Pregunta/respuesta | Siguen siendo opcionales; sin exigir completarlas en pareja |
| Respuesta | Oculta inicialmente, con control Mostrar/Ocultar |
| Ubicación | Conserva el punto elegido por clic; Cambiar permite elegir otro sin perder el borrador |
| Usuario/email | Se obtienen de la sesión existente; se vuelve a comprobar la sesión antes de publicar |
| Tipo | LOST predeterminado; FOUND disponible según el contrato Android existente |
| Timestamp | Se conserva el envío de segundos Unix de la web |

Las cadenas se envían como antes, incluidos campos opcionales vacíos. No se añaden campos a la API. La validación de fotografía rechaza MIME explícitamente no correspondiente a imagen y los errores de lectura, sin imponer formatos nuevos. Si el navegador no puede decodificar la vista previa, conserva el archivo adjunto y muestra una nota; la aceptación final corresponde al servidor.

## Mejoras de interacción

- Etiquetas asociadas, errores inline, contador, enfoque visible y estados de validez.
- Selector nativo de categorías con teclado y valores existentes.
- Fotografía con vista previa, nombre, cambio y eliminación. Lecturas antiguas se abortan o ignoran para evitar carreras.
- Borrador conservado al cerrar, cambiar ubicación o recibir un error.
- Captura de FormData antes de deshabilitar campos.
- Bloqueo síncrono del envío antes del primer await; publicación deshabilitada durante la solicitud.
- Cierre disponible durante la publicación. La solicitud continúa y se impide iniciar otro reporte mientras siga pendiente.
- Confirmación solo después de una respuesta de éxito. Ante error se conserva el borrador y se restaura la publicación.
- Si el modal se cerró y después falla el envío, se muestra una notificación y se conserva el error para la siguiente apertura.
- Mensajes diferenciados para errores HTTP, exceso de solicitudes, timeout y red. No hay reintentos automáticos de POST ni confirmaciones tras errores de transporte.
- Se conserva la gestión de foco del modal, Escape y el ciclo de Tab de la aplicación.

## Pruebas realizadas

### Compilación y revisión

- npm run build: PASS. Última ejecución: 2 páginas estáticas, 4.42 segundos.
- node --check para app.js y report-form.js: PASS.
- Comprobaciones de normalización de errores: PASS.
- git diff --check: PASS.
- Comparación de CONFIG, SessionManager, ApiService, ViewModal, MapController, carga, render y eliminación de reportes: idénticos al inicio de esta fase.
- Formulario e integración limitados a la creación; sin código de fixtures en producción.

El build mantiene advertencias no bloqueantes de imports internos de Astro y tamaño del bundle de Leaflet/rutas. No se amplió el alcance para reorganizar esos módulos.

### Navegador con respuestas controladas

Se usó un servidor temporal fuera del repositorio. Inyecta una sesión ficticia y respuestas de prueba, e intercepta todas las escrituras al host de producción. No se enviaron fotografías ni reportes al backend real.

| Comprobación | Resultado |
|---|---|
| Apertura tras elegir punto y cierre | Correctos |
| Formulario vacío | Muestra errores de foto y descripción; no publica |
| Foto JPEG | Vista previa, nombre y control Quitar correctos |
| Quitar foto | Restablece placeholder y validación obligatoria |
| Cerrar/reabrir | Conserva descripción, foto y tipo |
| Cambiar ubicación | Cambia el punto y conserva el borrador |
| Tipo y categoría | FOUND/LOST y valores existentes capturados correctamente |
| Campos opcionales | Se pueden dejar vacíos; se enviaron como cadenas vacías |
| Respuesta secreta | Mostrar/Ocultar correcto |
| Descripción mayor de 30 | Error explícito; no publica |
| Descripción de espacios | Error explícito; no publica |
| Doble clic de publicación | Una sola solicitud; botón deshabilitado y carga visible |
| Éxito simulado | Confirmación visible y foco en Volver al mapa |
| HTTP 400 simulado | Error visible con foco, campos/foto conservados y botón restaurado |
| Cerrar durante petición fallida | Notificación visible; no empieza otro reporte mientras está pendiente |
| Sin sesión | Dashboard redirige al inicio de sesión |
| Tab y Shift+Tab | Ciclo entre controles del modal; cierre y publicación accesibles |
| Escape | Cierra y devuelve el foco |
| Escritorio | 1440×900, modal centrado con scroll interno |
| Móvil | 390×844 y 320×568, sin overflow horizontal |
| Horizontal | 667×375, cierre y publicación visibles; inputs de 16px |
| Altura reducida | 390×400, cierre, publicación y campo enfocado visibles |

Se capturaron tres solicitudes de prueba: una respuesta 200 para FOUND y dos respuestas 400 para LOST, la segunda cerrando durante el envío. Todas conservaron exactamente las 12 partes multipart. El doble clic generó una sola solicitud en su caso de prueba.

### Backend real y límites

Las consultas GET de configuración y reportes respondieron HTTP 200 al inicio de esta fase; había tres reportes LOST. Esto verifica lectura y accesibilidad en ese momento.

No se creó ningún reporte real. Por tanto, la persistencia real, la aceptación efectiva de FOUND y la subida al almacenamiento del backend quedan sin verificar de extremo a extremo. El éxito y los errores de publicación se validaron con respuestas simuladas.

Tampoco se completó un inicio de sesión Google real, ni se probó cámara o teclado físico de un teléfono. La altura reducida verifica el comportamiento del layout, pero no sustituye la prueba en hardware. No se probaron otros motores de navegador ni todos los formatos de imagen.

## Evidencia

Capturas entregadas:

- formulario-reporte-desktop.jpg
- formulario-reporte-mobile.jpg
- formulario-reporte-seguridad.jpg

Las capturas corresponden al entorno local con sesión y datos de prueba. La documentación y el diff de esta fase se entregan como archivos separados.
