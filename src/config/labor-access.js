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
