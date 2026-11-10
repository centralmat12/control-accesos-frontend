import {
  confirmarEnrolamiento,
  consultarEstadoMfa,
  desactivarMfa,
  iniciarEnrolamiento,
  MFA_ENROLAMIENTO_NO_DISPONIBLE,
  MFA_RESPUESTA_PERDIDA,
  regenerarCodigos,
} from '../api/mfa.js'
import { puedeAplicarEstadoMfa } from '../api/mfa-estado.js'
import { cambiarPassword, finishPasswordChange, getCurrentUser, getToken, logout, setLoginNotice } from '../api/auth.js'
import { createCambiarPasswordForm } from '../components/cambiar-password-form.js'
import { crearGuiaActivacion, crearTituloDobleFactor } from '../components/guia-activacion-mfa.js'
import { iconInfo, iconLock } from '../components/icons.js'
import { bindTooltipRoot, unbindTooltipRoot } from '../components/tooltip.js'
import { escapeHtml } from '../utils/format.js'

const AYUDA_CODIGOS_RECUPERACION = 'Si perdés acceso a tu autenticador, podés iniciar sesión con tu contraseña y uno de estos códigos. Cada código se puede usar una sola vez. Guardalos en un lugar seguro.'
const AVISO_DESACTIVAR = 'Esta acción invalida los códigos de recuperación y cierra las sesiones abiertas, incluida esta.'
const MENSAJE_DESACTIVADO = 'El doble factor quedó desactivado. Iniciá sesión con tu contraseña.'
const MENSAJE_DESACTIVACION_INCIERTA = 'No se pudo confirmar si el doble factor se desactivó. No vuelvas a enviar la operación. Iniciá sesión para comprobar el estado.'
const BOTON = 'rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60'
const CAJA = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white'
const ALERTA = 'rounded-lg border px-3 py-2 text-sm'

