import { MFA_CODIGOS_GUARDAR } from '../api/mfa.js'
import { sanitizePublicErrorMessage } from '../utils/public-error.js'
import { dibujarQr } from '../utils/qr-local.js'
import { escapeHtml } from '../utils/format.js'
import { iconInfo } from './icons.js'
import { bindTooltipRoot } from './tooltip.js'

export const AYUDA_DOBLE_FACTOR =
  'Al iniciar sesión, vas a ingresar tu contraseña y un código temporal de tu autenticador. Así protegés tu cuenta si alguien consigue tu contraseña.'

const PASOS = [
  { id: 'password', titulo: 'Confirmá tu contraseña actual.' },
  { id: 'qr', titulo: 'Abrí una app como Google Authenticator, agregá una cuenta y escaneá el QR. Si no podés escanear, usá la clave manual.' },
  { id: 'codigo', titulo: 'Ingresá el código de seis dígitos para confirmar la vinculación.' },
  { id: 'codigos', titulo: 'Guardá los códigos de recuperación. Se muestran una sola vez.' },
]

const CAJA = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white'
const BOTON = 'rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60'

export function crearTituloDobleFactor({ obligatorio = false } = {}) {
  const bloque = document.createElement('div')
  bloque.className = 'flex flex-wrap items-center gap-2'
  bloque.innerHTML = `
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Autenticación de doble factor</h2>
    <button type="button" id="mfa-ayuda" class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-100" data-tooltip="${escapeHtml(AYUDA_DOBLE_FACTOR)}" data-tooltip-compact aria-label="Ayuda sobre la autenticación de doble factor">${iconInfo('h-4 w-4')}</button>
    ${obligatorio ? '<p class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">Activación obligatoria</p>' : ''}
  `
  return bloque
}

