const SENSITIVE =
  /authorization|bearer|password|passwd|pwd|clientsecret|client_secret|jwt|refresh|token|secret|template|huella|biometric|connectionstring|connection_string|cookie/i

export const MODULOS = Object.freeze([
  'Empleados',
  'Fichadas',
  'Administración',
  'Dispositivos',
  'Seguridad',
  'Sistema',
])

export const RESULTADOS = Object.freeze(['Exitoso', 'Advertencia', 'Rechazado', 'Error'])

export const PERIODOS = Object.freeze([
  { value: 'hoy', label: 'Hoy' },
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: 'mes', label: 'Este mes' },
  { value: 'personalizado', label: 'Rango personalizado' },
])

const MODULO_POR_CODIGO = {
  empleados: 'Empleados',
  fichadas: 'Fichadas',
  administracion: 'Administración',
  administración: 'Administración',
  usuarios: 'Administración',
  empresas: 'Administración',
  sucursales: 'Administración',
  departamentos: 'Administración',
  turnos: 'Administración',
  dispositivos: 'Dispositivos',
  agentes: 'Dispositivos',
  lectores: 'Dispositivos',
  seguridad: 'Seguridad',
  auth: 'Seguridad',
  autenticacion: 'Seguridad',
  sistema: 'Sistema',
}

const RESULTADO_POR_CODIGO = {
  exitoso: 'Exitoso',
  ok: 'Exitoso',
  success: 'Exitoso',
  advertencia: 'Advertencia',
  warning: 'Advertencia',
  rechazado: 'Rechazado',
  forbidden: 'Rechazado',
  denied: 'Rechazado',
  error: 'Error',
  failed: 'Error',
}

const CAMPO_ETIQUETA = {
  tolerancia: 'Tolerancia',
  minutostolerancia: 'Tolerancia',
  minutosalmuerzo: 'Descanso',
  entrada: 'Entrada',
  salida: 'Salida',
  activo: 'Estado',
  nombre: 'Nombre',
}

const VERBOS = {
  editar: (evento) => `Editó ${articulo(evento.entidad)} ${nombreEntidad(evento)}`.replace(/\s+/g, ' ').trim(),
  edicion: (evento) => VERBOS.editar(evento),
  actualizar: (evento) => VERBOS.editar(evento),
  corregir: (evento) => `Corrigió ${articulo(evento.entidad)} de ${nombreEntidad(evento)}`.replace(/\s+/g, ' ').trim(),
  correccion: (evento) => VERBOS.corregir(evento),
  desactivar: (evento) => `Desactivó al empleado ${nombreEntidad(evento)}`.trim(),
  exportar: (evento) => `Exportó ${nombreEntidad(evento) || evento.detalle || 'un archivo'}`.trim(),
  'login-fallido': () => 'No pudo iniciar sesión',
  desconexion: (evento) => `Se perdió la conexión con ${nombreEntidad(evento) || 'el dispositivo'}`,
}

function texto(value, max = 240) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function sensible(value) {
  return SENSITIVE.test(String(value ?? ''))
}

function codigo(value) {
  return texto(value, 80).toLocaleLowerCase('es')
}

function nombrePlano(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return texto(value, 120)
  return texto(value.nombre ?? value.label ?? '', 120)
}

function idPlano(value) {
  if (value == null || typeof value === 'string' || typeof value === 'number') return texto(value, 80)
  return texto(value.id ?? '', 80)
}

export function normalizarModulo(value) {
  const raw = texto(value, 80)
  if (MODULOS.includes(raw)) return raw
  return MODULO_POR_CODIGO[codigo(raw)] || ''
}

export function normalizarResultado(value) {
  const raw = texto(value, 40)
  if (RESULTADOS.includes(raw)) return raw
  return RESULTADO_POR_CODIGO[codigo(raw)] || ''
}

export function normalizarOrigen(value) {
  const raw = texto(value, 40)
  const key = codigo(raw)
  if (key === 'web') return 'Web'
  if (key === 'agente' || key === 'agent') return 'Agente'
  if (key === 'sistema' || key === 'system') return 'Sistema'
  return ''
}

function pareceFrase(value) {
  return /\s/.test(texto(value)) && !sensible(value)
}

function articulo(entidad) {
  const tipo = codigo(entidad?.tipo)
  if (!tipo) return 'el elemento'
  if (tipo === 'empleado') return 'al empleado'
  if (tipo === 'salida') return 'la salida'
  if (tipo === 'entrada') return 'la entrada'
  if (tipo === 'turno') return 'el turno'
  if (tipo === 'informe') return 'un informe'
  return `el ${tipo}`
}

function nombreEntidad(evento) {
  return evento.entidad?.nombre || ''
}

export function etiquetaCampo(campo) {
  const raw = texto(campo, 80)
  const known = CAMPO_ETIQUETA[codigo(raw).replace(/\s+/g, '')]
  if (known) return known
  const words = raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
    .trim()
  if (!words || sensible(words)) return ''
  return words.charAt(0).toLocaleUpperCase('es') + words.slice(1)
}

function formatearValor(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  const raw = texto(value, 80)
  if (sensible(raw)) return ''
  if (/^\d{4}-\d{2}-\d{2}t/i.test(raw)) {
    const date = new Date(raw)
    if (!Number.isNaN(date.getTime())) return formatoFechaBitacora(date)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5)
  return raw
}