export async function renderSeguridad(container) {
  const raiz = document.createElement('section')
  raiz.className = 'mx-auto w-full max-w-3xl space-y-4'
  let guia = null
  let autenticadorActivo = false
  let configuracionDisponible = false
  let consulta = 0

  function limpiarSensibles() {
    guia?.limpiarSensibles()
    raiz.querySelectorAll('[data-sensible]').forEach((nodo) => {
      nodo.textContent = ''
    })
    raiz.querySelectorAll('#mfa-desactivar-panel input').forEach((input) => {
      input.value = ''
    })
  }

  function salirAlLogin(aviso) {
    limpiarSensibles()
    unbindTooltipRoot(raiz)
    setLoginNotice(aviso)
    void logout().then(() => {
      window.dispatchEvent(new CustomEvent('ca:unauthorized'))
    })
  }

  function mensajeEstado(estado) {
    if (estado === 'apagado') return MFA_ENROLAMIENTO_NO_DISPONIBLE
    if (estado === 'credencial') return 'La contraseña no es correcta.'
    if (estado === 'bloqueado') return 'Demasiados intentos. Esperá unos minutos.'
    if (estado === 'limite') return 'Demasiadas solicitudes. Esperá unos minutos.'
    if (estado === 'restringido') return 'Tenés que cambiar la contraseña antes de continuar.'
    if (estado === 'sesion') return 'La sesión ya no es válida.'
    if (estado === 'incierto') return MFA_RESPUESTA_PERDIDA
    if (estado === 'ya-configurado') return 'El autenticador ya está activo.'
    if (estado === 'obligatorio') return 'El doble factor de esta cuenta es obligatorio y no se puede desactivar.'
    return 'No se pudo completar la operación.'
  }

  function marcarActivo(activo) {
    raiz.querySelector('#mfa-activo')?.remove()
    if (!activo) return
    const marca = document.createElement('p')
    marca.id = 'mfa-activo'
    marca.className = 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100'
    marca.textContent = 'Activo'
    raiz.querySelector('#mfa-titulo')?.firstElementChild?.append(marca)
  }

  function ocultarRecuperacion() {
    const seccion = raiz.querySelector('#mfa-recuperacion')
    seccion?.classList.add('hidden')
    seccion?.replaceChildren()
  }

  function tituloRecuperacion() {
    return `
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Códigos de recuperación</h2>
        <button type="button" id="mfa-codigos-ayuda" class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-100" data-tooltip="${escapeHtml(AYUDA_CODIGOS_RECUPERACION)}" data-tooltip-compact aria-label="Ayuda sobre los códigos de recuperación">${iconInfo('h-4 w-4')}</button>
      </div>
    `
  }

  function mostrarRecuperacion() {
    const seccion = raiz.querySelector('#mfa-recuperacion')
    if (!autenticadorActivo || !seccion) return
    seccion.classList.remove('hidden')
    if (!configuracionDisponible) {
      seccion.innerHTML = `
        ${tituloRecuperacion()}
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">La regeneración de códigos no está habilitada.</p>
      `
      return
    }
    seccion.innerHTML = `
      ${tituloRecuperacion()}
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Generá un conjunto nuevo con tu contraseña y un solo segundo factor.</p>
      <button type="button" id="mfa-abrir-regenerar" class="mt-4 ${BOTON}">Regenerar códigos</button>
      <div id="mfa-regenerar-panel" hidden></div>
    `
    seccion.querySelector('#mfa-abrir-regenerar').addEventListener('click', () => {
      const panel = seccion.querySelector('#mfa-regenerar-panel')
      panel.hidden = false
      panel.innerHTML = `
        <form id="mfa-regenerar" class="mt-4 space-y-3" novalidate>
          <label class="block text-sm font-medium" for="mfa-reg-password">Contraseña</label>
          <input id="mfa-reg-password" name="password" type="password" autocomplete="current-password" class="${CAJA}" />
          <label class="block text-sm font-medium" for="mfa-reg-codigo">Segundo factor</label>
          <input id="mfa-reg-codigo" name="codigo" autocomplete="one-time-code" maxlength="40" class="${CAJA}" />
          <label class="flex items-center gap-2 text-sm"><input id="mfa-reg-recuperacion" type="checkbox" /> Es un código de recuperación</label>
          <p id="mfa-reg-error" class="hidden ${ALERTA} border-red-200 bg-red-50 text-red-700" role="alert"></p>
          <button type="submit" class="${BOTON}">Generar códigos nuevos</button>
        </form>
      `
      panel.querySelector('#mfa-regenerar').addEventListener('submit', async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        if (form.dataset.submitting === 'true') return
        const password = String(form.password.value ?? '')
        const valor = String(form.codigo.value ?? '').trim()
        const recuperacion = form.querySelector('#mfa-reg-recuperacion').checked
        const errorEl = panel.querySelector('#mfa-reg-error')
        if (!password || !valor) {
          errorEl.textContent = 'Completá la contraseña y un segundo factor.'
          errorEl.classList.remove('hidden')
          return
        }
        form.dataset.submitting = 'true'
        const resultado = await regenerarCodigos(recuperacion
          ? { password, codigoRecuperacion: valor }
          : { password, codigo: valor })
        form.password.value = ''
        form.codigo.value = ''
        if (resultado.estado === 'codigos') {
          const aviso = document.createElement('div')
          aviso.className = 'mt-4 space-y-3'
          aviso.innerHTML = `<p class="${ALERTA} border-amber-200 bg-amber-50 text-amber-900">${resultado.mensaje || 'Guardá estos códigos. No se vuelven a mostrar.'}</p><ol id="mfa-codigos" data-sensible="true" class="grid gap-2 sm:grid-cols-2"></ol><button type="button" id="mfa-continuar" class="${BOTON}">Ya los guardé</button>`
          const lista = aviso.querySelector('#mfa-codigos')
          for (const codigo of resultado.codigos || []) {
            const item = document.createElement('li')
            item.className = 'rounded-md bg-slate-100 px-3 py-2 font-mono text-sm dark:bg-slate-800'
            item.textContent = codigo
            lista.append(item)
          }
          panel.replaceChildren(aviso)
          aviso.querySelector('#mfa-continuar').addEventListener('click', () => {
            salirAlLogin('Volvé a iniciar sesión.')
          })
          return
        }
        if (resultado.estado === 'incierto') {
          salirAlLogin(MFA_RESPUESTA_PERDIDA)
          return
        }
        delete form.dataset.submitting
        errorEl.textContent = mensajeEstado(resultado.estado)
        errorEl.classList.remove('hidden')
      })
    })
  }

  let operacion = null

  raiz.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <span class="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 [&_svg]:h-5 [&_svg]:w-5">${iconLock()}</span>
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Contraseña</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Cambiá la contraseña de tu cuenta.</p>
          </div>
        </div>
        <button type="button" id="seguridad-password-toggle" class="${BOTON} w-full sm:w-auto" aria-expanded="false" aria-controls="seguridad-password-panel">Cambiar contraseña</button>
      </div>
      <div id="seguridad-password-panel" class="mt-4 hidden"></div>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div id="mfa-titulo"></div>
      <p id="mfa-resumen" class="mt-2 text-sm text-slate-500 dark:text-slate-400"></p>
      <button type="button" id="mfa-activar-accion" class="mt-4 hidden ${BOTON} w-full sm:w-auto">Activar autenticación de doble factor</button>
      <div id="mfa-desactivar" class="mt-4 hidden">
        <button type="button" id="mfa-desactivar-accion" class="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800">Desactivar doble factor</button>
        <div id="mfa-desactivar-panel" hidden></div>
      </div>
      <p id="mfa-estado" class="mt-3 hidden text-sm" role="status"></p>
      <button type="button" id="mfa-reintentar" class="mt-3 hidden ${BOTON}">Reintentar</button>
      <div id="mfa-guia" class="mt-4"></div>
    </div>
    <div id="mfa-recuperacion" class="hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6"></div>
  `
  raiz.querySelector('#mfa-titulo').replaceChildren(crearTituloDobleFactor())
  bindTooltipRoot(raiz)

  const panelPassword = raiz.querySelector('#seguridad-password-panel')
  const botonPassword = raiz.querySelector('#seguridad-password-toggle')
  const formPassword = createCambiarPasswordForm({
    idPrefix: 'seguridad-password',
    actualLabel: 'Contraseña actual',
    actualHelpText: 'Ingresá tu contraseña actual. El cambio aplica solo a tu cuenta.',
    showCancel: true,
    onCancel: () => {
      panelPassword.classList.add('hidden')
      botonPassword.setAttribute('aria-expanded', 'false')
      formPassword.clear()
    },
    onSubmit: async (dto) => {
      const resultado = await cambiarPassword(dto)
      await finishPasswordChange(resultado.generacion)
      window.dispatchEvent(new CustomEvent('ca:unauthorized'))
    },
  })
  panelPassword.append(formPassword.element)
  botonPassword.addEventListener('click', () => {
    const abierto = panelPassword.classList.toggle('hidden') === false
    botonPassword.setAttribute('aria-expanded', String(abierto))
    if (abierto) formPassword.focus()
    else formPassword.clear()
  })

  raiz.querySelector('#mfa-activar-accion').addEventListener('click', () => {
    raiz.querySelector('#mfa-activar-accion').classList.add('hidden')
    operacion = null
    guia = crearGuiaActivacion({
      pedirPassword: true,
      onPassword: async (password) => {
        const resultado = await iniciarEnrolamiento(password)
        if (resultado.estado === 'ya-configurado') {
          autenticadorActivo = true
          configuracionDisponible = true
          marcarActivo(true)
          guia.limpiarSensibles()
          raiz.querySelector('#mfa-guia').replaceChildren()
          mostrarRecuperacion()
          return { mensaje: 'El autenticador ya está activo. Podés regenerar los códigos.' }
        }
        if (resultado.estado === 'inicio') {
          operacion = resultado.operacion
          return resultado
        }
        if (resultado.estado === 'incierto') {
          salirAlLogin(MFA_RESPUESTA_PERDIDA)
        }
        return { mensaje: mensajeEstado(resultado.estado) }
      },
      onConfirmar: async (codigo) => {
        const resultado = await confirmarEnrolamiento({ operacion, codigo })
        if (resultado.estado === 'codigos') return resultado
        if (resultado.estado === 'incierto') {
          salirAlLogin(MFA_RESPUESTA_PERDIDA)
          return { mensaje: MFA_RESPUESTA_PERDIDA }
        }
        return { mensaje: mensajeEstado(resultado.estado) }
      },
      onListo: () => salirAlLogin('Volvé a iniciar sesión.'),
    })
    raiz.querySelector('#mfa-guia').replaceChildren(guia.element)
  })

  function identidadActual() {
    return { usuarioId: getCurrentUser()?.id ?? null, token: getToken() }
  }

  function prepararConsulta() {
    marcarActivo(false)
    ocultarRecuperacion()
    raiz.querySelector('#mfa-activar-accion')?.classList.add('hidden')
    raiz.querySelector('#mfa-desactivar')?.classList.add('hidden')
    raiz.querySelector('#mfa-reintentar')?.classList.add('hidden')
    raiz.querySelector('#mfa-guia')?.replaceChildren()
    const resumen = raiz.querySelector('#mfa-resumen')
    if (resumen) resumen.textContent = ''
    const aviso = raiz.querySelector('#mfa-estado')
    if (!aviso) return
    aviso.className = 'mt-3 text-sm text-slate-500 dark:text-slate-400'
    aviso.textContent = 'Consultando el estado de la autenticación…'
  }

  function aplicarEstado(resultado) {
    const aviso = raiz.querySelector('#mfa-estado')
    const resumen = raiz.querySelector('#mfa-resumen')
    const activar = raiz.querySelector('#mfa-activar-accion')
    const desactivar = raiz.querySelector('#mfa-desactivar')
    const reintentar = raiz.querySelector('#mfa-reintentar')
    aviso.className = 'mt-3 hidden text-sm'
    aviso.textContent = ''
    reintentar.classList.add('hidden')
    activar.classList.add('hidden')
    desactivar.classList.add('hidden')
    if (resultado.estado !== 'listo') {
      marcarActivo(false)
      ocultarRecuperacion()
      aviso.className = `mt-3 ${ALERTA} border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100`
      aviso.textContent = resultado.estado === 'restringido'
        ? 'Tenés que cambiar la contraseña antes de continuar.'
        : 'No se pudo consultar el estado.'
      reintentar.classList.remove('hidden')
      return
    }
    configuracionDisponible = resultado.configuracionDisponible === true
    if (resultado.totpHabilitado) {
      autenticadorActivo = true
      marcarActivo(true)
      resumen.textContent = 'El autenticador de esta cuenta está activo.'
      mostrarRecuperacion()
      if (resultado.mfaObligatorio !== true) desactivar.classList.remove('hidden')
      return
    }
    autenticadorActivo = false
    marcarActivo(false)
    ocultarRecuperacion()
    if (configuracionDisponible) {
      resumen.textContent = 'Podés activar una aplicación de códigos para esta cuenta.'
      activar.classList.remove('hidden')
      return
    }
    resumen.textContent = ''
    aviso.className = 'mt-3 text-sm text-slate-500 dark:text-slate-400'
    aviso.textContent = MFA_ENROLAMIENTO_NO_DISPONIBLE
  }

  async function cargarEstado() {
    const turno = ++consulta
    const inicio = identidadActual()
    prepararConsulta()
    const resultado = await consultarEstadoMfa()
    if (turno !== consulta || !raiz.isConnected || !puedeAplicarEstadoMfa(inicio, identidadActual())) return
    aplicarEstado(resultado)
  }

  raiz.querySelector('#mfa-reintentar').addEventListener('click', () => {
    void cargarEstado()
  })

  raiz.querySelector('#mfa-desactivar-accion').addEventListener('click', () => {
    const panel = raiz.querySelector('#mfa-desactivar-panel')
    if (!panel.hidden) return
    panel.hidden = false
    panel.innerHTML = `
      <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">${AVISO_DESACTIVAR}</p>
      <form id="mfa-desactivar-form" class="mt-4 space-y-3" novalidate>
        <label class="block text-sm font-medium" for="mfa-off-password">Contraseña</label>
        <input id="mfa-off-password" name="password" type="password" autocomplete="current-password" class="${CAJA}" />
        <label class="block text-sm font-medium" for="mfa-off-codigo">Segundo factor</label>
        <input id="mfa-off-codigo" name="codigo" autocomplete="one-time-code" maxlength="40" class="${CAJA}" />
        <label class="flex items-center gap-2 text-sm"><input id="mfa-off-recuperacion" type="checkbox" /> Es un código de recuperación</label>
        <p id="mfa-off-error" class="hidden ${ALERTA} border-red-200 bg-red-50 text-red-700" role="alert"></p>
        <button type="submit" class="${BOTON}">Confirmar desactivación</button>
      </form>
    `
    panel.querySelector('#mfa-desactivar-form').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.currentTarget
      if (form.dataset.submitting === 'true') return
      const password = String(form.password.value ?? '')
      const valor = String(form.codigo.value ?? '').trim()
      const recuperacion = form.querySelector('#mfa-off-recuperacion').checked
      const errorEl = panel.querySelector('#mfa-off-error')
      if (!password || !valor) {
        errorEl.textContent = 'Completá la contraseña y un segundo factor.'
        errorEl.classList.remove('hidden')
        return
      }
      form.dataset.submitting = 'true'
      const resultado = await desactivarMfa(recuperacion
        ? { password, codigoRecuperacion: valor }
        : { password, codigo: valor })
      form.password.value = ''
      form.codigo.value = ''
      if (resultado.estado === 'desactivado') {
        salirAlLogin(MENSAJE_DESACTIVADO)
        return
      }
      if (resultado.estado === 'incierto') {
        salirAlLogin(MENSAJE_DESACTIVACION_INCIERTA)
        return
      }
      form.dataset.submitting = 'false'
      errorEl.textContent = mensajeEstado(resultado.estado)
      errorEl.classList.remove('hidden')
    })
  })

  container.replaceChildren(raiz)
  void cargarEstado()
  return () => {
    consulta += 1
    limpiarSensibles()
    unbindTooltipRoot(raiz)
  }
}
