import { agenteConectividad } from './agente-conectividad.js'
import { elapsedMinutes, formatElapsedLabel, parseContactDate } from './relative-time.js'

export function conectadosResumenLabel(conectados, total) {
  const word = Number(conectados) === 1 ? 'conectado' : 'conectados'
  return `${Number(conectados) || 0} de ${Number(total) || 0} ${word}`
}

export function ultimaComunicacionLabel(value, now = new Date()) {
  const date = parseContactDate(value)
  if (!date) return 'Sin comunicación registrada'
  const minutes = elapsedMinutes(date, now)
  if (minutes == null) return 'Sin comunicación registrada'
  return `Última comunicación: hace ${formatElapsedLabel(minutes)}`
}

export function filterAgentesPorEmpresa(agentes, empresaId) {
  const empresa = Number(empresaId)
  if (!Number.isFinite(empresa) || empresa <= 0) return []
  return (Array.isArray(agentes) ? agentes : []).filter(
    (agente) => Number(agente?.empresaId) === empresa,
  )
}

/** AgenteDto no incluye nombre de sucursal; se completa con GET /api/sucursales. */
export function attachSucursalNombres(agentes, sucursales = []) {
  const nombres = new Map(
    (Array.isArray(sucursales) ? sucursales : [])
      .filter((item) => Number(item?.id) > 0)
      .map((item) => [Number(item.id), String(item.nombre ?? '').trim()]),
  )

  return (Array.isArray(agentes) ? agentes : []).map((agente) => ({
    ...agente,
    sucursalNombre: nombres.get(Number(agente?.sucursalId)) || agente?.sucursalNombre || '',
  }))
}

/** Umbral de conexión del frontend: conectado si el último contacto tiene menos de 60 minutos. */
export function resumenDispositivosDesdeAgentes(agentes, now = new Date()) {
  const dispositivos = (Array.isArray(agentes) ? agentes : []).map((agente) => {
    const status = agenteConectividad(agente, now)
    return {
      id: agente?.id ?? null,
      nombre: String(agente?.nombre ?? '').trim() || 'Dispositivo',
      sucursalId: agente?.sucursalId ?? null,
      sucursalNombre: String(agente?.sucursalNombre ?? '').trim(),
      empresaId: agente?.empresaId ?? null,
      activo: Boolean(agente?.activo),
      ultimaConexion: agente?.ultimoAcceso ?? null,
      conectado: status.tone === 'success',
    }
  })

  const conectados = dispositivos.filter((item) => item.conectado).length
  return {
    total: dispositivos.length,
    conectados,
    desconectados: dispositivos.length - conectados,
    dispositivos,
  }
}

export function dispositivosResumenStatus(estado) {
  if (estado?.hidden) {
    return null
  }

  if (!estado || estado.reason === 'empresa') {
    return {
      tone: 'neutral',
      label: 'Empresa no disponible',
      detail: 'Seleccioná una empresa en el encabezado para consultar los dispositivos.',
    }
  }

  if (estado.error) {
    return {
      tone: 'neutral',
      label: 'Estado desconocido',
      detail: estado.error,
    }
  }

  if (!estado.loaded) {
    return {
      tone: 'neutral',
      label: 'Estado desconocido',
      detail: 'Todavía no se consultó el estado de los dispositivos.',
    }
  }

  const total = Number(estado.total) || 0
  const conectados = Number(estado.conectados) || 0
  if (total <= 0) {
    return {
      tone: 'neutral',
      label: 'Sin dispositivos configurados',
      detail: 'No hay dispositivos configurados para esta empresa.',
    }
  }

  const label = conectadosResumenLabel(conectados, total)
  if (conectados === total) {
    return { tone: 'success', label, detail: 'Todos los dispositivos están conectados.' }
  }
  if (conectados === 0) {
    return { tone: 'danger', label, detail: 'Ningún dispositivo está conectado.' }
  }
  return { tone: 'warning', label, detail: 'Hay dispositivos desconectados.' }
}
