# CI de LostNetWEB — validación de Git Flow y migración

Actualizado el 2 de noviembre de 2026. Sustituye los resultados de la implementación anterior. Proyecto: `DavidMLora/LostNetWEB`; rama local actual: main. No se crearon ramas, commits, PR, publicaciones ni cambios remotos.

**Resultado actual:** Astro 7.4.5, instalación limpia correcta, 47 pruebas unitarias y 20 de integración aprobadas, lint/YAML/build correctos. La auditoría con umbral alto ahora termina con **exit 0**, con **ocho moderadas pendientes, cero críticas, cero altas y cero bajas**. Docker, Nginx dentro del contenedor, Actions y GHCR no se ejecutaron.

## Archivos cambiados en esta corrección

| Archivo | Cambio |
| --- | --- |
| `.github/workflows/ci.yml` | Push y PR únicamente hacia main/develop; manual; seis nombres de jobs explícitos y estables, con dependencias y permisos conservados. |
| `scripts/check-ci.mjs` | Validador exportable; exige Git Flow, cinco checks sin condiciones que omitan PR, permisos mínimos y guard exacto de publicación. |
| `tests/unit/ci-policy.test.js` | Nuevo: 18 pruebas que aceptan la política válida y rechazan triggers incorrectos, skips, bypasses, permisos excesivos y ausencia de gates. |
| `package.json` | Astro fijado en 7.4.5; no se actualizó el resto de dependencias directas ni se cambiaron scripts/motores. |
| `package-lock.json` | Árbol de Astro 7 y transitivas compatibles, sin overrides ni reparaciones forzadas. |
| `astro.config.mjs` | Salida estática explícita y compressHTML true para conservar los espacios del HTML anterior. Tailwind conserva su configuración. |
| `docs/CI_PIPELINE.md` | Guía actual de Git Flow, protección de ambas ramas, PR, integración y GHCR. |
| `docs/CI_VALIDATION.md` | Este informe actualizado con resultados y límites reales. |

Se conservaron los cambios sin commit de la entrega anterior. También se preservaron las copias de documentos terminadas en “- copia.md” encontradas al inicio. Los archivos del frontend bajo src —incluidos autenticación, mapa, formulario, cliente HTTP y estilos— no se modificaron en esta corrección. Tampoco cambiaron Dockerfile, Nginx, .nvmrc, .npmrc ni los contratos/URL de la API.

## Referencia reversible y análisis previo

Antes de cambiar dependencias se guardaron 54 archivos y un manifiesto SHA256 en `.ci-local/gitflow-astro7-20261102/backup` y `manifest.json`. Se conservaron asimismo el estado inicial de Git y la salida estática anterior. Todo está dentro del proyecto e ignorado por Git/Docker.

Se revisaron las guías oficiales de Astro 6 y 7 y el uso real del proyecto. No hay adapters/SSR, colecciones de contenido, middleware, Astro.glob, ClientRouter, integración Markdown, Image/getImage ni acceso directo a Zod que necesiten migración funcional. Se examinaron los cambios de orden de estilos/scripts y de espacios HTML; se fijó compressHTML true. La configuración ya es ESM. No se ejecutó una instalación intermedia vulnerable de Astro 6: se evaluaron sus incompatibilidades y se probó primero una candidata aislada de Astro 7.4.5.

La candidata pasó tests, lint, build estático y auditoría de umbral alto antes de adoptarse. Node 24.16.0 satisface el engine de Astro 7.4.5 (>=22.23.4); Tailwind/plugin 4.3.3 admite Vite 8, Vitest 5.1.0 admite Vite 8 y Node 24. ESLint 10.14.0 y eslint-plugin-astro 3.2.1 pasan sin desactivar reglas. El nuevo lock resuelve Vite 8.3.5, sharp 0.35.5 y Zod 4.6.7.

El primer npm install en el directorio principal falló con EPERM al retirar node_modules/astro bajo OneDrive. No se borraron fuentes ni se detuvieron procesos del usuario. Se verificaron las rutas y se trasladó reversiblemente el árbol anterior a `.ci-local/gitflow-astro7-20261102/node_modules-before`. Después, **npm ci en la raíz del proyecto instaló 354 paquetes con exit 0**. Ese árbol desplazado es un respaldo adicional tras el intento fallido, no sustituye la referencia reproducible del package.json/lock original.

Para revertir manualmente, primero revisa los cambios posteriores y copia solo los siete archivos modificados desde backup a sus rutas originales. Archiva la prueba nueva ci-policy.test.js si también reviertes el validador; el validador anterior no exportaba la función que esa prueba importa. Después reinstala desde el lock restaurado. No uses reset, clean ni sobrescribas cambios nuevos sin revisarlos. No se ejecutó una reversión.

