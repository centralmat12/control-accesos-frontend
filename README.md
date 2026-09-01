# Control de Accesos - Frontend

## Descripción

Frontend del sistema de control de accesos y fichadas biométricas (proyecto de tesis). Es un panel de administración que se ejecuta en el navegador y se comunica con una API ASP.NET Core. **No accede a la base de datos**: solo consume HTTP.

## Tecnologías

Definidas en `package.json` y usadas en el código:

- **JavaScript** (módulos ES, vanilla; no usa React)
- **Vite** `^8.2.2` (servidor de desarrollo, build y preview)
- **Tailwind CSS** `^4.3.3` con el plugin `@tailwindcss/vite`
- **Fetch API** nativa del navegador (no se usa Axios)

La API (repositorio aparte) es ASP.NET Core. La persistencia está en MySQL, detrás de esa API.

## Requisitos para desarrollo

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) con `npm` (se recomienda una versión LTS actual; `package.json` no fija una versión mínima)
- No hace falta instalar ASP.NET Core / .NET, MySQL, Nginx ni Docker para correr **solo este frontend**, siempre que exista una API accesible a la cual conectarse

Este frontend es JavaScript vanilla: no usa React ni Axios.

## Guía rápida para levantar el frontend desde cero

Procedimiento ordenado para un integrante que clona el repositorio por primera vez. El detalle de cada variable de entorno está en [Configuración de API](#configuración-de-api).

### 1. Instalar herramientas necesarias

Para trabajar **únicamente** con este frontend hace falta:

- Git
- Node.js
- npm (se instala junto con Node.js)

No hace falta instalar en la PC local:

- ASP.NET Core / .NET
- MySQL
- Nginx
- Docker

siempre que la API (otro repositorio / otro equipo) esté accesible por red.

### 2. Verificar instalación

```powershell
git --version
node -v
npm -v
```

Los tres comandos deben mostrar una versión. Si alguno no se reconoce, Node o Git no están en el PATH (ver [Solución de problemas frecuentes](#11-solución-de-problemas-frecuentes)).

### 3. Clonar el proyecto

```powershell
git clone https://github.com/centralmat12/control-accesos-frontend.git
cd control-accesos-frontend
```

### 4. Crear configuración local

`.env.example` es la plantilla versionada (sin secretos). El archivo de trabajo local se crea así:

```powershell
Copy-Item .env.example .env.local
```

En macOS o Linux:

```bash
cp .env.example .env.local
```

**No subir `.env.local` al repositorio.** Git lo ignora mediante `*.local`.

### 5. Configurar conexión con la API

En `.env.local` hay dos valores:

```env
VITE_API_BASE_URL=
DEV_API_PROXY_TARGET=http://SERVIDOR_API:PUERTO
```

- `VITE_API_BASE_URL` es el prefijo que el frontend antepone a las rutas `/api/...`. En desarrollo suele dejarse **vacío** para que el navegador llame a `/api` en el mismo origen que Vite y el proxy reenvíe al backend.
- `DEV_API_PROXY_TARGET` es el destino de ese proxy (solo `npm run dev`; no se incrusta en el bundle del navegador). Si la API corre en la misma PC, puede usarse `localhost`. Si está en otra máquina, se indica su IP o nombre DNS.
- Si `DEV_API_PROXY_TARGET` no está definido, Vite usa el fallback de `vite.config.js`: `http://161.153.193.159:8080`.

Ejemplos (no son direcciones obligatorias):

API en la misma PC:

```env
VITE_API_BASE_URL=
DEV_API_PROXY_TARGET=http://localhost:8080
```

API en otro equipo de la red:

```env
VITE_API_BASE_URL=
DEV_API_PROXY_TARGET=http://192.168.1.50:8080
```

Si se cambia `.env.local`, hay que reiniciar `npm run dev`.

### 6. Instalar dependencias

```powershell
npm install
```

Instala lo declarado en `package.json`. Hoy las dependencias del proyecto son Vite, Tailwind CSS y el plugin `@tailwindcss/vite`.

### 7. Iniciar el frontend

```powershell
npm run dev
```

Vite imprime la URL, habitualmente:

```text
http://localhost:5173/
```

Si el puerto 5173 está ocupado, Vite elige otro: hay que abrir la URL que muestre la consola.

### 8. Verificación básica

Con el servidor en marcha, conviene comprobar:

- que aparece la pantalla de login;
- que la página carga sin errores evidentes en consola;
- que el login puede hablar con la API (credenciales reales de backend);
- que, con sesión iniciada, se abre el Dashboard;
- que Empleados y Fichadas consultan sus endpoints cuando el backend está disponible.

El **Dashboard** usa `GET /api/empleados` y `GET /api/fichadas` del día (no hay endpoint de resumen). Si una consulta de fichadas llega a 500 registros, los contadores de ese día pueden estar incompletos.

### 9. Compilar para producción

```powershell
npm run build
```

Genera la carpeta `dist/` con el frontend estático.

Para revisar ese build en local:

```powershell
npm run preview
```

`preview` **no** usa el mismo proxy que `npm run dev`. En un despliegue real conviene servir `dist/` y proxyear `/api` hacia el backend (por ejemplo con Nginx).

### 10. Después de descargar cambios del repositorio

```powershell
git pull
npm install
npm run dev
```

`npm install` conviene después de un `git pull` si pudieron cambiar `package.json` o `package-lock.json`.

### 11. Solución de problemas frecuentes

#### Node o npm no reconocido

```powershell
node -v
npm -v
where.exe node
```

Si Node está instalado y el comando no se reconoce, hay que revisar el PATH de Windows y abrir una terminal nueva.

#### El frontend abre pero la API no responde

Revisar que la API esté en ejecución, el valor de `DEV_API_PROXY_TARGET` (IP y puerto), conectividad de red, firewall y que el endpoint exista en el backend.

#### Cambié `.env.local` pero no tomó los cambios

Detener el proceso (Ctrl+C) y volver a ejecutar `npm run dev`.

#### Puerto 5173 ocupado

Vite puede elegir otro puerto. Usar la URL que imprime la consola.

### 12. Flujo resumido para un integrante nuevo

```text
Instalar Git + Node
        ↓
Clonar repositorio
        ↓
Crear .env.local
        ↓
Configurar API
        ↓
npm install
        ↓
npm run dev
        ↓
Abrir localhost
```

## Instalación, ejecución y compilación

Referencia corta de los mismos comandos (el contexto está en la guía anterior):

| Comando | Efecto |
| ------- | ------ |
| `npm install` | Instala dependencias |
| `npm run dev` | Servidor de desarrollo + proxy `/api` |
| `npm run build` | Compila a `dist/` |
| `npm run preview` | Sirve `dist/` en local (sin el proxy de `dev`) |

## Estructura del proyecto

```
src/
├── api/          Llamadas HTTP a la API (auth, empleados, fichadas, empresas, dashboard)
├── components/   Piezas de interfaz reutilizables (layout, tablas, formularios, iconos)
├── config/       Nombre de la app, menú y URL base de la API
├── utils/        Formato de fechas, período, paginación visual, CSV, jornadas y lectura de campos de la API
├── views/        Pantallas: login, dashboard, empleados, fichadas
├── app.js        Arranque, sesión y navegación entre vistas
├── main.js       Punto de entrada
└── style.css     Tailwind
```

No hay React ni enrutador de URLs: la navegación es por vistas en memoria.

## Configuración de API

La URL base se define en un solo lugar: `src/config/api.js`.

```
VITE_API_BASE_URL=
```

| Variable | Dónde se usa | Uso |
| -------- | ------------ | --- |
| `VITE_API_BASE_URL` | Frontend (Vite la inyecta en el build) | Prefijo de todas las rutas `/api/...`. En desarrollo conviene dejarla **vacía** para que el navegador llame a `/api` en el mismo origen y Vite proxyee al backend. En producción, si no hay proxy inverso, hay que definirla **antes** de `npm run build`. |
| `DEV_API_PROXY_TARGET` | Solo `vite.config.js` (no llega al navegador) | Destino del proxy en `npm run dev`. Si no está definida, se usa `http://161.153.193.159:8080`. |

Ejemplo de `.env.local` para desarrollo con proxy:

```
VITE_API_BASE_URL=
DEV_API_PROXY_TARGET=http://161.153.193.159:8080
```

**No subir `.env.local` al repositorio.** Está cubierto por `*.local` en `.gitignore`. El archivo versionado es `.env.example`, sin secretos.

## Estado actual

| Funcionalidad | Estado |
| ------------- | ------ |
| Interfaz principal (sidebar, header, layout) | Implementada |
| Navegación entre vistas | Implementada (sin rutas de URL) |
| Login | Integrado con la API real (`POST /api/Auth/Login`) |
| Sesión | JWT en `sessionStorage` (`ca.auth.token`) y usuario en `ca.auth.user` |
| Peticiones protegidas | Header `Authorization: Bearer <token>` |
| Empleados (listado, alta, detalle, baja lógica) | Integrado con la API |
| Fichadas (filtros server-side, período, jornadas, CSV, impresión) | Integrado con la API |
| Empresa (nombre en reportes de fichadas) | `GET /api/empresas` (si falla, la vista sigue y el nombre queda vacío) |
| Dashboard | Datos reales (`GET /api/empleados` + `GET /api/fichadas` del día). No hay endpoint de dashboard. |
| Áreas, Horarios, Dispositivos, Agentes | Solo ítems del menú; pantalla placeholder, sin API |

El frontend **no valida la firma** del JWT. Solo decodifica el payload para mostrar nombre, email, rol y `empresa_id`. Un **401** en una petición autenticada cierra la sesión y vuelve al login. La sesión sobrevive a recargar la pestaña; no sobrevive a cerrar el navegador.

### Endpoints que usa hoy el frontend

| Método | Ruta | Uso |
| ------ | ---- | --- |
| `POST` | `/api/Auth/Login` | Login (`{ email, password }`). La API responde un JWT en `token`. |
| `GET` | `/api/empleados` | Listado de empleados activos |
| `GET` | `/api/empleados/{id}` | Detalle |
| `POST` | `/api/empleados` | Alta |
| `DELETE` | `/api/empleados/{id}` | Baja lógica |
| `GET` | `/api/fichadas` | Fichadas con filtros opcionales `empleadoId`, `desde`, `hasta`, `tipo`, `metodo` y `limite` (el frontend envía `limite=500`, tope de la API). `hasta` es exclusivo. |
| `GET` | `/api/empresas` | Datos de empresa para reportes |

El frontend **no** llama a `GET /api/huellas/empresa/{id}`, `POST /api/empleados/enrolar`, `POST /api/fichadas/bulk` ni `POST /api/Auth/bootstrap`. No muestra `templateBiometrico` ni `templateHuellaBase64`.

## Consulta de fichadas

Flujo de la pantalla Fichadas:

```
Usuario
    ↓
Filtros (empleado, período, fechas, tipo, método)
    ↓
GET /api/fichadas (filtros server-side, máximo 500)
    ↓
Contadores, CSV, PDF y jornadas (todo el resultado de la consulta)
    ↓
Paginación visual (30 / 50 / 100) → tabla
```

- **Período:** Todos, Hoy, últimos 7/15/30/60/90 días o Personalizado. Los presets calculan `desde` y `hasta`. En Personalizado se usan los campos Desde/Hasta.
- **`hasta` exclusivo:** para incluir el día 2026-09-01 se envía `hasta=2026-09-02T00:00:00`.
- **Tipo / método:** si vale “Todos”, no se envía el query param. Si hay valor, se envía tal cual a la API (`Entrada`, `Salida`, `Biometrico`, `Manual`).
- **Empleado:** combobox buscable sobre `GET /api/empleados` (nombre, apellido, nombre+apellido, legajo; ignora mayúsculas, tildes y espacios extra). Al elegir una persona se envía `empleadoId`. “Todos los empleados” quita el parámetro. No hay un buscador textual aparte sobre las fichadas.
- **Paginación:** solo visual. No es paginación de backend. Movimientos y jornadas paginan por separado. Cambiar filtros, empleado, período o tamaño de página vuelve a la página 1.
- **CSV / PDF:** exportan el conjunto completo de la consulta, no la página visible.
- **Límite 500:** si la API devuelve exactamente 500 registros, se muestra un aviso. CSV, PDF y la pantalla no se presentan como histórico completo.

## Dashboard

No existe `GET /api/dashboard`. El resumen se arma en el cliente:

- empleados activos → cantidad de `GET /api/empleados` (la API ya devuelve solo activos);
- fichadas de hoy, entradas, salidas y últimas fichadas → `GET /api/fichadas` con `desde` = inicio del día y `hasta` = inicio del día siguiente.

La tabla de últimas fichadas usa campos reales: empleado, legajo, fecha, hora, tipo y método. No se muestran área ni dispositivo porque `/api/fichadas` no los devuelve. Si el día llega a 500 registros, los contadores de fichadas pueden estar incompletos.

## Funcionalidades pendientes

- **Menú:** Áreas, Horarios, Dispositivos y Agentes todavía no tienen vista ni llamadas HTTP.
- **Empleados (backend pendiente):** edición, reactivar/listar inactivos, paginación, indicador de enrolamiento de huella **sin** exponer `templateBiometrico`. El enrolamiento se hace en el agente local, no en este panel.

No hay login mock ni Dashboard mock: autenticación y dashboard consultan la API.

## Arquitectura

```
Navegador (este frontend)
    ↓  HTTP / JSON
API ASP.NET Core
    ↓
Base de datos (MySQL)
```

El frontend nunca se conecta a MySQL ni ejecuta .NET. Solo habla con la API.

**Desarrollo:** el navegador pide `/api/...` al origen de Vite. Vite reenvía `/api` a `DEV_API_PROXY_TARGET`. Así se evita CORS mientras el origen del panel no coincida con el de la API.

**Producción:** lo habitual es servir `dist/` y proxyear `/api` al backend (mismo origen). Si el frontend estático llama a otra URL, hay que setear `VITE_API_BASE_URL` en el build y habilitar CORS en la API.

## Desarrollo futuro

Mejoras coherentes con el código actual:

- Implementar las pantallas que hoy son placeholder (áreas, horarios, dispositivos, agentes)
- Edición y reactivación de empleados cuando la API lo permita
- Paginación real / histórico completo de fichadas en backend (hoy el tope sigue siendo 500 por consulta)
- Roles y permisos aplicados también en backend (el frontend solo muestra el claim `role`)
- Manejo de errores más uniforme en todas las vistas

## Seguridad

- No guardar secretos (contraseñas, cadenas de MySQL, claves de firma JWT) en el frontend ni en archivos versionados
- No subir `.env.local` ni otros `.env` con datos reales
- Usar variables de entorno (`VITE_API_BASE_URL`, `DEV_API_PROXY_TARGET`)
- El JWT en `sessionStorage` es visible en el navegador: la autorización real debe validarse **siempre** en la API
- Este panel no debe consultar endpoints que expongan plantillas biométricas

## Evolución técnica previa (limpieza)

La sección siguiente documenta una limpieza anterior del repositorio (código muerto, HTTP centralizado, mock de Dashboard que **ya no aplica**). El estado vigente está en [Estado actual](#estado-actual), [Consulta de fichadas](#consulta-de-fichadas) y [Dashboard](#dashboard).

Esta versión del frontend no incorpora funcionalidades nuevas. Se hizo una revisión general del código existente para mejorar la **legibilidad**, la **mantenibilidad**, la **eliminación de código innecesario**, la **reducción de duplicación**, la **claridad de arquitectura** y la **facilidad de comprensión** para quienes continúen el proyecto o lo presenten en una defensa académica.

### Antes de la optimización

- Quedaban archivos residuales de la plantilla inicial de Vite.
- Había mocks de autenticación y de fichadas que ya no se importaban.
- Varios módulos repetían la misma lógica HTTP: token Bearer, errores de red y respuesta 401.
- La función `pick()` (lectura de campos camelCase/PascalCase) estaba copiada en empleados, fichadas y empresas.
- Existían `VITE_EMPRESA_ID` y `DEFAULT_EMPRESA_ID`, que el código ya no usaba (la empresa sale del JWT).
- El destino del proxy de desarrollo estaba escrito de forma fija en `vite.config.js`.
- El README estaba desactualizado respecto de algunos endpoints y no reflejaba completamente el estado real de la autenticación.
- `index.html` apuntaba a un favicon que no existía (404).
- `.gitignore` incluía una entrada residual (`/control-accesos-frontend/`).
- El repositorio contenía más archivos de los necesarios para el funcionamiento actual.

### Después de la optimización

- Se eliminaron archivos y recursos confirmados como no utilizados.
- Se eliminaron los mocks antiguos de login y fichadas.
- Se mantiene únicamente el mock del Dashboard, porque esa vista todavía lo usa *(estado de esa limpieza; el mock posterior se eliminó al conectar el Dashboard a la API)*.
- Se creó `src/api/http.js` para el comportamiento HTTP común (URL, Bearer, 401, errores de red).
- Cada módulo conserva su comportamiento propio; en particular `empresas.js` sigue devolviendo `null` ante ciertos fallos en lugar de lanzar excepción.
- Se creó `src/utils/pick.js` para no duplicar el mapeo de campos.
- Se simplificaron `empleados.js`, `fichadas.js` y `empresas.js` sin cambiar rutas ni DTOs.
- La autenticación sigue siendo real contra la API, con JWT en `sessionStorage`.
- La URL de la API sigue configurándose con `VITE_API_BASE_URL`.
- El proxy de desarrollo puede definirse con `DEV_API_PROXY_TARGET`, conservando el mismo destino por defecto que antes.
- Se quitaron las variables de entorno que no se usaban.
- Hay un favicon válido en `public/favicon.svg`.
- Se actualizó `.gitignore`.
- Este README describe la arquitectura y los endpoints reales.
- No se agregaron dependencias nuevas (tampoco Axios, React ni ESLint).
- No se modificó el diseño visual ni los contratos con el backend.

### Comparación antes / después

| Área | Antes | Ahora |
| ---- | ----- | ----- |
| Código muerto | Residuos de Vite y mocks sin referencias | Eliminados los elementos confirmados como no usados |
| Llamadas HTTP | Lógica de token, 401 y red repetida en varios módulos | Comportamiento común en `src/api/http.js`; cada módulo sigue decidiendo qué hacer con la respuesta |
| Autenticación | API + JWT ya implementados, con un mock de login residual | Solo autenticación real (`POST /api/Auth/Login` + JWT) |
| Mocks | Dashboard, login y fichadas (estos dos últimos sin uso) | Solo Dashboard |
| Configuración de API | `VITE_API_BASE_URL` + `VITE_EMPRESA_ID` sin uso; proxy con IP fija en `vite.config.js` | Solo `VITE_API_BASE_URL`; proxy con `DEV_API_PROXY_TARGET` y el mismo fallback |
| Utilidades | `pick()` duplicada | `src/utils/pick.js` |
| Documentación | Endpoints y estado de auth desactualizados | README alineado con el código de esta rama |
| Dependencias | Vite + Tailwind | Las mismas; ninguna dependencia nueva |
| Diseño visual | Panel actual | Sin cambios de UI (solo el icono de pestaña, que antes daba 404) |
| Integración con backend | Mismos endpoints y DTOs | Sin cambios de rutas, métodos ni contratos |

### Archivos eliminados durante la limpieza

- `src/counter.js`
- `src/assets/javascript.svg`
- `src/assets/vite.svg`
- `public/icons.svg`
- `src/data/mock/auth.js`
- `src/data/mock/fichadas.js`

### Archivos incorporados

- `src/api/http.js`
- `src/utils/pick.js`
- `public/favicon.svg` — agregado para reemplazar la referencia inexistente y evitar el error 404.

### Resultado técnico

- `npm install`: correcto (33 paquetes auditados, 0 vulnerabilidades).
- `npm run build`: correcto (36 módulos transformados, sin errores).
- No hay configuración de lint en el proyecto (`npm run lint` no existe).
- El aspecto visual de las pantallas y los contratos con el backend se mantienen.

### Objetivo de estos cambios

La refactorización busca **calidad interna**, no nuevas pantallas ni endpoints. El código queda más fácil de leer y de explicar, con menos redundancia, responsabilidades más claras y un estado más adecuado para mantenimiento y para una defensa académica.
