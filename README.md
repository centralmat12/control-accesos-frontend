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
- [Node.js](https://nodejs.org/) con `npm` (se recomienda una versión LTS actual)
- No hace falta instalar .NET ni MySQL para correr **solo este frontend**, siempre que la API esté accesible (local o remota)

## Instalación

```powershell
git clone <url-del-repositorio>
cd control-accesos-frontend
Copy-Item .env.example .env.local
npm install
```

## Ejecución en desarrollo

```powershell
npm run dev
```

Vite muestra la URL (habitualmente `http://localhost:5173/`). Si el puerto está ocupado, elige otro.

Si se modifica `.env.local`, hay que reiniciar el servidor de desarrollo.

## Compilación

```powershell
npm run build
```

El resultado queda en `dist/`. Para servir ese build en local:

```powershell
npm run preview
```

`preview` no aplica el proxy de `npm run dev`. En un despliegue real conviene que el servidor web (por ejemplo Nginx) sirva `dist/` y proxyee `/api` hacia el backend.

## Estructura del proyecto

```
src/
├── api/          Llamadas HTTP a la API (auth, empleados, fichadas, empresas)
├── components/   Piezas de interfaz reutilizables (layout, tablas, formularios, iconos)
├── config/       Nombre de la app, menú y URL base de la API
├── data/mock/    Datos simulados que todavía usa el Dashboard
├── utils/        Formato de fechas, CSV, jornadas y lectura de campos de la API
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
| Fichadas (filtros, jornadas, CSV, impresión) | Integrado con la API |
| Empresa (nombre en reportes de fichadas) | `GET /api/empresas` (si falla, la vista sigue y el nombre queda vacío) |
| Dashboard | Mock (no llama a la API) |
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
| `GET` | `/api/fichadas?limite=500` | Fichadas recientes (tope 500) |
| `GET` | `/api/empresas` | Datos de empresa para reportes |

## Funcionalidades MOCK / pendientes

- **Dashboard:** `src/data/mock/dashboard.js` y `src/api/dashboard.js`. Indicado en código con `// MOCK:`. Hay que reemplazar por endpoints reales cuando existan (por ejemplo un resumen y últimas fichadas).
- **Menú:** Áreas, Horarios, Dispositivos y Agentes todavía no tienen vista ni llamadas HTTP.
- **Empleados (backend pendiente):** edición, reactivar/listar inactivos, paginación, indicador de enrolamiento de huella **sin** exponer `templateBiometrico`. El enrolamiento se hace en el agente local, no en este panel.

No hay login mock: la autenticación ya es contra la API.

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

- Reemplazar el Dashboard mock por datos reales
- Implementar las pantallas que hoy son placeholder (áreas, horarios, dispositivos, agentes)
- Edición y reactivación de empleados cuando la API lo permita
- Paginación / histórico completo de fichadas (hoy el tope es 500 registros recientes)
- Roles y permisos aplicados también en backend (el frontend solo muestra el claim `role`)
- Manejo de errores más uniforme en todas las vistas

## Seguridad

- No guardar secretos (contraseñas, cadenas de MySQL, claves de firma JWT) en el frontend ni en archivos versionados
- No subir `.env.local` ni otros `.env` con datos reales
- Usar variables de entorno (`VITE_API_BASE_URL`, `DEV_API_PROXY_TARGET`)
- El JWT en `sessionStorage` es visible en el navegador: la autorización real debe validarse **siempre** en la API
- Este panel no debe consultar endpoints que expongan plantillas biométricas

## Mantenimiento y limpieza

Revisión de código (sin cambiar comportamiento ni diseño):

- Eliminación de residuos de la plantilla Vite (`counter.js`, SVGs no usados) y mocks de login/fichadas que ya no se importaban
- Extracción de `pick()` duplicado a `src/utils/pick.js`
- Cliente HTTP común en `src/api/http.js` (URL, Bearer, 401, errores de red) sin Axios
- Configuración de API centralizada; proxy de desarrollo configurable con `DEV_API_PROXY_TARGET` y el mismo destino por defecto que antes
- Eliminación de `VITE_EMPRESA_ID` / `DEFAULT_EMPRESA_ID` (no se usaban; la empresa sale del JWT)
- Favicon faltante (`public/favicon.svg`) para evitar el 404
- Ajuste de `.gitignore` y documentación alineada con el código real
