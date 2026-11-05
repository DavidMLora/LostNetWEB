# Corrección del smoke de Nginx en empaquetado

Fecha: 2 de noviembre de 2026. Alcance: scripts/smoke-container.sh; no se modificaron Dockerfile, nginx.conf, frontend, dependencias ni jobs del workflow.

## Evidencia y diagnóstico

Se consultó en modo de solo lectura el [job 125441292954 de la ejecución 41493060965](https://github.com/DavidMLora/LostNetWEB/actions/runs/41493060965/job/125441292954?pr=4), correspondiente al PR 4 hacia develop. También se leyó el script en el commit de merge `27c38c251a225fc68c1beb5693792f804ab93ed1`: coincide con el script local anterior.

El log confirma instalación/build/check y construcción de la imagen. El smoke comenzó a las 17:40:06.295 UTC y falló a las 17:40:06.585 UTC contra 127.0.0.1:80, con exit 7. No hay agotamiento de los diez reintentos iniciales ni logs/estado del contenedor o cabecera Location en esa ejecución.

La causa más probable es la redirección de directorio de `/dashboard` a `/dashboard/`. Nginx escucha en el 80 del contenedor y puede producir una redirección absoluta sin el puerto externo aleatorio. El curl inicial usa el puerto publicado; el posterior curl --location sigue la URL absoluta hacia el puerto 80 del host. Añadir reintentos solo al primer GET no corrige ese cambio de destino.

**El mecanismo se reprodujo localmente** con un servidor HTTP de prueba y curl real: login en el puerto efímero correcto, respuesta 301 de /dashboard hacia http://127.0.0.1/dashboard/ y fallo de la solicitud antigua con exit 7 hacia el 80. La corrección permite completar ambas rutas. El servidor de prueba simula la redirección; no se ejecutó Nginx/Docker localmente. Como el log original no incluye Location, la atribución exacta de ese run sigue siendo una inferencia sustentada y debe confirmarse con los nuevos diagnósticos.

No hay evidencia de una caída prematura de Nginx que justifique cambiar su configuración. Por eso Dockerfile y nginx.conf se conservaron. El arranque y la salud real deben observarse en el runner al probar la corrección.

## Cambios del script

- Conserva `--publish 127.0.0.1::80`: puerto externo libre y exposición solo por loopback.
- Obtiene y muestra el mapping real con docker port. Exige exactamente `127.0.0.1:<puerto>`, puerto numérico entre 1 y 65535. Rechaza salida vacía, ambigua o inválida antes de construir la URL.
- Comprueba `.State.Running`, muestra el estado completo y ejecuta nginx -t antes de probar HTTP. Si el contenedor se detiene, falla y muestra estado/ExitCode/OOM, mapping y últimas 80 líneas de logs.
- Espera disponibilidad con un máximo de veinte intentos y timeouts de conexión/transferencia, comprobando que el contenedor siga vivo en cada intento.
- Usa `curl --connect-to 127.0.0.1:80:127.0.0.1:<puerto-publicado>` para que solo la conexión a ese destino interno de loopback viaje por el mapping real. No cambia Host ni la URL HTTP, no acepta otros hosts/puertos y mantiene el seguimiento de redirecciones y los checks de contenido.
- Añade reintentos acotados también a dashboard, favicon y 404. HTTP 500 persistente y errores de red siguen siendo fallos. Para 404 conserva la comprobación exacta del código.
- Registra cabeceras de login/dashboard y muestra esas cabeceras al fallar, además del puerto de socket usado en cada dashboard. Permite ver Location y distinguir un fallo de arranque de una redirección al puerto incorrecto.
- Registra el trap EXIT antes de docker run y recupera el ID desde cidfile si el arranque se interrumpe. Limpia en éxito/error y en INT/TERM; conserva el exit original y falla también si no puede retirar el contenedor. Los `|| true` están limitados a diagnósticos para que no impidan la limpieza, nunca a las pruebas.

La adaptación de conexión es específica del smoke que usa un puerto NAT aleatorio. No prueba que una configuración externa de proxy/dominio genere URLs públicas correctas; esa configuración no forma parte de esta corrección. Ningún script puede garantizar limpieza si el proceso/runner recibe SIGKILL o desaparece; el trap cubre las salidas y señales capturables habituales.

## Validaciones locales

| Comprobación | Resultado |
| --- | --- |
| Sintaxis Bash | Parser de gramática Bash mvdan-sh 0.10.1: válida; además rechazó una muestra deliberadamente inválida. Herramienta temporal bajo .ci-local, sin dependencia añadida al proyecto. |
| bash -n nativo | Git Bash no pudo arrancar por acceso denegado a un objeto MSYS. WSL tampoco está accesible. No se presenta como aprobado. |
| Reproducción original | Curl real: login correcto, luego redirección hacia 80 falla con exit 7. |
| Rutas corregidas | /dashboard y /dashboard/ retornan el HTML esperado usando las opciones extraídas del nuevo script. |
| Login, favicon, 404 | Respuestas y contenido/código esperados con servidor local de prueba. |
| Reintento posterior al login | Favicon simulado 503 y después 200: dos solicitudes, éxito. |
| Fallos genuinos | HTTP 500 persistente devuelve exit 22; redirección a puerto inesperado falla; respuesta 200 en lugar de 404 se rechaza. |
| YAML/política CI | npm run check:ci: correcto; conserva seis jobs y restricciones de publicación. |
| Dockerfile/nginx/workflow/package/lock | Hashes idénticos al inicio de esta tarea. |
| Docker real | No disponible; no se ejecutaron contenedor, arranque de Nginx, traps de limpieza ni smoke completo con Bash/Docker localmente. |

Son diez escenarios HTTP locales, más la comprobación de sintaxis. No equivalen a diez ejecuciones del script completo: se probaron el transporte curl y las respuestas con las opciones tomadas del script. Los diagnósticos y el ciclo de vida Docker se inspeccionaron en el código, pero requieren la ejecución real siguiente.

Resultados temporales y copia anterior: `.ci-local/smoke-fix-20261102/`. El parser está deprecado upstream; se utilizó únicamente como alternativa local de gramática, no como runtime Bash ni dependencia de CI. No se actualizaron package.json ni package-lock.json.

## Qué verificar en GitHub

Después de que el propietario revise y autorice subir la corrección al PR, la nueva ejecución debe mostrar:

1. ID del contenedor, mapping 127.0.0.1:puerto, URL y estado Running true.
2. nginx -t satisfactorio, disponibilidad del login y ambos dashboard con HTTP 200. El socket de las redirecciones debe seguir usando el puerto publicado.
3. Favicon, 404 exacto y mensaje final de comprobaciones aprobadas.
4. Si falla, estado/ExitCode, logs de Nginx y cabeceras Location, antes de retirar el contenedor. Esas pruebas distinguirán una caída real de la hipótesis de redirección.
5. Retirada efectiva del contenedor temporal. En un PR a develop, publicar debe seguir omitido.

Solo se consultó la ejecución ya existente. No se lanzó ni reintentó un workflow remoto, no se publicó nada y no se hicieron commits, push, PR o cambios de rama.

Referencias oficiales: [puertos publicados de Docker](https://docs.docker.com/reference/cli/docker/container/port/), [redirecciones de Nginx](https://nginx.org/en/docs/http/ngx_http_core_module.html#port_in_redirect), [curl --connect-to](https://curl.se/docs/manpage.html#--connect-to).
