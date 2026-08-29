# Control de Accesos — Frontend

Panel web para el sistema de control de accesos y fichajes (tesis). Permite iniciar sesión, consultar empleados de una empresa y ver registros de asistencia contra una API ASP.NET Core. El frontend no ejecuta .NET ni MySQL: en desarrollo habla con la API remota a través del proxy de Vite.

## Tecnologías

Definidas en `package.json`:

- JavaScript (módulos ES, `"type": "module"`)
- [Vite](https://vite.dev/) `^8.2.2` (dev server, build y `preview`)
- [Tailwind CSS](https://tailwindcss.com/) `^4.3.3` con el plugin `@tailwindcss/vite`

La API (fuera de este repositorio) es ASP.NET Core (Kestrel) y persiste en MySQL.

## Arquitectura

```
Navegador  →  Frontend Vite  →  API ASP.NET Core  →  MySQL
```

En **desarrollo**, el navegador llama a rutas relativas `/api/...` (mismo origen que Vite, por ejemplo `http://localhost:5173`). Vite proxea `/api` hacia la API remota configurada en `vite.config.js` (`target` actual: `http://161.153.193.159:8080`). Así se evita CORS mientras el origen del browser no coincide con el permitido por el backend.

En desarrollo, Vite utiliza un proxy para redirigir `/api` hacia la API remota. En producción, el servidor web (por ejemplo Nginx) puede redirigir `/api` hacia ASP.NET Core, permitiendo mantener frontend y API bajo el mismo origen. Alternativamente puede configurarse `VITE_API_BASE_URL` durante el build.

## Autenticación

- Login: `POST /api/Auth/Login` con `{ email, password }`.
- La API responde un **JWT** (propiedad `token`).
- El frontend guarda el JWT en `sessionStorage` (`ca.auth.token`) y un objeto de usuario en `ca.auth.user`.
- Las rutas protegidas envían `Authorization: Bearer <token>`.
- El frontend **no valida la firma** del JWT. Solo decodifica el payload para la UI. Claims usados:
  - `unique_name` → nombre
  - `email` → email
  - `role` → rol
  - `empresa_id` → empresaId
- Si falta un claim, hay fallbacks seguros (por ejemplo el email del formulario o `"Usuario"`).
- Un **401** en empleados o fichadas cierra la sesión y vuelve al login.
- La sesión vive en `sessionStorage`: sobrevive a recargar la pestaña, no a cerrar el navegador ni a otro tab.

## Qué está integrado con la API

| Método | Endpoint | Vista / uso |
| ------ | -------- | ----------- |
| `POST` | `/api/Auth/Login` | Login |
| `GET` | `/api/empleados/empresa/{empresaId}` | Usuarios (lista de empleados). `empresaId` por defecto: `VITE_EMPRESA_ID` (1) |
| `GET` | `/api/fichadas?limite=100` | Fichadas |

## Qué todavía no está integrado

- **Dashboard:** tarjetas (empleados activos, fichadas de hoy, entradas, salidas) y la tabla “Últimas fichadas” usan **datos mock** (`src/api/dashboard.js` y `src/data/mock/dashboard.js`).
- **Áreas, Horarios, Dispositivos y Agentes:** placeholders en el menú; no hay pantallas ni llamadas a la API.

Los archivos mock que el Dashboard sigue usando no se deben borrar.

## Configuración (`.env.local`)

1. Copiá `.env.example` a `.env.local` (ver instalación).
2. Vite carga variables `VITE_*` al iniciar el servidor. Si cambiás el `.env`, reiniciá `npm run dev`.

Variables:

| Variable | Uso |
| -------- | --- |
| `VITE_API_BASE_URL` | En desarrollo el código **ignora** este valor y usa `''` para que las llamadas vayan a `/api` (proxy). Dejalo vacío en `.env.local`. En un build de producción sí se usa como base de la API. |
| `VITE_EMPRESA_ID` | Empresa por defecto al pedir empleados (default `1`). |

**No subas `.env.local` al repositorio.** Está cubierto por `*.local` en `.gitignore`. El archivo que sí se versiona es `.env.example`, sin secretos.

No pongas contraseñas, JWT, cadenas de MySQL ni claves de firma en ningún `.env` de este frontend: el login pide credenciales en la UI y el backend es quien valida.

## Instalación en una PC nueva

Requisitos: [Git](https://git-scm.com/) y [Node.js](https://nodejs.org/) (incluye `npm`). No hace falta instalar .NET ni MySQL para correr **solo este frontend**: usa la API remota vía el proxy de Vite.

En PowerShell:

```powershell
git clone <url-del-repositorio>
cd control-accesos-frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Abrí la URL que imprima Vite (habitualmente `http://localhost:5173/`). Si el puerto 5173 está ocupado, Vite elige otro (5174, …). Con el proxy, el origen distinto no suele romper el login. Conviene una sola instancia de `npm run dev`.

## Scripts

| Comando | Qué hace |
| ------- | -------- |
| `npm run dev` | Servidor de desarrollo + proxy `/api` |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build localmente (sin el mismo proxy de `dev`, salvo que lo configures) |

Para producción: `npm run build` y publicar `dist/`. Definí `VITE_API_BASE_URL` **antes** del build si el frontend estático debe pegarle a otra URL de API. El backend tiene que permitir CORS para el origen desde el que se sirva el panel.

## Estructura relevante

```
src/api/          llamadas a la API (auth, empleados, fichadas, dashboard mock)
src/config/       api.js, navegación
src/views/        login, dashboard, empleados, fichadas
src/data/mock/    datos simulados (Dashboard y mocks no usados por login/fichadas)
vite.config.js    proxy `/api` → API remota
```
