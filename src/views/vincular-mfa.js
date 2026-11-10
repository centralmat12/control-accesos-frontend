import {
  cancelarSegundoFactor,
  confirmarVinculacion,
  iniciarVinculacion,
} from '../api/auth.js'
import { crearGuiaActivacion, crearTituloDobleFactor } from '../components/guia-activacion-mfa.js'
import { MFA_RESPUESTA_PERDIDA } from '../api/mfa.js'
import { bindTooltipRoot } from '../components/tooltip.js'
import { sanitizePublicErrorMessage } from '../utils/public-error.js'

export function mostrarVinculacion(view, { intento, expiraEn, onVolver }) {
  const anterior = view.querySelector('#login-form')
  const tarjeta = document.createElement('div')
  tarjeta.id = 'login-form'
  tarjeta.className = anterior.className
  anterior.replaceWith(tarjeta)
  let activo = true
  let guia = null
  const limite = Date.parse(expiraEn)
  const timer = window.setInterval(() => {
    if (!activo) return
    if (Number.isNaN(limite) || limite <= Date.now()) cerrar('El tiempo para configurar el autenticador venció. Iniciá sesión de nuevo.')
  }, 1000)

  function cerrar(mensaje, duranteEnvio = false) {
    if (!activo) return
    if (!duranteEnvio && tarjeta.querySelector('[data-submitting="true"]')) return
    activo = false
    window.clearInterval(timer)
    guia?.limpiarSensibles()
    cancelarSegundoFactor(intento)
    onVolver(mensaje)
  }

  tarjeta.innerHTML = `
    <div class="space-y-4">
      <div id="vinculo-titulo"></div>
      <p class="text-sm text-slate-500">Todavía no hay una sesión del panel.</p>
      <p id="vinculo-estado" class="text-sm text-slate-500">Preparando la configuración...</p>
      <div id="vinculo-guia"></div>
      <button type="button" id="vinculo-volver" class="text-sm font-semibold text-slate-600 underline">Volver</button>
    </div>
  `
  tarjeta.querySelector('#vinculo-titulo').replaceChildren(crearTituloDobleFactor({ obligatorio: true }))
  bindTooltipRoot(tarjeta)
  tarjeta.querySelector('#vinculo-volver').addEventListener('click', () => cerrar('', true))
  void preparar()

  async function preparar() {
    try {
      const inicio = await iniciarVinculacion(intento)
      if (!activo) return
      tarjeta.querySelector('#vinculo-estado')?.remove()
      guia = crearGuiaActivacion({
        pedirPassword: false,
        inicio,
        onConfirmar: async (codigo) => {
          try {
            const resultado = await confirmarVinculacion({ intento, codigo })
            if (!activo) return { mensaje: '' }
            if (resultado?.modo === 'codigos') {
              return { estado: 'codigos', codigos: resultado.codigos, mensaje: resultado.mensaje }
            }
            return { mensaje: 'No se pudo confirmar la vinculación.' }
          } catch (error) {
            if (!activo) return { mensaje: '' }
            if (error?.volver !== false) {
              cerrar(sanitizePublicErrorMessage(error?.message, MFA_RESPUESTA_PERDIDA), true)
              return { mensaje: '' }
            }
            return { mensaje: sanitizePublicErrorMessage(error?.message, 'El código no es válido.') }
          }
        },
        onListo: () => cerrar('Iniciá sesión con la contraseña y el código del autenticador.', true),
        onVolver: () => cerrar('', true),
      })
      if (!activo) {
        guia.limpiarSensibles()
        return
      }
      tarjeta.querySelector('#vinculo-guia').replaceChildren(guia.element)
    } catch (error) {
      if (!activo) return
      cerrar(sanitizePublicErrorMessage(error?.message, 'No se pudo preparar el autenticador.'))
    }
  }
}