Fuentes: [guía Astro 6](https://docs.astro.build/en/guides/upgrade-to/v6/), [guía Astro 7](https://docs.astro.build/en/guides/upgrade-to/v7/). Compatibilidad de versiones contrastada además con los manifests publicados en npm y la instalación real.

## Resultados locales nuevos

| Verificación | Comando o método | Resultado real | Pendiente |
| --- | --- | --- | --- |
| Instalación limpia | npm ci --no-audit --no-fund, raíz | Exit 0, 354 paquetes | Linux/Alpine no ejecutado. La auditoría se ejecutó separadamente. |
| Unitarias | npm run test:unit | **47/47**, dos archivos: 29 utilidades + 18 política CI | No equivale a ejecutar Actions. |
| Integración | npm run test:integration | **20/20**, un archivo | Backend simulado; sin solicitudes a producción. |
| Lint | npm run lint | Exit 0, cero errores y avisos | Sin revisión completa de seguridad de aplicación. |
| YAML y estructura | npm run check:ci | Exit 0; seis jobs, DAG, ramas, permisos y guard de publicación válidos | No ejecuta las expresiones en GitHub. |
| Auditoría requerida | npm audit --audit-level=high --json | **Exit 0**, cero críticas/altas/bajas, ocho moderadas | No significa cero vulnerabilidades. |
| Diagnóstico adicional | npm audit --audit-level=moderate --json | **Exit 1**, ocho moderadas | Pendiente actualización compatible del árbol de ESLint. |
| Build | npm run build | Exit 0, dos páginas estáticas, 24.86 s en la validación principal | Aviso de bundle cliente >500 kB; no ocultado. |
| Salida | npm run check:build | Exit 0: login, dashboard, componentes y assets presentes | No reemplaza pruebas E2E. |
| Compatibilidad Docker/Node/lock | Lectura y aserciones Node | Pin 24.16.0 coincidente, lock coherente y bindings Linux GNU/musl presentes | No prueba que la imagen se construya. |
| Docker | Búsqueda de CLI y ruta de Docker Desktop | No disponible | Build y ejecución de imagen, nginx -t y smoke pendientes. |
| Sintaxis Bash del smoke | Git Bash -n scripts/smoke-container.sh | No pudo arrancar: acceso denegado a objeto MSYS, exit -1073741502 | No se marca como aprobado. |
| Conservación de fuentes | SHA256 contra manifiesto inicial | Todos los archivos src preservados; API/autenticación/mapa/formulario sin edición | No prueba integraciones externas reales. |
| Git Flow remoto | Sin ejecución remota | No se creó develop ni se configuraron protecciones | El propietario debe hacerlo. |
| Actions/GHCR | Sin ejecución/publicación remota | No ejecutados | Evidencia real de runner, contenedor, digest y etiquetas. |

Logs y auditorías: `.ci-local/gitflow-astro7-20261102/`. Los comandos de pruebas, lint, YAML, build y salida estática se ejecutaron también en la candidata aislada; los números finales de 47/20 corresponden al proyecto principal ya migrado.

## Pruebas del navegador con el build de Astro 7

Se sirvió el build local con una capa temporal de fixtures, situada fuera de producción y dentro de .ci-local, que intercepta la API. No se añadieron mocks al frontend entregado.

- En 1280×720: ocho tarjetas únicas y seis marcadores de reporte más dos puntos seguros. Las medidas, posiciones, display, tamaño de letra y radio de panel, primera tarjeta y búsqueda coincidieron exactamente con el build anterior medido en la misma sesión.
- Filtro Electrónica: una tarjeta y un marcador; limpiar restauró el conjunto. Seleccionar la tarjeta abrió el popup correcto y este permitió abrir detalles.
- Detalle: carga de comentarios, email enmascarado y ausencia de la respuesta de seguridad en el DOM. Un doble clic al enviar generó **un solo POST de comentario**, con confirmación y tres comentarios visibles tras recargar la lista.
- Creación: selección de punto en el mapa, errores por foto/descripción ausentes, descripción, cambio a FOUND, categoría Electrónica, fotografía y vista previa. Un doble clic generó **un solo POST simulado de reporte**, con los once campos de texto existentes (incluido timestamp) y foto, seguido de “Reporte publicado” y “Volver al mapa”.
- La foto de prueba fue el favicon público del proyecto; el mock registró nombre, MIME y 91418 bytes. No se subió una fotografía ni un reporte a producción.
- Se comprobaron retorno al mapa, botones GPS/zoom y cierre de detalles con Escape. GPS fue simulado, no ubicación real del usuario.
- En 390×844 se inspeccionó el detalle: sin desbordamiento horizontal, cierre y envío dentro del viewport. La emulación se restableció después.
- Sin sesión de prueba, entrar a dashboard redirigió al login. No se inició sesión real con Google ni se valida OAuth completo.
- No se observaron errores JavaScript en los logs de la sesión autenticada revisada. No se verificaron rutas externas de conducción/a pie, WhatsApp real, borrado, teclado físico móvil ni una matriz completa de navegadores.

El registro del servidor local muestra un comentario y un reporte, ninguna eliminación y producción deshabilitada. Estas pruebas son una comprobación de regresión limitada y no una certificación de todas las funcionalidades.

## Vulnerabilidades actuales y decisión

| Severidad | Antes | Ahora |
| --- | --- | --- |
| Crítica | 1 | 0 |
| Alta | 3 | 0 |
| Moderada | 8 | 8 |
| Baja | 1 | 0 |

La migración elimina los avisos anteriores de Astro/sharp/Zod y el esbuild antiguo del árbol afectado. La auditoría completa permanece habilitada con el mismo umbral alto y sin continue-on-error, omisión de desarrollo, rebaja del umbral, overrides ni audit fix --force.

Las ocho dependencias señaladas actualmente son minimatch, ESLint, @eslint/js, @eslint/config-array, @eslint-community/eslint-utils, @typescript-eslint/parser, @typescript-eslint/typescript-estree y eslint-plugin-astro. Es la propagación de un aviso moderado en minimatch 10.2.6, no ocho fallos independientes. El advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) fija 11.0.1 como corregida. ESLint declara ^10.2.6 y config-array ^10.2.4; la versión 11 queda fuera de sus rangos.

