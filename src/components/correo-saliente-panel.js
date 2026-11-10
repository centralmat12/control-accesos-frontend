import {
  AYUDA_CORREO,
  consultarCorreo,
  guardarCorreo,
  MENSAJE_CORREO_ENVIADO,
  probarCorreo,
} from '../api/correo-saliente.js'
import { badgeHtml } from './badge.js'
import { enhanceSelectsIn, refreshEnhancedSelect } from './dropdown.js'
import { adminSectionHeaderMarkup, ADMIN_FIELD_CONTROL_CLASS, ADMIN_PRIMARY_BUTTON_CLASS, ADMIN_TABLE_FRAME_CLASS } from './admin-panel-layout.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { validateEmailValue } from './form-field.js'

const CAMPO = `${ADMIN_FIELD_CONTROL_CLASS} w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100`

export function createCorreoSalientePanel() {
  const abort = new AbortController()
  const raiz = document.createElement('div')
  raiz.className = 'space-y-4'
  raiz.innerHTML = `
    ${adminSectionHeaderMarkup({
      titleId: 'admin-correo-title',
      title: 'Configuración de correo',
      description: AYUDA_CORREO,
    })}
    <p id="correo-carga" class="text-sm text-slate-600 dark:text-slate-300">Cargando configuración…</p>
    <div id="correo-falla" class="hidden space-y-3">
      <p id="correo-falla-texto" class="text-sm text-red-700 dark:text-red-300" role="alert"></p>
      <button type="button" id="correo-reintentar" class="${BTN_SECONDARY_CLASS} h-10">Reintentar</button>
    </div>
    <form id="correo-form" class="hidden space-y-4" novalidate>
      <section class="${ADMIN_TABLE_FRAME_CLASS} space-y-4 p-4" aria-labelledby="correo-conexion-titulo">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 id="correo-conexion-titulo" class="text-sm font-semibold text-slate-900 dark:text-slate-100">Conexión SMTP</h3>
          <div id="correo-estado"></div>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          ${campo('correo-servidor', 'Servidor SMTP', 'text')}
          ${campo('correo-puerto', 'Puerto', 'number')}
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="correo-cifrado">Cifrado</label>
          <select id="correo-cifrado" class="${CAMPO} h-10">
            <option value="tls-conexion">TLS desde la conexión</option>
            <option value="starttls">STARTTLS</option>
            <option value="ninguno">Sin cifrado</option>
          </select>
          <p id="correo-cifrado-error" class="mt-1 hidden text-sm text-red-700 dark:text-red-300"></p>
        </div>
        ${campo('correo-usuario', 'Usuario SMTP', 'text')}
        ${campo('correo-remitente', 'Correo remitente', 'email')}
        <div>
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Contraseña SMTP</p>
          <p id="correo-clave-estado" class="mt-1 text-sm text-slate-900 dark:text-slate-100">Sin configurar</p>
          <button type="button" id="correo-clave-cambiar" class="${BTN_SECONDARY_CLASS} mt-2 h-10">Cambiar contraseña SMTP</button>
          <div id="correo-clave-campo" class="mt-2 hidden">
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="correo-contrasena">Nueva contraseña SMTP</label>
            <input id="correo-contrasena" type="password" autocomplete="new-password" maxlength="200" class="${CAMPO} h-10" />
          </div>
          <p id="correo-contrasena-error" class="mt-1 hidden text-sm text-red-700 dark:text-red-300"></p>
        </div>
      </section>
      <section class="${ADMIN_TABLE_FRAME_CLASS} space-y-3 border-t border-slate-200 p-4 dark:border-slate-700" aria-labelledby="correo-prueba-titulo">
        <h3 id="correo-prueba-titulo" class="text-sm font-semibold text-slate-900 dark:text-slate-100">Correo de prueba</h3>
        ${campo('correo-destinatario', 'Destinatario', 'email')}
        <p id="correo-prueba-aviso" class="hidden text-sm" role="status"></p>
        <p id="correo-prueba-pendiente" class="hidden text-sm text-amber-800 dark:text-amber-200">Los valores actuales todavía no se probaron.</p>
        <button type="button" id="correo-probar" class="${BTN_SECONDARY_CLASS} h-10">Enviar correo de prueba</button>
      </section>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="submit" id="correo-guardar" class="${ADMIN_PRIMARY_BUTTON_CLASS}" disabled>Guardar cambios</button>
        <button type="button" id="correo-descartar" class="${BTN_SECONDARY_CLASS} hidden h-10">Descartar cambios</button>
      </div>
      <p id="correo-guardar-aviso" class="hidden text-sm" role="status"></p>
    </form>
  `

  const carga = raiz.querySelector('#correo-carga')
  const falla = raiz.querySelector('#correo-falla')
  const fallaTexto = raiz.querySelector('#correo-falla-texto')
  const formulario = raiz.querySelector('#correo-form')
  const estado = raiz.querySelector('#correo-estado')
  const servidor = raiz.querySelector('#correo-servidor')
  const puerto = raiz.querySelector('#correo-puerto')
  const cifrado = raiz.querySelector('#correo-cifrado')
  const usuario = raiz.querySelector('#correo-usuario')
  const remitente = raiz.querySelector('#correo-remitente')
  const claveEstado = raiz.querySelector('#correo-clave-estado')
  const claveCambiar = raiz.querySelector('#correo-clave-cambiar')
  const claveCampo = raiz.querySelector('#correo-clave-campo')
  const contrasena = raiz.querySelector('#correo-contrasena')
  const destinatario = raiz.querySelector('#correo-destinatario')
  const probar = raiz.querySelector('#correo-probar')
  const guardar = raiz.querySelector('#correo-guardar')
  const descartar = raiz.querySelector('#correo-descartar')
  const pruebaAviso = raiz.querySelector('#correo-prueba-aviso')
  const pruebaPendiente = raiz.querySelector('#correo-prueba-pendiente')
  const guardarAviso = raiz.querySelector('#correo-guardar-aviso')
  let vigente = null
  let claveConfigurada = false
  let cambiandoClave = false
  let ocupado = false
  let probado = ''

  function leerConexion() {
    const cambiaClave = cambiandoClave && contrasena.value.length > 0
    return {
      servidor: servidor.value.trim(),
      puerto: puerto.value.trim(),
      cifrado: cifrado.value,
      usuario: usuario.value.trim(),
      remitente: remitente.value.trim(),
      cambiarContrasena: cambiaClave,
      contrasena: cambiaClave ? contrasena.value : '',
    }
  }

  function firma(datos = leerConexion()) {
    return JSON.stringify({
      servidor: datos.servidor,
      puerto: String(datos.puerto),
      cifrado: datos.cifrado,
      usuario: datos.usuario,
      remitente: datos.remitente,
      contrasena: datos.cambiarContrasena ? 'nueva' : '',
    })
  }

  function sucio() {
    if (!vigente) return false
    return firma() !== firma({ ...vigente, cambiarContrasena: false, contrasena: '' })
  }

  function erroresLocales(incluirDestino = false) {
    const datos = leerConexion()
    const errores = {}
    if (!datos.servidor) errores.servidor = 'Ingresá el servidor SMTP.'
    const puertoNumero = Number(datos.puerto)
    if (!Number.isInteger(puertoNumero) || puertoNumero < 1 || puertoNumero > 65535) {
      errores.puerto = 'Ingresá un puerto entre 1 y 65535.'
    }
    const remitenteError = validateEmailValue(datos.remitente, { emptyMessage: 'Ingresá el correo remitente.' })
    if (remitenteError) errores.remitente = remitenteError
    const tieneClave = claveConfigurada || datos.cambiarContrasena
    if (datos.usuario && !tieneClave) errores.contrasena = 'Si indicás un usuario SMTP, la contraseña es obligatoria.'
    if (!datos.usuario && datos.cambiarContrasena) errores.contrasena = 'Sin usuario SMTP, no corresponde una contraseña.'
    if (incluirDestino) {
      const destino = validateEmailValue(destinatario.value.trim(), { emptyMessage: 'Ingresá el destinatario.' })
      if (destino) errores.destinatario = destino
    }
    return errores
  }

  function pintarErrores(errores = {}) {
    for (const nombre of ['servidor', 'puerto', 'cifrado', 'usuario', 'remitente', 'contrasena', 'destinatario']) {
      const nodo = raiz.querySelector(`#correo-${nombre}-error`)
      if (!nodo) continue
      nodo.textContent = errores[nombre] || ''
      nodo.classList.toggle('hidden', !errores[nombre])
    }
  }

  function pintarEstado(configurado) {
    estado.innerHTML = configurado
      ? badgeHtml('Configurada', 'success')
      : badgeHtml('Incompleta', 'warning')
  }

  function aplicar(datos) {
    vigente = {
      servidor: datos.servidor,
      puerto: String(datos.puerto || ''),
      cifrado: datos.cifrado || 'tls-conexion',
      usuario: datos.usuario,
      remitente: datos.remitente,
    }
    claveConfigurada = datos.contrasenaConfigurada === true
    servidor.value = vigente.servidor
    puerto.value = vigente.puerto
    cifrado.value = ['tls-conexion', 'starttls', 'ninguno'].includes(vigente.cifrado) ? vigente.cifrado : 'tls-conexion'
    usuario.value = vigente.usuario
    remitente.value = vigente.remitente
    refreshEnhancedSelect(cifrado)
    contrasena.value = ''
    cambiandoClave = false
    claveCampo.classList.add('hidden')
    claveEstado.textContent = claveConfigurada ? 'Configurada' : 'Sin configurar'
    pintarEstado(datos.configurado === true)
    pintarErrores(erroresLocales())
    sincronizar()
  }

  function sincronizar() {
    const hayCambios = sucio()
    const validos = Object.keys(erroresLocales()).length === 0
    guardar.disabled = ocupado || !hayCambios || !validos
    descartar.classList.toggle('hidden', !hayCambios)
    pruebaPendiente.classList.toggle('hidden', !probado || probado === firma())
    probar.disabled = ocupado
    guardar.textContent = ocupado && guardar.dataset.modo === 'guardar' ? 'Guardando…' : 'Guardar cambios'
    probar.textContent = ocupado && probar.dataset.modo === 'probar' ? 'Enviando…' : 'Enviar correo de prueba'
  }

  function mostrarPrueba(mensaje, ok) {
    pruebaAviso.textContent = mensaje
    pruebaAviso.className = ok
      ? 'text-sm text-emerald-700 dark:text-emerald-300'
      : 'text-sm text-red-700 dark:text-red-300'
  }

  function mostrarGuardado(mensaje, ok) {
    guardarAviso.textContent = mensaje
    guardarAviso.className = ok
      ? 'text-sm text-emerald-700 dark:text-emerald-300'
      : 'text-sm text-red-700 dark:text-red-300'
  }

  async function cargar() {
    carga.classList.remove('hidden')
    falla.classList.add('hidden')
    formulario.classList.add('hidden')
    try {
      const datos = await consultarCorreo()
      if (abort.signal.aborted) return
      aplicar(datos)
      carga.classList.add('hidden')
      formulario.classList.remove('hidden')
    } catch (error) {
      if (abort.signal.aborted) return
      carga.classList.add('hidden')
      fallaTexto.textContent = error?.message || 'No se pudo consultar la configuración de correo.'
      falla.classList.remove('hidden')
    }
  }

  raiz.querySelector('#correo-reintentar').addEventListener('click', () => { void cargar() })
  formulario.addEventListener('input', alEditar)
  formulario.addEventListener('change', alEditar)
  function alEditar() {
    pintarErrores()
    sincronizar()
  }
  claveCambiar.addEventListener('click', () => {
    cambiandoClave = true
    claveCampo.classList.remove('hidden')
    contrasena.focus()
    sincronizar()
  })
  descartar.addEventListener('click', () => {
    if (!vigente) return
    destinatario.value = destinatario.value
    aplicar({ ...vigente, puerto: Number(vigente.puerto), contrasenaConfigurada: claveConfigurada, configurado: estado.textContent.includes('Configurada') })
    guardarAviso.className = 'hidden text-sm'
  })
  probar.addEventListener('click', async () => {
    if (ocupado) return
    const errores = erroresLocales(true)
    pintarErrores(errores)
    if (Object.keys(errores).length > 0) return
    ocupado = true
    probar.dataset.modo = 'probar'
    sincronizar()
    pruebaAviso.className = 'hidden text-sm'
    const enviados = leerConexion()
    try {
      const resultado = await probarCorreo({ ...enviados, destinatario: destinatario.value.trim() })
      probado = firma(enviados)
      mostrarPrueba(resultado.mensaje, true)
    } catch (error) {
      if (error?.errores) pintarErrores(error.errores)
      mostrarPrueba(error?.message || 'No se pudo enviar el correo de prueba.', false)
    } finally {
      ocupado = false
      delete probar.dataset.modo
      sincronizar()
    }
  })
  formulario.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (ocupado || guardar.disabled) return
    const errores = erroresLocales()
    pintarErrores(errores)
    if (Object.keys(errores).length > 0) return
    ocupado = true
    guardar.dataset.modo = 'guardar'
    sincronizar()
    try {
      const resultado = await guardarCorreo(leerConexion())
      aplicar(resultado.configuracion)
      probado = ''
      mostrarGuardado(resultado.mensaje, true)
    } catch (error) {
      if (error?.errores) pintarErrores(error.errores)
      mostrarGuardado(error?.message || 'No se pudo guardar la configuración de correo.', false)
    } finally {
      ocupado = false
      delete guardar.dataset.modo
      sincronizar()
    }
  })

  enhanceSelectsIn(raiz)
  void cargar()
  raiz.dispose = () => abort.abort()
  return raiz
}

function campo(id, etiqueta, tipo) {
  return `
    <div class="min-w-0">
      <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="${id}">${etiqueta}</label>
      <input id="${id}" type="${tipo}" autocomplete="off" class="${CAMPO} h-10" />
      <p id="${id}-error" class="mt-1 hidden text-sm text-red-700 dark:text-red-300"></p>
    </div>
  `
}

export { AYUDA_CORREO, MENSAJE_CORREO_ENVIADO }
