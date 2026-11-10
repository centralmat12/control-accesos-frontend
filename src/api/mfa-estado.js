export function puedeAplicarEstadoMfa(inicio, actual) {
  return Boolean(inicio?.usuarioId) &&
    inicio.usuarioId === actual?.usuarioId &&
    Boolean(actual?.token)
}
