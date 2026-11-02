# CI de LostNetWEB — Git Flow

Actualizado el 2 de noviembre de 2026 para `DavidMLora/LostNetWEB`.

Flujo previsto: **feature/* → PR → develop → PR → main → GHCR**.

Estado local: Astro 7.4.5; 47 pruebas unitarias y 20 de integración aprobadas; lint, YAML, instalación limpia y build correctos. `npm audit --audit-level=high` termina con exit 0: quedan **ocho moderadas transitivas de las herramientas de ESLint**, sin críticas, altas ni bajas. No se ejecutaron Docker, GitHub Actions ni publicaciones. Detalle: [CI_VALIDATION.md](CI_VALIDATION.md).

## Eventos, jobs y permisos

| Evento | Destino | Comportamiento |
| --- | --- | --- |
| push | develop o main | Cinco jobs de validación/empaquetado. Publicación solo si es main del repositorio original y todo pasa. |
| pull_request | develop o main | Se valida al abrir, sincronizar commits o reabrir el PR. No publica. |
| workflow_dispatch | Rama seleccionada | Valida y empaqueta. No publica, aunque se seleccione main. |
| push | feature/* | No activa este workflow. Abrir el PR hacia develop activa las comprobaciones. |

Los seis jobs y sus dependencias se conservan:

```text
analisis-estatico ─────────┐
vulnerabilidades ─────────┤
pruebas-unitarias ────────┤── empaquetado ── publicar
       └─ pruebas-integracion ─┘
```

- `analisis-estatico`: ESLint recomendado JS/Astro y validación estructural del YAML.
- `vulnerabilidades`: auditoría completa con `npm audit --audit-level=high`. No oculta fallos ni omite dependencias de desarrollo.
- `pruebas-unitarias`: utilidades reales y políticas de seguridad/Git Flow del workflow.
- `pruebas-integracion`: cliente HTTP y multipart existente con MSW; depende de unitarias.
- `empaquetado`: depende de las cuatro anteriores. Compila salida estática, construye una imagen sin publicar y ejecuta un smoke del contenedor.
- `publicar`: depende de empaquetado; solo push a `refs/heads/main` en `DavidMLora/LostNetWEB`.

Todos preparan Node desde `.nvmrc`, hacen checkout sin credenciales persistidas e instalan con `npm ci`. Las acciones mantienen sus SHAs fijados. `contents: read` es el permiso general; únicamente publicar tiene `packages: write` y usa `GITHUB_TOKEN`. No hay `pull_request_target`, filtros por archivos ni condiciones que excluyan los jobs/pasos de validación en un PR normal. Si falla una dependencia, los jobs posteriores se omiten por fallo previo; eso no es una aprobación de sus comprobaciones.

Los nombres explícitos de los checks son estables y coinciden con sus IDs. Exige **los cinco primeros**, no solo empaquetado: un job omitido no demuestra que sus dependencias hayan pasado. **No exijas publicar en los PR**, pues se omite deliberadamente en esos eventos.

## Entorno y comandos locales

Node 24.16.0, npm 11.x, Astro 7.4.5, Vite 8.3.5 y Tailwind 4.3.3. Se fija Astro exactamente y el árbol completo se conserva en package-lock.json. `output: 'static'` y `compressHTML: true` mantienen salida estática y el comportamiento previo de espacios HTML. El frontend usa el mismo código, API y reglas de negocio.

```sh
npm ci
npm run test:unit
npm run test:integration
npm run lint
npm run check:ci
npm audit --audit-level=high
npm run build
npm run check:build
```

`npm test` ejecuta ambas suites. MSW usa `https://lostnet.test/api` y falla ante solicitudes no manejadas: no se contacta producción. El umbral alto de la auditoría es el original; un exit 0 con ocho moderadas **no significa cero vulnerabilidades**. El diagnóstico `npm audit --audit-level=moderate` aún falla.

La caché npm y los respaldos se mantienen bajo `.ci-local/`, ignorada por Git y Docker. En Windows/OneDrive, si npm informa EPERM sobre un node_modules antiguo, no fuerces borrados ni ejecutes reparaciones globales. En esta revisión se conservó el árbol anterior en un respaldo dentro del proyecto y se comprobó una instalación limpia.

Docker mantiene builder Node 24.16.0-alpine y Nginx para servir solo dist. El lock contiene los bindings GNU/musl del compilador y del bundler. Esto es una revisión de compatibilidad; no sustituye construir la imagen en Linux. Con Docker/Bash disponibles:

```sh
docker build -t lostnetweb:ci .
bash scripts/smoke-container.sh lostnetweb:ci
```

El smoke usa un contenedor efímero y comprueba login, `/dashboard`, `/dashboard/`, favicon, 404 y `nginx -t`, sin publicar ni ejecutar JavaScript contra la API.

## 1. Crear develop desde main — solo por el propietario

`develop` no existe localmente y no se creó durante esta tarea. Las referencias remotas locales tampoco la muestran; comprueba GitHub, porque no se hizo fetch para actualizar esa lista.

Para no alterar el directorio local que aún tiene cambios sin commit:

1. Abre `DavidMLora/LostNetWEB` en GitHub y revisa que `main` sea la base estable correcta.
2. En **Code → selector de ramas**, selecciona `main`.
3. Escribe `develop`; si no existe, elige **Create branch: develop from main**. Si ya existe, comprueba su historial antes de reutilizarla.
4. En GitHub Desktop puedes actualizar las referencias con **Fetch origin**. No cambies de rama dejando atrás modificaciones sin decidir dónde conservarlas.

Ninguno de esos pasos fue ejecutado por Codex. Si prefieres Git por terminal, crea develop desde main únicamente cuando el árbol esté limpio, actualizado y hayas decidido publicar esa nueva rama; no copies comandos de cambio de rama sobre el estado actual sin revisar los cambios.

## 2. Publicar la implementación mediante un PR

1. En GitHub Desktop revisa todos los cambios actuales. Parte del CI anterior todavía está sin versionar: incluye también API, tests, configuraciones y Docker del trabajo anterior que sean necesarios, no solo los ocho archivos de esta corrección.
2. Excluye `.ci-local/`, node_modules, dist, secretos y las copias de documentos que no quieras versionar. No agregues todo a ciegas.
3. Crea una rama `feature/ci-gitflow` desde la base adecuada. Si Desktop pregunta, lleva las modificaciones revisadas a esa rama para preservarlas. Este paso lo realiza el propietario; no se cambió main localmente durante la tarea.
4. Haz el commit revisado y **Publish branch** solo cuando autorices su envío.
5. Abre un PR con **base: develop**, **compare: feature/ci-gitflow**. Describe la migración, el resultado de las pruebas, las ocho moderadas y los límites de Docker.
6. El PR incluye el nuevo workflow: debería mostrar los checks en **Checks**. Si requiere autorización para ejecutar workflows de una contribución, un propietario debe revisar y autorizar la ejecución; no cambies a pull_request_target para evitar ese control.

## 3. Comprobar PR hacia develop

1. En el PR confirma que la base sea develop y que el workflow del commit tenga `pull_request.branches: [main, develop]`.
2. Abre **Checks → LostNetWEB CI**. Deben aparecer los cinco nombres de validación y empaquetado.
3. Revisa los logs: checkout, versión de Node, npm ci, números de tests, lint y auditoría. En empaquetado verifica el build Docker y el smoke real.
4. Publicar debe quedar **Skipped** porque es un PR. Esto es correcto.
5. Añadir y publicar otro commit en la misma feature debe crear una ejecución nueva por synchronize. El último commit debe tener checks completos antes de integrar.
6. Se revisó esta política localmente mediante YAML y tests; una ejecución real en GitHub todavía está pendiente.

## 4. Proteger develop y main

Después de que los checks aparezcan por primera vez, configura una regla separada para cada rama, si tu plan/permisos lo permiten:

1. En **Settings → Branches → Add branch protection rule** (o **Rules → Rulesets**, según la interfaz), usa el patrón exacto `develop`; repite para `main`.
2. Activa **Require a pull request before merging**. Configura aprobaciones acordes al equipo; exige revisión en main cuando haya un revisor disponible.
3. Activa **Require status checks to pass before merging** y selecciona, del workflow de esta aplicación:
   - `analisis-estatico`
   - `vulnerabilidades`
   - `pruebas-unitarias`
   - `pruebas-integracion`
   - `empaquetado`
4. Activa que la rama esté actualizada antes de integrar si esa es la política del equipo. No habilites merge queue sin añadir después soporte al evento merge_group, que no forma parte de esta entrega.
5. Mantén prohibidos force push y borrado de ambas ramas; evita bypasses de las protecciones cuando sea viable. Usa nombres únicos de jobs si incorporas otros workflows.
6. No añadas `publicar` como check requerido para PR. Tampoco exijas un despliegue que este pipeline no realiza.
7. Guarda las reglas y confirma, mediante un PR normal, que no permite integrar si falla alguno de los cinco checks. No se modificó ninguna protección remota en esta tarea.

La condición de publicar identifica un push a main; la autorización humana de ese push/merge debe garantizarla el acceso y protección configurados en GitHub. El YAML por sí solo no sustituye la revisión de un PR.

## 5. Interpretar fallos

- **analisis-estatico:** revisa archivo/línea de ESLint o la aserción del validador YAML. Este rechaza ramas incorrectas, pasos de PR omitidos, permisos excesivos y bypasses del guard de publicación.
- **vulnerabilidades:** npm audit exit 1 bloquea al superar el umbral alto. Lee el advisory; no uses force ni bajes el umbral. Las ocho moderadas pendientes se documentan aunque actualmente no hagan fallar ese umbral.
- **pruebas-unitarias/integracion:** revisa el caso fallido. Una solicitud MSW no manejada es un fallo del contrato/fixture; no habilites acceso real a producción.
- **empaquetado:** comprueba logs de Astro, Docker y Nginx. Un fallo aquí puede revelar un problema Linux/musl que no se detectó en Windows. Si figura Skipped, revisa primero todos sus jobs de needs.
- **publicar:** Skipped en PR/manual/develop es lo esperado. En push a main, `403` puede indicar restricciones de la organización o falta de acceso del repositorio a un paquete existente.
- **Pending:** confirma evento/base de rama y que no haya una ejecución cancelada por un commit más reciente. Los checks exigidos deben existir en la ejecución del último commit.

## 6. Integrar develop en main

1. Cuando el PR de la feature hacia develop pase todos los checks reales y esté revisado, el propietario puede integrarlo.
2. El push resultante a develop vuelve a validar, sin publicar.
3. Abre otro PR con **base: main**, **compare: develop**. Revisa todos los cambios acumulados, incluidos conflictos y migraciones.
4. Espera de nuevo los cinco checks y las revisiones de main. No se publica desde este PR.
5. Solo cuando autorices la publicación, integra ese PR. El push resultante a main activa las validaciones y, si todas pasan, GHCR.

## 7. Verificar GHCR

En el push a main del repositorio original, el único job con escritura de paquetes utiliza GITHUB_TOKEN y las acciones oficiales de Docker. Se generan:

- `ghcr.io/davidmlora/lostnetweb:sha-<SHA completo del commit de main>`
- `ghcr.io/davidmlora/lostnetweb:latest`

Comprueba el log de publicar y su digest; en **Packages → lostnetweb**, revisa ambas etiquetas y la revisión OCI del commit de main. Un paquete puede seguir siendo privado. Si ya existía y devuelve 403, revisa **Package settings → Manage Actions access**; si una política de organización limita Actions/Packages, el propietario debe resolverla. No es necesario crear un PAT para el flujo previsto.

El botón **Actions → LostNetWEB CI → Run workflow** solo estará disponible cuando el workflow esté en la rama predeterminada. Manual permite validar/empaquetar, pero nunca publica. Publicar una imagen tampoco despliega la web ni cambia el servidor.

Referencias oficiales: [Astro 6](https://docs.astro.build/en/guides/upgrade-to/v6/), [Astro 7](https://docs.astro.build/en/guides/upgrade-to/v7/), [protección de ramas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [Docker Actions](https://docs.docker.com/build/ci/github-actions/).
