import {
  cancelarSegundoFactor,
  confirmarVinculacion,
  iniciarVinculacion,
} from '../api/auth.js'
import { MFA_CODIGOS_GUARDAR, MFA_RESPUESTA_PERDIDA } from '../api/mfa.js'
import { sanitizePublicErrorMessage } from '../utils/public-error.js'
import { dibujarQr } from '../utils/qr-local.js'

const CAJA = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white'
const BOTON = 'rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60'

export function mostrarVinculacion(view, { intento, expiraEn, onVolver }) {
  const anterior = view.querySelector('#login-form')
  const tarjeta = document.createElement('div')
  tarjeta.id = 'login-form'
  tarjeta.className = anterior.className
  anterior.replaceWith(tarjeta)
  let activo = true
  let enviando = false
  let secreto = null
  let codigos = null
  const limite = Date.parse(expiraEn)
  const timer = window.setInterval(() => {
    if (!activo || enviando) return
    if (Number.isNaN(limite) || limite <= Date.now()) cerrar('El tiempo para configurar el autenticador venció. Iniciá sesión de nuevo.')
  }, 1000)

  function limpiar() {
    secreto = null
    codigos = null
    tarjeta.querySelectorAll('[data-sensible]').forEach((nodo) => {
      nodo.textContent = ''
    })
    const lienzo = tarjeta.querySelector('canvas')
    lienzo?.getContext('2d')?.clearRect(0, 0, lienzo.width, lienzo.height)
  }

  function cerrar(mensaje, duranteEnvio = false) {
    if (!activo || (enviando && !duranteEnvio)) return
    activo = false
    window.clearInterval(timer)
    limpiar()
    cancelarSegundoFactor(intento)
    onVolver(mensaje)
  }

  tarjeta.innerHTML = `
    <div class="space-y-3">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Configurá el autenticador</h2>
      <p class="text-sm text-slate-500">Esta cuenta exige MFA. Todavía no hay una sesión del panel.</p>
      <p id="vinculo-estado" class="text-sm text-slate-500">Preparando la configuración...</p>
      <button type="button" id="vinculo-volver" class="text-sm font-semibold text-slate-600 underline">Volver</button>
    </div>
  `
  tarjeta.querySelector('#vinculo-volver').addEventListener('click', () => cerrar('', true))
  void preparar()

  async function preparar() {
    try {
      const inicio = await iniciarVinculacion(intento)
      if (!activo) return
      secreto = inicio
      mostrarConfiguracion()
    } catch (error) {
      if (!activo) return
      const volver = error?.volver !== false
      if (volver) cerrar(sanitizePublicErrorMessage(error?.message, 'No se pudo preparar el autenticador.'))
    }
  }

  function mostrarConfiguracion() {
    if (!activo) return
    tarjeta.innerHTML = `
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Configurar la aplicación</h2>
        <p class="text-sm text-slate-500">Escaneá el código o ingresá la clave manual. Después confirmá con un código de la aplicación.</p>
        <canvas id="mfa-qr" class="rounded-lg border border-slate-200" width="220" height="220" aria-label="Código QR del autenticador"></canvas>
        <p class="text-sm font-medium">Clave manual</p>
        <p id="mfa-clave" data-sensible="true" class="break-all font-mono text-sm"></p>
        <form id="mfa-confirmar" class="space-y-3" novalidate>
          <label class="block text-sm font-medium" for="mfa-totp">Código de confirmación</label>
          <input id="mfa-totp" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="${CAJA}" />
          <p id="mfa-confirmar-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"></p>
          <div class="flex gap-2">
            <button type="button" id="vinculo-volver" class="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600">Volver</button>
            <button type="submit" class="${BOTON}">Confirmar</button>
          </div>
        </form>
      </div>
    `
    tarjeta.querySelector('#mfa-clave').textContent = secreto?.claveManual || ''
    const lienzo = tarjeta.querySelector('#mfa-qr')
    if (secreto?.uri) {
      void dibujarQr(lienzo, secreto.uri).catch(() => {
        const errorEl = tarjeta.querySelector('#mfa-confirmar-error')
        errorEl.textContent = 'No se pudo dibujar el QR. Usá la clave manual.'
        errorEl.classList.remove('hidden')
      })
    }
    tarjeta.querySelector('#vinculo-volver').addEventListener('click', () => cerrar('', true))
    tarjeta.querySelector('#mfa-confirmar').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.currentTarget
      if (enviando) return
      const codigo = String(form.codigo.value ?? '').trim()
      const errorEl = tarjeta.querySelector('#mfa-confirmar-error')
      if (!codigo) {
        errorEl.textContent = 'Ingresá el código de la aplicación.'
        errorEl.classList.remove('hidden')
        return
      }
      enviando = true
      try {
        const resultado = await confirmarVinculacion({ intento, codigo })
        form.codigo.value = ''
        if (!activo) return
        codigos = resultado.codigos
        secreto = null
        mostrarCodigos(resultado.mensaje)
      } catch (error) {
        form.codigo.value = ''
        if (!activo) return
        if (error?.volver !== false) {
          limpiar()
          cerrar(sanitizePublicErrorMessage(error?.message, MFA_RESPUESTA_PERDIDA), true)
          return
        }
        enviando = false
        errorEl.textContent = sanitizePublicErrorMessage(error?.message, 'El código no es válido.')
        errorEl.classList.remove('hidden')
      }
    })
  }

  function mostrarCodigos(mensaje) {
    enviando = false
    tarjeta.innerHTML = `
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Códigos de recuperación</h2>
        <p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">${MFA_CODIGOS_GUARDAR}</p>
        <p class="text-sm text-slate-600 dark:text-slate-300">${sanitizePublicErrorMessage(mensaje, 'Guardá los códigos y volvé a iniciar sesión con el autenticador.')}</p>
        <ol id="mfa-codigos" data-sensible="true" class="grid gap-2 sm:grid-cols-2"></ol>
        <button type="button" id="vinculo-listo" class="${BOTON}">Volver al inicio de sesión</button>
      </div>
    `
    const lista = tarjeta.querySelector('#mfa-codigos')
    for (const codigo of codigos || []) {
      const item = document.createElement('li')
      item.className = 'rounded-md bg-slate-100 px-3 py-2 font-mono text-sm dark:bg-slate-800'
      item.textContent = codigo
      lista.append(item)
    }
    tarjeta.querySelector('#vinculo-listo').addEventListener('click', () => {
      cerrar('Iniciá sesión con la contraseña y el código del autenticador.', true)
    })
  }
}