export function crearGuiaActivacion({
  pedirPassword = false,
  onPassword,
  onConfirmar,
  onListo,
  onVolver,
  inicio = null,
} = {}) {
  const raiz = document.createElement('div')
  raiz.className = 'space-y-4'
  let secreto = inicio
  let codigos = null
  const pasos = PASOS.filter((paso) => pedirPassword || paso.id !== 'password')
  let actual = inicio ? 'qr' : (pedirPassword ? 'password' : 'qr')

  function limpiarSensibles() {
    secreto = null
    codigos = null
    raiz.querySelectorAll('[data-sensible]').forEach((nodo) => {
      nodo.textContent = ''
    })
    const lienzo = raiz.querySelector('canvas')
    lienzo?.getContext('2d')?.clearRect(0, 0, lienzo.width, lienzo.height)
  }

  function pintarLista() {
    const lista = raiz.querySelector('#mfa-pasos')
    lista.replaceChildren()
    pasos.forEach((paso, indice) => {
      const item = document.createElement('li')
      const activo = paso.id === actual
      item.className = activo
        ? 'text-sm font-medium text-slate-900 dark:text-slate-100'
        : 'text-sm text-slate-500 dark:text-slate-400'
      item.textContent = `${indice + 1}. ${paso.titulo}`
      if (activo) item.setAttribute('aria-current', 'step')
      lista.append(item)
    })
  }

  function base() {
    raiz.innerHTML = `
      <ol id="mfa-pasos" class="space-y-2"></ol>
      <div id="mfa-paso"></div>
    `
    pintarLista()
  }

  function mostrarPassword() {
    actual = 'password'
    base()
    const paso = raiz.querySelector('#mfa-paso')
    paso.innerHTML = `
      <form id="mfa-password-form" class="space-y-3" novalidate>
        <label class="block text-sm font-medium" for="mfa-password">Contraseña actual</label>
        <input id="mfa-password" name="password" type="password" autocomplete="current-password" class="${CAJA}" />
        <p id="mfa-password-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"></p>
        <button type="submit" class="${BOTON}">Continuar</button>
      </form>
    `
    paso.querySelector('#mfa-password-form').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.currentTarget
      if (form.dataset.submitting === 'true') return
      const password = String(form.password.value ?? '')
      const errorEl = paso.querySelector('#mfa-password-error')
      errorEl.classList.add('hidden')
      if (!password) {
        errorEl.textContent = 'Ingresá tu contraseña actual.'
        errorEl.classList.remove('hidden')
        return
      }
      form.dataset.submitting = 'true'
      const resultado = await onPassword(password)
      form.password.value = ''
      delete form.dataset.submitting
      if (resultado?.estado === 'inicio') {
        secreto = resultado
        mostrarQr()
        return
      }
      errorEl.textContent = resultado?.mensaje || 'No se pudo continuar.'
      errorEl.classList.remove('hidden')
    })
  }

  function mostrarQr() {
    actual = 'qr'
    const datos = secreto
    base()
    const paso = raiz.querySelector('#mfa-paso')
    paso.innerHTML = `
      <canvas id="mfa-qr" class="rounded-lg border border-slate-200" width="220" height="220" aria-label="Código QR del autenticador"></canvas>
      <p class="mt-4 text-sm font-medium">Clave manual</p>
      <p id="mfa-clave" data-sensible="true" class="mt-1 break-all font-mono text-sm"></p>
      <form id="mfa-confirmar" class="mt-4 space-y-3" novalidate>
        <label class="block text-sm font-medium" for="mfa-totp">Código de seis dígitos</label>
        <input id="mfa-totp" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="${CAJA}" />
        <p id="mfa-confirmar-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"></p>
        <div class="flex flex-col gap-2 sm:flex-row">
          ${onVolver ? '<button type="button" id="mfa-guia-volver" class="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600">Volver</button>' : ''}
          <button type="submit" class="${BOTON}">Confirmar</button>
        </div>
      </form>
    `
    pintarLista()
    paso.querySelector('#mfa-clave').textContent = datos?.claveManual || ''
    const lienzo = paso.querySelector('#mfa-qr')
    if (datos?.uri) {
      void dibujarQr(lienzo, datos.uri).catch(() => {
        const errorEl = paso.querySelector('#mfa-confirmar-error')
        errorEl.textContent = 'No se pudo dibujar el QR. Usá la clave manual.'
        errorEl.classList.remove('hidden')
      })
    }
    paso.querySelector('#mfa-guia-volver')?.addEventListener('click', () => onVolver?.())
    paso.querySelector('#mfa-confirmar').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.currentTarget
      if (form.dataset.submitting === 'true') return
      const codigo = String(form.codigo.value ?? '').trim()
      const errorEl = paso.querySelector('#mfa-confirmar-error')
      if (!/^\d{6}$/.test(codigo)) {
        errorEl.textContent = 'Ingresá el código de seis dígitos.'
        errorEl.classList.remove('hidden')
        return
      }
      form.dataset.submitting = 'true'
      const resultado = await onConfirmar(codigo)
      form.codigo.value = ''
      if (resultado?.estado === 'codigos') {
        codigos = resultado.codigos
        secreto = null
        mostrarCodigos(resultado.mensaje)
        return
      }
      delete form.dataset.submitting
      errorEl.textContent = resultado?.mensaje || 'El código no es válido.'
      errorEl.classList.remove('hidden')
    })
  }

  function mostrarCodigos(mensaje) {
    actual = 'codigos'
    base()
    const paso = raiz.querySelector('#mfa-paso')
    paso.innerHTML = `
      <p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">${MFA_CODIGOS_GUARDAR}</p>
      <p class="text-sm text-slate-600 dark:text-slate-300">${sanitizePublicErrorMessage(mensaje, 'Guardá los códigos y volvé a iniciar sesión.')}</p>
      <ol id="mfa-codigos" data-sensible="true" class="grid gap-2 sm:grid-cols-2"></ol>
      <button type="button" id="mfa-continuar" class="${BOTON}">Ya los guardé</button>
    `
    pintarLista()
    const lista = paso.querySelector('#mfa-codigos')
    for (const codigo of codigos || []) {
      const item = document.createElement('li')
      item.className = 'rounded-md bg-slate-100 px-3 py-2 font-mono text-sm dark:bg-slate-800'
      item.textContent = codigo
      lista.append(item)
    }
    paso.querySelector('#mfa-continuar').addEventListener('click', () => {
      limpiarSensibles()
      onListo?.()
    })
  }

  bindTooltipRoot(raiz)
  if (actual === 'password') mostrarPassword()
  else mostrarQr()

  return { element: raiz, limpiarSensibles }
}
