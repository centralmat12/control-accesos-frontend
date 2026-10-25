import { isAdmin, isRrhh, isSuperadmin } from './roles.js'

export function puedeAdministrarTurnos(user) {
  return isSuperadmin(user) || isAdmin(user)
}

export function puedeConsultarTurnos(user) {
  return puedeAdministrarTurnos(user) || isRrhh(user)
}

export function puedeRegistrarFichadaManual(user) {
  return isSuperadmin(user) || isAdmin(user)
}

export function puedeVerAlertasJornada(user) {
  return isSuperadmin(user) || isAdmin(user)
}

export function puedeEscribirJornadas(user) {
  return isSuperadmin(user) || isAdmin(user)
}

export const REGISTRAR_FICHADA_MANUAL = Object.freeze({
  id: 'fichada-manual',
  label: 'Fichada manual',
  description: 'Agregar una entrada o salida puntual.',
})

export const REGISTRAR_DIA_LIBRE = Object.freeze({
  id: 'dia-libre',
  label: 'Vacaciones / día libre',
  description: 'Marcar uno o varios días sin jornada.',
})

/** Acciones de escritura visibles en Fichadas. RRHH no administra fichadas ni jornadas. */
export function registrarMenuActions(user) {
  const actions = []
  if (puedeRegistrarFichadaManual(user)) actions.push(REGISTRAR_FICHADA_MANUAL)
  if (puedeEscribirJornadas(user)) actions.push(REGISTRAR_DIA_LIBRE)
  return actions
}
