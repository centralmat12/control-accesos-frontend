/**
 * Bitácora operativa.
 *
 * No hay un endpoint publicado. Esta función no llama a la red y no lee
 * sessionStorage ni localStorage. La actividad local de `activity-log.js`
 * sigue existiendo para diagnóstico de la sesión; no es la fuente de esta pantalla.
 *
 * Cuando la API publique la bitácora, el listado debe responder con eventos
 * ya persistidos en el servidor. Forma esperada de cada evento:
 *
 * {
 *   id, fechaHora,
 *   usuario: { id, nombre },
 *   modulo, accion,
 *   entidad: { tipo, id, nombre },
 *   detalle, resultado,
 *   empresa, sucursal, origen,
 *   cambios: [{ campo, antes, despues }],
 *   metadataSegura
 * }
 *
 * `resultado` admite Exitoso, Advertencia, Rechazado o Error.
 * `origen` admite Web, Agente o Sistema.
 * `modulo` admite Empleados, Fichadas, Administración, Dispositivos, Seguridad o Sistema.
 * No incluir contraseñas, JWT, secretos, huellas ni connection strings.
 */

export async function consultarBitacora() {
  return {
    disponible: false,
    motivo: 'sin-endpoint',
    eventos: [],
  }
}
