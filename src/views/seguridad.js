import {
  confirmarEnrolamiento,
  iniciarEnrolamiento,
  MFA_CODIGOS_GUARDAR,
  MFA_ENROLAMIENTO_NO_DISPONIBLE,
  MFA_RESPUESTA_PERDIDA,
  regenerarCodigos,
} from '../api/mfa.js'
import { logout, setLoginNotice } from '../api/auth.js'
import { sanitizePublicErrorMessage } from '../utils/public-error.js'
import { dibujarQr } from '../utils/qr-local.js'

const CAJA = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white'
const BOTON = 'rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60'
const ALERTA = 'rounded-lg border px-3 py-2 text-sm'

export async function renderSeguridad(container) {
  const raiz = document.createElement('section')
  raiz.className = 'mx-auto w-full max-w-xl space-y-4'
  let secreto = null
  let codigos = null

  function limpiarSensibles() {
    secreto = null
    codigos = null
    raiz.querySelectorAll('[data-sensible]').forEach((nodo) => {
      nodo.textContent = ''
    })
    const lienzo = raiz.querySelector('canvas')
    lienzo?.getContext('2d')?.clearRect(0, 0, lienzo.width, lienzo.height)
  }

  function aviso(texto, tono = 'error') {
    const clase = tono === 'error'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
    return `<p class="${ALERTA} ${clase}" role="status">${texto}</p>`
  }

  function mostrarInicio() {
    limpiarSensibles()
    raiz.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Activar autenticador</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">El MFA es voluntario. Confirmá tu contraseña para configurar una aplicación de códigos.</p>
        <form id="mfa-activar" class="mt-4 space-y-3" novalidate>
          <label class="block text-sm font-medium" for="mfa-password">Contraseña actual</label>
          <input id="mfa-password" name="password" type="password" autocomplete="current-password" class="${CAJA}" />
          <p id="mfa-activar-error" class="hidden ${ALERTA} border-red-200 bg-red-50 text-red-700" role="alert"></p>
          <button type="submit" class="${BOTON}">Continuar</button>
        </form>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Regenerar códigos</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Si ya activaste el autenticador, generá un conjunto nuevo con tu contraseña y un segundo factor.</p>
        <button type="button" id="mfa-abrir-regenerar" class="mt-4 ${BOTON}">Regenerar</button>
      </div>
    `
    raiz.querySelector('#mfa-activar').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.currentTarget
      if (form.dataset.submitting === 'true') return
      const password = String(form.password.value ?? '')
      const errorEl = raiz.querySelector('#mfa-activar-error')
      errorEl.classList.add('hidden')
      form.dataset.submitting = 'true'
      const resultado = await iniciarEnrolamiento(password)
      form.password.value = ''
      delete form.dataset.submitting
      if (resultado.estado === 'inicio') {
        secreto = resultado
        mostrarConfiguracion()
        return
      }
      if (resultado.estado === 'ya-configurado') {
        errorEl.textContent = 'El autenticador ya está activo. Podés regenerar los códigos.'
        errorEl.classList.remove('hidden')
        return
      }
      errorEl.textContent = mensajeEstado(resultado.estado)
      errorEl.classList.remove('hidden')
    })
    raiz.querySelector('#mfa-abrir-regenerar').addEventListener('click', mostrarRegenerar)
  }

  function mostrarConfiguracion() {
    const actual = secreto
    raiz.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Configurar la aplicación</h2>
        <p class="mt-2 text-sm text-slate-500">Escaneá el código o ingresá la clave manual. Después confirmá con un código de la aplicación.</p>
        <canvas id="mfa-qr" class="mt-4 rounded-lg border border-slate-200" width="220" height="220" aria-label="Código QR del autenticador"></canvas>
        <p class="mt-4 text-sm font-medium">Clave manual</p>
        <p id="mfa-clave" data-sensible="true" class="mt-1 break-all font-mono text-sm"></p>
        <form id="mfa-confirmar" class="mt-4 space-y-3" novalidate>
          <label class="block text-sm font-medium" for="mfa-totp">Código de confirmación</label>
          <input id="mfa-totp" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="${CAJA}" />
          <p id="mfa-confirmar-error" class="hidden ${ALERTA} border-red-200 bg-red-50 text-red-700" role="alert"></p>
          <button type="submit" class="${BOTON}">Confirmar</button>
        </form>
      </div>
    `
    const clave = raiz.querySelector('#mfa-clave')
    clave.textContent = actual?.claveManual || ''
    const lienzo = raiz.querySelector('#mfa-qr')
    if (actual?.uri) {
      void dibujarQr(lienzo, actual.uri).catch(() => {
        const errorEl = raiz.querySelector('#mfa-confirmar-error')
        errorEl.textContent = 'No se pudo dibujar el QR. Usá la clave manual.'
        errorEl.classList.remove('hidden')
      })
    }
    raiz.querySelector('#mfa-confirmar').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.currentTarget
      if (form.dataset.submitting === 'true') return
      const codigo = String(form.codigo.value ?? '').trim()
      const errorEl = raiz.querySelector('#mfa-confirmar-error')
      if (!codigo || !actual?.operacion) {
        errorEl.textContent = 'Ingresá el código de la aplicación.'
        errorEl.classList.remove('hidden')
        return
      }
      form.dataset.submitting = 'true'
      const resultado = await confirmarEnrolamiento({ operacion: actual.operacion, codigo })
      form.codigo.value = ''
      if (resultado.estado === 'codigos') {
        codigos = resultado.codigos
        secreto = null
        mostrarCodigos(resultado.mensaje)
        return
      }
      if (resultado.estado === 'incierto') {
        limpiarSensibles()
        mostrarPerdida()
        return
      }
      delete form.dataset.submitting
      errorEl.textContent = mensajeEstado(resultado.estado)
      errorEl.classList.remove('hidden')
    })
  }

  function mostrarRegenerar() {
    limpiarSensibles()
    raiz.innerHTML = `
      <form id="mfa-regenerar" class="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" novalidate>
        <h2 class="text-lg font-semibold">Regenerar códigos</h2>
        <p class="text-sm text-slate-500">Hace falta la contraseña y un solo segundo factor: el código de la aplicación o un código de recuperación.</p>
        <label class="block text-sm font-medium" for="mfa-reg-password">Contraseña</label>
        <input id="mfa-reg-password" name="password" type="password" autocomplete="current-password" class="${CAJA}" />
        <label class="block text-sm font-medium" for="mfa-reg-codigo">Segundo factor</label>
        <input id="mfa-reg-codigo" name="codigo" autocomplete="one-time-code" maxlength="40" class="${CAJA}" />
        <label class="flex items-center gap-2 text-sm"><input id="mfa-reg-recuperacion" type="checkbox" /> Es un código de recuperación</label>
        <p id="mfa-reg-error" class="hidden ${ALERTA} border-red-200 bg-red-50 text-red-700" role="alert"></p>
        <button type="submit" class="${BOTON}">Generar códigos nuevos</button>
      </form>
    `
    raiz.querySelector('#mfa-regenerar').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.currentTarget
      if (form.dataset.submitting === 'true') return
      const password = String(form.password.value ?? '')
      const valor = String(form.codigo.value ?? '').trim()
      const recuperacion = form.querySelector('#mfa-reg-recuperacion').checked
      const errorEl = raiz.querySelector('#mfa-reg-error')
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
        codigos = resultado.codigos
        mostrarCodigos(resultado.mensaje)
        return
      }
      if (resultado.estado === 'incierto') {
        mostrarPerdida()
        return
      }
      delete form.dataset.submitting
      errorEl.textContent = mensajeEstado(resultado.estado)
      errorEl.classList.remove('hidden')
    })
  }

  function mostrarCodigos(mensaje) {
    const lista = codigos || []
    raiz.innerHTML = `
      <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 class="text-lg font-semibold">Códigos de recuperación</h2>
        ${aviso(MFA_CODIGOS_GUARDAR, 'aviso')}
        <p class="text-sm text-slate-600 dark:text-slate-300">${sanitizePublicErrorMessage(mensaje, 'La sesión se cerró. Volvé a iniciar sesión.')}</p>
        <ol id="mfa-codigos" data-sensible="true" class="grid gap-2 sm:grid-cols-2"></ol>
        <button type="button" id="mfa-continuar" class="${BOTON}">Ya los guardé</button>
      </div>
    `
    const ol = raiz.querySelector('#mfa-codigos')
    for (const codigo of lista) {
      const item = document.createElement('li')
      item.className = 'rounded-md bg-slate-100 px-3 py-2 font-mono text-sm dark:bg-slate-800'
      item.textContent = codigo
      ol.append(item)
    }
    raiz.querySelector('#mfa-continuar').addEventListener('click', async () => {
      limpiarSensibles()
      setLoginNotice('Volvé a iniciar sesión.')
      await logout()
      window.dispatchEvent(new CustomEvent('ca:unauthorized'))
    })
  }

  function mostrarPerdida() {
    raiz.innerHTML = `
      <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        ${aviso(MFA_RESPUESTA_PERDIDA, 'aviso')}
        <button type="button" id="mfa-entrar" class="${BOTON}">Ir al inicio de sesión</button>
      </div>
    `
    raiz.querySelector('#mfa-entrar').addEventListener('click', async () => {
      limpiarSensibles()
      setLoginNotice('Volvé a iniciar sesión.')
      await logout()
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
    return 'No se pudo completar la operación.'
  }

  mostrarInicio()
  container.replaceChildren(raiz)
  return limpiarSensibles
}