Se consultaron las versiones publicadas actuales de ESLint/parser/config-array y no hay una actualización ordinaria compatible que elimine ese aviso. Las soluciones sugeridas por audit incluyen retroceder herramientas a versiones incompatibles; no se aplicaron. Tampoco se forzó minimatch 11 dentro de dependencias ajenas. Se conserva este pendiente hasta que exista soporte upstream o una actualización probada del conjunto de lint. El diagnóstico con umbral moderado deja constancia explícita del fallo restante.

## Git Flow y branch protection

Los eventos ahora son push a main/develop, pull_request hacia main/develop y manual. No hay push para feature. Los seis jobs conservan sus dependencias, y los cinco primeros no tienen filtros/condiciones que excluyan los PR normales. Los nombres estables permiten exigir todos estos checks en ambas ramas:

`analisis-estatico`, `vulnerabilidades`, `pruebas-unitarias`, `pruebas-integracion`, `empaquetado`.

Publicar no debe ser requerido en PR: queda omitido por diseño. Si falla una validación, sus dependientes pueden quedar omitidos; se deben exigir los checks anteriores para que un skip posterior no sustituya un fallo upstream. El validador y sus 18 pruebas comprueban esa configuración, sin afirmar una ejecución en GitHub.

No existe develop localmente ni en las referencias remotas locales observadas. La guía [CI_PIPELINE.md](CI_PIPELINE.md) explica, paso a paso y sin ejecutar operaciones por el usuario: crear develop desde main en GitHub, preservar el directorio con cambios, publicar feature/ci-gitflow con la implementación completa, abrir PR a develop, comprobar Checks, proteger ambas ramas, resolver fallos y abrir PR develop→main. Describe también los requisitos de permisos del paquete GHCR y cómo verificar el digest y etiquetas.

El guard exacto de publicación exige push, refs/heads/main y DavidMLora/LostNetWEB, además del éxito implícito de empaquetado y sus cuatro dependencias. Solo ese job tiene packages: write. Se mantienen GITHUB_TOKEN, nombre GHCR en minúsculas, etiqueta por SHA completo y latest exclusivamente en main. La autorización humana de integrar/pushear main depende de los permisos y protecciones que configure el propietario; no se crearon configuraciones remotas ni un despliegue.

## Límites que siguen vigentes

- Ocho moderadas transitivas aún no corregidas; gate alto operativo, sin declarar auditoría vacía.
- Docker/Nginx y smoke pendientes de ejecución Linux real; Bash local no pudo arrancar.
- GitHub Actions, protecciones, develop y publicación GHCR pendientes de actuación autorizada del propietario. La comprobación local no garantiza esos resultados remotos.
- Backend y Google reales no verificados; todas las escrituras de pruebas fueron simuladas. Fuentes funcionales y URLs preservadas.
- npm ci limpio resolvió el bloqueo EPERM local sin borrar el árbol previo ni tocar configuración global; el árbol activo node_modules y su respaldo bajo .ci-local ocupan espacio que el usuario puede revisar antes de limpiar manualmente.
- El aviso de tamaño del bundle continúa; no se introdujo una optimización funcional ajena a esta tarea.