export function formatoFechaBitacora(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (part) => String(part).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fechaClave(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function sanitizarMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const safe = {}
  for (const [key, item] of Object.entries(value)) {
    if (sensible(key) || sensible(item)) continue
    const text = formatearValor(item)
    if (text) safe[key] = text
  }
  return safe
}

function normalizarCambios(value) {
  const list = Array.isArray(value) ? value : []
  return list
    .map((item) => ({
      campo: etiquetaCampo(item?.campo ?? item?.field),
      antes: formatearValor(item?.antes ?? item?.before),
      despues: formatearValor(item?.despues ?? item?.after),
    }))
    .filter((item) => item.campo && item.antes !== item.despues)
}

export function normalizarEventoBitacora(raw) {
  if (!raw || typeof raw !== 'object') return null
  const fechaHora = texto(raw.fechaHora ?? raw.at ?? raw.fecha, 40)
  const usuarioNombre = nombrePlano(raw.usuario)
  const entidad = {
    tipo: texto(raw.entidad?.tipo, 40),
    id: idPlano(raw.entidad),
    nombre: nombrePlano(raw.entidad),
  }
  const evento = {
    id: texto(raw.id, 80),
    fechaHora,
    usuario: {
      id: idPlano(raw.usuario),
      nombre: usuarioNombre,
    },
    modulo: normalizarModulo(raw.modulo),
    accion: texto(raw.accion, 160),
    entidad,
    detalle: sensible(raw.detalle) ? '' : texto(raw.detalle, 280),
    resultado: normalizarResultado(raw.resultado ?? raw.level),
    empresa: nombrePlano(raw.empresa),
    sucursal: nombrePlano(raw.sucursal),
    origen: normalizarOrigen(raw.origen),
    cambios: normalizarCambios(raw.cambios),
    metadataSegura: sanitizarMetadata(raw.metadataSegura ?? raw.metadata),
  }
  if (!evento.fechaHora && !evento.detalle && !evento.accion) return null
  return evento
}

export function textoAccion(evento) {
  if (!evento) return ''
  if (pareceFrase(evento.accion)) return evento.accion
  const verbo = VERBOS[codigo(evento.accion)]
  if (verbo) {
    const phrase = verbo(evento)
    if (phrase && !phrase.endsWith(' ')) return phrase
  }
  if (evento.detalle) return evento.detalle
  return 'Registró una actividad'
}

export function textoDetalle(evento) {
  const accion = textoAccion(evento)
  if (!evento?.detalle || evento.detalle === accion) return ''
  return evento.detalle
}

function incluye(query, evento) {
  if (!query) return true
  const haystack = [
    evento.usuario?.nombre,
    textoAccion(evento),
    evento.detalle,
    evento.entidad?.nombre,
    evento.entidad?.tipo,
    evento.modulo,
    evento.empresa,
    evento.sucursal,
  ]
    .join(' ')
    .toLocaleLowerCase('es')
  return haystack.includes(query)
}

function dentroDelPeriodo(evento, filtros, hoy = fechaClave(new Date())) {
  const clave = fechaClave(evento.fechaHora)
  if (!clave) return false
  if (filtros.periodo === 'personalizado') {
    if (filtros.desde && clave < filtros.desde) return false
    if (filtros.hasta && clave > filtros.hasta) return false
    return true
  }
  if (filtros.periodo === 'hoy') return clave === hoy
  if (filtros.periodo === 'mes') return clave.slice(0, 7) === hoy.slice(0, 7) && clave <= hoy
  const days = Number(filtros.periodo)
  if (!Number.isFinite(days)) return true
  const start = new Date(`${hoy}T12:00:00`)
  start.setDate(start.getDate() - (days - 1))
  return clave >= fechaClave(start) && clave <= hoy
}

export function filtrarBitacora(eventos, filtros = {}, hoy = fechaClave(new Date())) {
  const query = texto(filtros.q, 120).toLocaleLowerCase('es')
  return [...(eventos ?? [])]
    .filter((evento) => {
      if (!incluye(query, evento)) return false
      if (filtros.usuario && evento.usuario?.nombre !== filtros.usuario) return false
      if (filtros.modulo && evento.modulo !== filtros.modulo) return false
      if (filtros.resultado && evento.resultado !== filtros.resultado) return false
      if (filtros.accion && evento.accion !== filtros.accion) return false
      if (filtros.empresa && evento.empresa !== filtros.empresa) return false
      if (filtros.sucursal && evento.sucursal !== filtros.sucursal) return false
      if (filtros.origen && evento.origen !== filtros.origen) return false
      return dentroDelPeriodo(evento, filtros, hoy)
    })
    .sort((left, right) => String(right.fechaHora).localeCompare(String(left.fechaHora)))
}

export function valoresDisponibles(eventos, campo) {
  const values = new Set()
  for (const evento of eventos ?? []) {
    const value = campo === 'usuario' ? evento.usuario?.nombre : evento[campo]
    if (value) values.add(value)
  }
  return [...values]
}

export function puedeMostrarMasFiltros(eventos) {
  return ['accion', 'empresa', 'sucursal', 'origen'].some((campo) => valoresDisponibles(eventos, campo).length > 0)
}

export function filasExportacion(eventos) {
  return (eventos ?? []).map((evento) => [
    formatoFechaBitacora(evento.fechaHora),
    evento.usuario?.nombre || '',
    evento.modulo,
    textoAccion(evento),
    evento.entidad?.nombre || '',
    textoDetalle(evento),
    evento.resultado,
    evento.empresa,
    evento.sucursal,
    evento.origen,
  ])
}

export const COLUMNAS_EXPORTACION = Object.freeze([
  'Fecha y hora',
  'Usuario',
  'Módulo',
  'Acción',
  'Elemento',
  'Detalle',
  'Resultado',
  'Empresa',
  'Sucursal',
  'Origen',
])
