# Instrucciones para agentes

Repositorio: `control-accesos-frontend` (Vite, Tailwind y JavaScript vanilla). El workspace local también puede contener `ControlFichajes.API`. No hay un repositorio padre.

Antes de cambiar comportamiento, leer en este orden:

1. `docs/ARQUITECTURA.md`
2. `docs/ESTADO_ACTUAL.md`
3. `docs/PENDIENTES.md`
4. `docs/DECISIONES_TECNICAS.md`
5. `README.md`, `docs/FRONTEND-SECURITY.md` y el resto de `docs/` ya existentes

`docs/ARQUITECTURA.md`, `docs/ESTADO_ACTUAL.md`, `docs/PENDIENTES.md` y `docs/DECISIONES_TECNICAS.md` están copiados en la API. Un hecho compartido se actualiza en las dos copias en la misma sesión de trabajo. No sobrescribir `docs/FRONTEND-SECURITY.md`, `docs/FICHADAS-OBSERVACIONES-API.md` ni `docs/ADAPTACION_FRONTEND_MULTIEMPRESA_P0.md`: el último describe una adaptación anterior y no el estado completo de la UI actual.

## Límites

- No modificar producción, no desplegar y no hacer merge a `main` salvo pedido explícito.
- No hacer push ni operaciones destructivas de Git salvo pedido explícito.
- No commitear `.env.local`, `dist`, `node_modules` ni secretos.
- El navegador no accede a MySQL. La autorización real la hace la API.
- No inventar un repositorio del lector biométrico: ese código no está en este workspace.

## Verificación habitual

```text
node scripts/run-checks.js
npm run build
```

En Windows, `scripts/check-deploy-archive.js` puede fallar al invocar `/bin/bash`. Confirmar el error antes de tratarlo como una regresión nueva.
