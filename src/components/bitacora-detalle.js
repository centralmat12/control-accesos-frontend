import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { escapeHtml } from '../utils/format.js'
import { etiquetaCampo, formatoFechaBitacora, textoAccion, textoDetalle } from '../utils/bitacora.js'

function row(label, value) {
  if (!value) return ''
  return `<div class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2 text-sm dark:border-slate-800"><dt class="text-slate-500">${escapeHtml(label)}</dt><dd class="min-w-0 text-slate-800 dark:text-slate-100">${escapeHtml(value)}</dd></div>`
}

export function createBitacoraDetalle({ evento, onClose }) {
  const root = document.createElement('div')
  root.className = 'fixed inset-0 z-40'
  const accion = textoAccion(evento)
  const detalle = textoDetalle(evento)
  const cambios = evento.cambios ?? []
  const metadata = Object.entries(evento.metadataSegura ?? {})
  const tecnico = [
    evento.id ? ['Identificador del evento', evento.id] : null,
    evento.entidad?.id ? ['Identificador de entidad', evento.entidad.id] : null,
    evento.resultado ? ['Código de resultado', evento.resultado] : null,
    evento.origen ? ['Origen', evento.origen] : null,
    ...metadata.map(([key, value]) => [etiquetaCampo(key) || key, value]),
  ].filter((item) => item && item[1])

  root.innerHTML = `
    <button type="button" class="absolute inset-0 bg-slate-950/40" data-close aria-label="Cerrar detalle"></button>
    <aside class="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="bitacora-detalle-titulo">
      <header class="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div class="min-w-0">
          <h2 id="bitacora-detalle-titulo" class="text-base font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(accion)}</h2>
          <p class="mt-1 text-sm text-slate-500">${escapeHtml(formatoFechaBitacora(evento.fechaHora))}</p>
        </div>
        <button type="button" class="${BTN_SECONDARY_CLASS} h-8 px-2.5" data-close>Cerrar</button>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <dl>
          ${row('Usuario', evento.usuario?.nombre)}
          ${row('Módulo', evento.modulo)}
          ${row('Acción', accion)}
          ${row('Elemento', evento.entidad?.nombre)}
          ${row('Empresa', evento.empresa)}
          ${row('Sucursal', evento.sucursal)}
          ${row('Resultado', evento.resultado)}
          ${row('Descripción', detalle)}
          ${row('Origen', evento.origen)}
        </dl>
        ${
          cambios.length
            ? `<section class="mt-4">
                <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Cambios</h3>
                <table class="mt-2 w-full text-left text-sm">
                  <thead class="text-xs uppercase tracking-wide text-slate-500">
                    <tr><th class="py-1 pr-2 font-medium">Campo</th><th class="py-1 pr-2 font-medium">Antes</th><th class="py-1 font-medium">Después</th></tr>
                  </thead>
                  <tbody>
                    ${cambios
                      .map(
                        (cambio) => `<tr class="border-t border-slate-100 dark:border-slate-800"><td class="py-1.5 pr-2">${escapeHtml(cambio.campo)}</td><td class="py-1.5 pr-2 text-slate-500">${escapeHtml(cambio.antes || '—')}</td><td class="py-1.5">${escapeHtml(cambio.despues || '—')}</td></tr>`,
                      )
                      .join('')}
                  </tbody>
                </table>
              </section>`
            : ''
        }
        ${
          tecnico.length
            ? `<details class="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <summary class="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200">Información técnica</summary>
                <dl class="px-3 pb-2">
                  ${tecnico.map(([label, value]) => row(label, value)).join('')}
                </dl>
              </details>`
            : ''
        }
      </div>
    </aside>
  `
  root.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', onClose)
  })
  return root
}
