import { displayValue, escapeHtml, formatHorarioDisplay } from '../utils/format.js'
import {
  CUIL_LENGTH,
  DNI_MAX_LENGTH,
  normalizeFieldValue,
  normalizeEmpleadoValues,
  validateEmpleadoValues,
} from '../utils/empleado-data.js'
import { getSucursales } from '../api/sucursales.js'
import { iconPencil } from './icons.js'
import { biometricStatusBadge, employeeStatusBadge } from './badge.js'
import { openModal } from './modal.js'
import {
  bindSucursalDepartamentoCascade,
  fillSucursalOptions,
  parseEntityId,
  selectedOptionLabel,
  setDepartamentoIdle,
} from './sucursal-departamento-selects.js'
import { showToast } from './toast.js'

const EDITABLE_FIELDS = [
  { key: 'legajo', label: 'Legajo' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'dni', label: 'DNI' },
  { key: 'cuil', label: 'CUIL' },
  { key: 'sucursalId', label: 'Sucursal', displayKey: 'sucursal' },
  { key: 'departamentoId', label: 'Departamento', displayKey: 'departamento' },
  { key: 'horario', label: 'Horario' },
]
const HORARIO_STORED = /^([01]\d|2[0-3]):([0-5]\d)\s*(?:-|a)\s*([01]\d|2[0-3]):([0-5]\d)$/i

function optionalValue(value) {
  const trimmed = String(value ?? '').trim()
  return trimmed || null
}

function inputClass() {
  return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60'
}

function fieldTemplate({
  id,
  name,
  label,
  required = false,
  maxLength,
  autocomplete = 'off',
  inputMode,
  help,
}) {
  const describedBy = [help ? `${id}-help` : '', `${id}-error`].filter(Boolean).join(' ')

  return `
    <div>
      <label for="${id}" class="mb-1.5 block text-sm font-medium text-slate-700">${label}</label>
      <input
        id="${id}"
        name="${name}"
        type="text"
        maxlength="${maxLength}"
        autocomplete="${autocomplete}"
        ${inputMode ? `inputmode="${inputMode}"` : ''}
        aria-describedby="${describedBy}"
        ${required ? 'required' : ''}
        class="${inputClass()}"
      />
      ${help ? `<p id="${id}-help" class="mt-1 text-xs text-slate-500">${help}</p>` : ''}
      <p id="${id}-error" class="mt-1 hidden text-sm text-red-600" aria-live="polite"></p>
    </div>
  `
}

function setControlError(errorEl, controls, message) {
  const targets = controls.filter(Boolean)

  if (message) {
    if (errorEl) {
      errorEl.textContent = message
      errorEl.classList.remove('hidden')
    }
    targets.forEach((control) => {
      control.classList.add('border-red-300')
      control.setAttribute('aria-invalid', 'true')
    })
  } else {
    if (errorEl) {
      errorEl.textContent = ''
      errorEl.classList.add('hidden')
    }
    targets.forEach((control) => {
      control.classList.remove('border-red-300')
      control.removeAttribute('aria-invalid')
    })
  }
}

function setFieldError(form, name, message) {
  const error = form.querySelector(`#empleado-${name}-error`)
  const input = form.querySelector(`[name="${name}"]`)
  const horarioDesde = name === 'horario' ? form.querySelector('[name="horarioDesde"]') : null
  const horarioHasta = name === 'horario' ? form.querySelector('[name="horarioHasta"]') : null

  setControlError(error, [input, horarioDesde, horarioHasta], message)
}

function clearFieldErrors(form) {
  ;['legajo', 'nombre', 'apellido', 'dni', 'cuil', 'sucursalId', 'departamentoId', 'horario'].forEach((name) =>
    setFieldError(form, name, ''),
  )
}

function normalizeTime(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''

  const match = text.match(/^(\d{1,2}):([0-5]\d)/)
  if (!match) return ''

  const hours = Number(match[1])
  if (hours > 23) return ''

  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

function readHorario(form) {
  const desde = normalizeTime(form.querySelector('[name="horarioDesde"]')?.value)
  const hasta = normalizeTime(form.querySelector('[name="horarioHasta"]')?.value)
  return { desde, hasta }
}

function readValues(form) {
  const data = new FormData(form)
  const { desde, hasta } = readHorario(form)
  let horario = null
  let horarioError = ''

  if ((desde && !hasta) || (!desde && hasta)) {
    horarioError = 'Completá hora desde y hora hasta, o dejá ambas vacías.'
  } else if (desde && hasta) {
    horario = `${desde}-${hasta}`
  }

  const sucursalSelect = form.querySelector('[name="sucursalId"]')
  const departamentoSelect = form.querySelector('[name="departamentoId"]')

  return normalizeEmpleadoValues({
    legajo: optionalValue(data.get('legajo')),
    nombre: String(data.get('nombre') ?? '').trim(),
    apellido: String(data.get('apellido') ?? '').trim(),
    dni: String(data.get('dni') ?? '').trim(),
    cuil: String(data.get('cuil') ?? '').trim(),
    sucursalId: parseEntityId(sucursalSelect?.value),
    departamentoId: parseEntityId(departamentoSelect?.value),
    sucursal: selectedOptionLabel(sucursalSelect),
    departamento: selectedOptionLabel(departamentoSelect),
    horario,
    horarioError,
  })
}

function splitHorario(horario) {
  const text = String(horario ?? '').trim()
  const match = text.match(HORARIO_STORED)
  if (!match) return { desde: '', hasta: '' }
  return {
    desde: `${match[1]}:${match[2]}`,
    hasta: `${match[3]}:${match[4]}`,
  }
}

function canonicalHorario(horario) {
  const { desde, hasta } = splitHorario(horario)
  return desde && hasta ? `${desde}-${hasta}` : null
}

function snapshotEditable(empleado, { normalize = false } = {}) {
  const source = normalize ? normalizeEmpleadoValues(empleado) : empleado
  const rawOptional = (value) => {
    const current = String(value ?? '')
    return current || null
  }

  return {
    legajo: rawOptional(source.legajo),
    nombre: String(source.nombre ?? ''),
    apellido: String(source.apellido ?? ''),
    dni: String(source.dni ?? ''),
    cuil: String(source.cuil ?? ''),
    sucursalId: parseEntityId(source.sucursalId),
    departamentoId: parseEntityId(source.departamentoId),
    sucursal: rawOptional(source.sucursal),
    departamento: rawOptional(source.departamento),
    horario: canonicalHorario(source.horario),
  }
}

function diffEmpleadoFields(original, draft) {
  const before = snapshotEditable(original)
  const after = snapshotEditable(draft, { normalize: true })

  return EDITABLE_FIELDS.flatMap(({ key, label, displayKey }) => {
    const previous = before[key]
    const next = after[key]
    if (previous === next) return []

    const display =
      key === 'horario'
        ? (value) => (value ? formatHorarioDisplay(value) : '')
        : (value) => value

    return [
      {
        key,
        label,
        before: display(displayKey ? before[displayKey] : previous),
        after: display(displayKey ? after[displayKey] : next),
      },
    ]
  })
}

/**
 * Body parcial para PATCH: solo claves que cambiaron.
 * Opcionales vacíos se envían como "" (el backend ignora null en catálogos/horario).
 */
export function buildEmpleadoPatchDto(original, draft) {
  const before = snapshotEditable(original)
  const after = snapshotEditable(draft, { normalize: true })
  const dto = {}

  for (const { key } of EDITABLE_FIELDS) {
    if (before[key] === after[key]) continue

    if (key === 'sucursalId') {
      if (after.sucursalId) dto.sucursalId = after.sucursalId
      else dto.sucursal = ''
      continue
    }

    if (key === 'departamentoId') {
      if (after.departamentoId) dto.departamentoId = after.departamentoId
      else dto.departamento = ''
      continue
    }

    dto[key] = after[key] == null ? '' : after[key]
  }

  return dto
}

function fillEmpleadoForm(form, values) {
  const normalized = normalizeEmpleadoValues(values)
  const setInput = (name, value) => {
    const input = form.querySelector(`[name="${name}"]`)
    if (input) input.value = value ?? ''
  }

  setInput('legajo', normalized.legajo ?? '')
  setInput('nombre', normalized.nombre ?? '')
  setInput('apellido', normalized.apellido ?? '')
  setInput('dni', normalized.dni ?? '')
  setInput('cuil', normalized.cuil ?? '')

  const { desde, hasta } = splitHorario(values.horario)
  setInput('horarioDesde', desde)
  setInput('horarioHasta', hasta)
}

function fieldNameForControl(control) {
  const name = control?.name ?? ''
  if (name === 'horarioDesde' || name === 'horarioHasta') return 'horario'
  return name
}

function sanitizeDigits(input, maxDigits) {
  const sanitized = input.value.replace(/\D/g, '').slice(0, maxDigits)
  const rejectedCharacters = sanitized !== input.value
  if (rejectedCharacters) input.value = sanitized
  return rejectedCharacters
}

export function createEmpleadoForm({
  empresaId,
  initialValues = null,
  submitLabel = 'Guardar',
  requireEmpresa = true,
  onCancel,
  onSubmit,
}) {
  const wrapper = document.createElement('div')

  wrapper.innerHTML = `
    <form id="empleado-form" class="space-y-4" lang="es-AR" novalidate>
      <p id="empleado-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      <div class="grid gap-4 sm:grid-cols-2">
        ${fieldTemplate({
          id: 'empleado-legajo',
          name: 'legajo',
          label: 'Legajo',
          maxLength: 20,
          help: 'Admite letras y números; el guion solo puede utilizarse entre bloques.',
        })}
        ${fieldTemplate({
          id: 'empleado-dni',
          name: 'dni',
          label: 'DNI (sin puntos ni guiones)',
          required: true,
          maxLength: DNI_MAX_LENGTH,
          inputMode: 'numeric',
          help: 'Solo números.',
        })}
        ${fieldTemplate({ id: 'empleado-nombre', name: 'nombre', label: 'Nombre', required: true, maxLength: 50, autocomplete: 'given-name' })}
        ${fieldTemplate({ id: 'empleado-apellido', name: 'apellido', label: 'Apellido', required: true, maxLength: 50, autocomplete: 'family-name' })}
        ${fieldTemplate({
          id: 'empleado-cuil',
          name: 'cuil',
          label: 'CUIL (sin puntos ni guiones)',
          required: true,
          maxLength: CUIL_LENGTH,
          inputMode: 'numeric',
          help: 'Ingresá los 11 números.',
        })}
        <div>
          <label for="empleado-sucursalId" class="mb-1.5 block text-sm font-medium text-slate-700">Sucursal</label>
          <select id="empleado-sucursalId" name="sucursalId" class="${inputClass()}">
            <option value="">Seleccionar...</option>
          </select>
          <p id="empleado-sucursalId-error" class="mt-1 hidden text-sm text-red-600"></p>
        </div>
        <div>
          <label for="empleado-departamentoId" class="mb-1.5 block text-sm font-medium text-slate-700">Departamento</label>
          <select id="empleado-departamentoId" name="departamentoId" class="${inputClass()}" disabled aria-describedby="empleado-departamento-hint">
            <option value="">Seleccione una sucursal</option>
          </select>
          <p id="empleado-departamento-hint" class="mt-1 text-xs text-slate-500">Seleccione una sucursal</p>
          <p id="empleado-departamentoId-error" class="mt-1 hidden text-sm text-red-600"></p>
        </div>
        <div class="sm:col-span-2">
          <p class="mb-1.5 text-sm font-medium text-slate-700">Horario</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="empleado-horario-desde" class="mb-1.5 block text-xs font-medium text-slate-500">Hora desde</label>
              <input
                id="empleado-horario-desde"
                name="horarioDesde"
                type="time"
                step="60"
                lang="es-AR"
                class="${inputClass()}"
              />
            </div>
            <div>
              <label for="empleado-horario-hasta" class="mb-1.5 block text-xs font-medium text-slate-500">Hora hasta</label>
              <input
                id="empleado-horario-hasta"
                name="horarioHasta"
                type="time"
                step="60"
                lang="es-AR"
                class="${inputClass()}"
              />
            </div>
          </div>
          <p class="mt-1.5 text-xs text-slate-500">Formato 24 horas. Si se completa, se guarda como HH:mm-HH:mm. Los turnos nocturnos (por ejemplo 22:00 a 06:00) son válidos.</p>
          <p id="empleado-horario-error" class="mt-1 hidden text-sm text-red-600"></p>
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          id="empleado-form-cancel"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          id="empleado-form-submit"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ${escapeHtml(submitLabel)}
        </button>
      </div>
    </form>
  `

  const form = wrapper.querySelector('#empleado-form')
  const formError = wrapper.querySelector('#empleado-form-error')
  const submitButton = wrapper.querySelector('#empleado-form-submit')
  const cancelButton = wrapper.querySelector('#empleado-form-cancel')
  const sucursalSelect = form.querySelector('[name="sucursalId"]')
  const departamentoSelect = form.querySelector('[name="departamentoId"]')
  const departamentoHint = form.querySelector('#empleado-departamento-hint')

  setDepartamentoIdle(departamentoSelect, departamentoHint, { includeAll: false })

  const cascade = bindSucursalDepartamentoCascade({
    sucursalSelect,
    departamentoSelect,
    hintEl: departamentoHint,
    includeAll: false,
    onChange: () => {
      setFieldError(form, 'sucursalId', '')
      setFieldError(form, 'departamentoId', '')
      syncSubmitState()
    },
    onDepartamentosError: (error) => {
      if (error.message === 'Sesión expirada o no autorizada.') return
      showToast({
        message: error.message || 'No se pudieron cargar los departamentos.',
        tone: 'error',
      })
    },
  })

  if (initialValues) fillEmpleadoForm(form, initialValues)

  function currentErrors() {
    return validateEmpleadoValues(readValues(form), { initialValues })
  }

  function validateField(name) {
    if (!name) return
    setFieldError(form, name, currentErrors()[name] ?? '')
  }

  function syncSubmitState() {
    const hasValidationErrors = Object.keys(currentErrors()).length > 0
    const hasVisibleErrors = Boolean(form.querySelector('[aria-invalid="true"]'))
    submitButton.disabled =
      form.dataset.submitting === 'true' || hasValidationErrors || hasVisibleErrors
  }

  form.addEventListener('input', (event) => {
    const control = event.target
    const name = fieldNameForControl(control)
    let rejectedCharacters = false

    if (name === 'dni') {
      rejectedCharacters = sanitizeDigits(control, DNI_MAX_LENGTH)
    } else if (name === 'cuil') {
      rejectedCharacters = sanitizeDigits(control, CUIL_LENGTH)
    }

    if (rejectedCharacters) {
      setFieldError(
        form,
        name,
        name === 'dni'
          ? 'El DNI debe contener entre 7 y 8 números.'
          : 'El CUIL debe contener exactamente 11 números.',
      )
    } else {
      validateField(name)
    }
    syncSubmitState()
  })

  form.addEventListener('focusout', (event) => {
    const control = event.target
    const name = fieldNameForControl(control)
    if (control?.matches?.('input[type="text"]') && name) {
      control.value = normalizeFieldValue(name, control.value)
    }
    validateField(name)
    syncSubmitState()
  })

  form.addEventListener('change', (event) => {
    validateField(fieldNameForControl(event.target))
    syncSubmitState()
  })

  if (initialValues) {
    const initialErrors = currentErrors()
    ;['dni', 'cuil'].forEach((name) => {
      if (initialErrors[name]) setFieldError(form, name, initialErrors[name])
    })
  }
  syncSubmitState()

  function showFormError(message) {
    if (!message) {
      formError.textContent = ''
      formError.classList.add('hidden')
      return
    }

    formError.textContent = message
    formError.classList.remove('hidden')
  }

  cancelButton.addEventListener('click', () => {
    onCancel()
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    clearFieldErrors(form)
    showFormError('')

    if (requireEmpresa && (!Number.isFinite(empresaId) || empresaId <= 0)) {
      showFormError('No hay una empresa asociada a la sesión. No se puede dar de alta el empleado.')
      return
    }

    const values = readValues(form)
    const errors = validateEmpleadoValues(values, { initialValues })
    const errorNames = Object.keys(errors)

    if (errorNames.length > 0) {
      errorNames.forEach((name) => setFieldError(form, name, errors[name]))
      syncSubmitState()
      const first = errorNames[0]
      const focusTarget =
        form.querySelector(`[name="${first}"]`) || form.querySelector('[name="horarioDesde"]')
      focusTarget?.focus()
      return
    }

    form.dataset.submitting = 'true'
    submitButton.disabled = true
    submitButton.textContent = 'Guardando...'
    cancelButton.disabled = true

    const { horarioError: _ignored, categoria: _categoria, ...draft } = values

    try {
      await onSubmit({
        empresaId,
        ...draft,
      })
    } catch (error) {
      const message = error.message || 'No se pudieron guardar los cambios.'
      showFormError(message)
      showToast({ message, tone: 'error' })
    } finally {
      if (submitButton.isConnected) {
        delete form.dataset.submitting
        submitButton.textContent = submitLabel
        cancelButton.disabled = false
        syncSubmitState()
      }
    }
  })

  queueMicrotask(() => form.querySelector('[name="nombre"]')?.focus())

  ;(async () => {
    try {
      const sucursales = await getSucursales()
      if (!form.isConnected) return
      fillSucursalOptions(sucursalSelect, sucursales, {
        currentId: initialValues?.sucursalId,
      })
      if (parseEntityId(sucursalSelect.value)) {
        await cascade.reloadDepartamentos({ preserveDepartamentoId: initialValues?.departamentoId })
      } else {
        setDepartamentoIdle(departamentoSelect, departamentoHint, { includeAll: false })
      }
      syncSubmitState()
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') return
      if (!form.isConnected) return
      fillSucursalOptions(sucursalSelect, [])
      setDepartamentoIdle(departamentoSelect, departamentoHint, { includeAll: false })
      const message = error.message || 'No se pudieron cargar las sucursales.'
      showFormError(message)
      showToast({ message, tone: 'error' })
      syncSubmitState()
    }
  })()

  return wrapper
}

export function createEmpleadoDetail(empleado) {
  const wrapper = document.createElement('div')
  const horario = formatHorarioDisplay(empleado.horario)
  const rows = [
    ['Legajo', empleado.legajo],
    ['Nombre', empleado.nombre],
    ['Apellido', empleado.apellido],
    ['DNI', empleado.dni],
    ['CUIL', empleado.cuil],
    ['Departamento', empleado.departamento],
    ['Categoría', empleado.categoria],
    ['Sucursal', empleado.sucursal],
    ['Horario', horario],
  ]

  wrapper.innerHTML = `
    <dl class="grid gap-3 sm:grid-cols-2">
      ${rows
        .map(
          ([label, value]) => `
            <div>
              <dt class="text-xs font-medium uppercase tracking-wide text-slate-500">${escapeHtml(label)}</dt>
              <dd class="mt-1 text-sm text-slate-900">${displayValue(value)}</dd>
            </div>
          `,
        )
        .join('')}
      <div class="sm:col-span-2">
        <dt class="text-xs font-medium uppercase tracking-wide text-slate-500">Huella biométrica</dt>
        <dd class="mt-1.5 flex flex-wrap items-center gap-1.5">${biometricStatusBadge(empleado.tieneHuella)}</dd>
      </div>
    </dl>
    <div class="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-900">
      <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Estado</p>
      <div class="mt-2 flex justify-center">${employeeStatusBadge(empleado.activo)}</div>
    </div>
    <p class="mt-4 text-xs text-slate-500">La información biométrica no se gestiona en este panel. El enrolamiento de huella se realiza desde la app de escritorio.</p>
  `

  return wrapper
}

function createReadonlyMeta(empleado) {
  const meta = document.createElement('div')
  meta.className =
    'mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center'
  meta.innerHTML = `
    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Estado</p>
    <div class="mt-2 flex justify-center">${employeeStatusBadge(empleado.activo)}</div>
  `

  return meta
}

function promptEmpleadoChangesConfirm(changes) {
  return new Promise((resolve) => {
    let settled = false

    const content = document.createElement('div')
    content.innerHTML = `
      <div class="space-y-3">
        ${changes
          .map(
            (change) => `
              <div class="rounded-lg border border-slate-200 px-3 py-2">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">${escapeHtml(change.label)}</p>
                <p class="mt-1 text-sm text-slate-600"><span class="font-medium text-slate-500">Antes:</span> ${displayValue(change.before)}</p>
                <p class="text-sm text-slate-900"><span class="font-medium text-slate-500">Después:</span> ${displayValue(change.after)}</p>
              </div>
            `,
          )
          .join('')}
      </div>
      <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" data-action="cancel" data-autofocus class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Cancelar
        </button>
        <button type="button" data-action="confirm" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          Confirmar cambios
        </button>
      </div>
    `

    const finish = (value) => {
      if (settled) return
      settled = true
      modal.close()
      resolve(value)
    }

    const modal = openModal({
      title: 'Confirmar modificaciones',
      content,
      labelledBy: 'empleado-changes-title',
      stacked: true,
      onClose: () => {
        if (!settled) resolve(false)
      },
    })

    content.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish(false))
    content.querySelector('[data-action="confirm"]')?.addEventListener('click', () => finish(true))
  })
}

export function createEmpleadoRecord({ empleado, empresaLabel = '', persistUpdate, onUpdated }) {
  void empresaLabel
  const root = document.createElement('div')
  let current = empleado

  function showView() {
    const view = document.createElement('div')
    view.append(createEmpleadoDetail(current))

    const actions = document.createElement('div')
    actions.className = 'mt-5 flex justify-end border-t border-slate-100 pt-4'
    actions.innerHTML = `
      <button
        type="button"
        id="empleado-edit"
        class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        ${iconPencil()}
        Editar datos
      </button>
    `
    actions.querySelector('#empleado-edit')?.addEventListener('click', showEdit)
    view.append(actions)
    root.replaceChildren(view)
  }

  function showEdit() {
    const view = document.createElement('div')
    view.append(createReadonlyMeta(current))

    const notice = document.createElement('p')
    notice.className = 'mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800'
    notice.textContent = 'Estás editando los datos del empleado. El estado y la información biométrica no se modifican aquí.'
    view.append(notice)

    const form = createEmpleadoForm({
      empresaId: Number(current.empresaId),
      initialValues: current,
      submitLabel: 'Guardar cambios',
      requireEmpresa: false,
      onCancel: showView,
      onSubmit: async (draft) => {
        const changes = diffEmpleadoFields(current, draft)
        if (changes.length === 0) {
          throw new Error('No hay cambios pendientes.')
        }

        const confirmed = await promptEmpleadoChangesConfirm(changes)
        if (!confirmed) return

        const updated = await persistUpdate(current.id, buildEmpleadoPatchDto(current, draft))
        if (updated) current = updated
        onUpdated?.(current)
        showView()
      },
    })

    view.append(form)
    root.replaceChildren(view)
  }

  showView()
  return root
}

export function createDeactivateConfirm({ empleado, onCancel, onConfirm }) {
  const wrapper = document.createElement('div')
  const name = [empleado.nombre, empleado.apellido].filter(Boolean).join(' ') || 'este empleado'

  wrapper.innerHTML = `
    <p id="empleado-deactivate-error" class="mb-3 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
    <p class="text-sm text-slate-600">
      ¿Desactivar a <span class="font-medium text-slate-900">${escapeHtml(name)}</span>?
      Dejará de aparecer en el listado y no podrá fichar mientras esté inactivo.
    </p>
    <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        id="empleado-deactivate-cancel"
        data-autofocus
        class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Cancelar
      </button>
      <button
        type="button"
        id="empleado-deactivate-confirm"
        class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Desactivar
      </button>
    </div>
  `

  const error = wrapper.querySelector('#empleado-deactivate-error')
  const cancelButton = wrapper.querySelector('#empleado-deactivate-cancel')
  const confirmButton = wrapper.querySelector('#empleado-deactivate-confirm')

  cancelButton.addEventListener('click', onCancel)

  confirmButton.addEventListener('click', async () => {
    error.classList.add('hidden')
    error.textContent = ''
    confirmButton.disabled = true
    cancelButton.disabled = true
    confirmButton.textContent = 'Desactivando...'

    try {
      await onConfirm()
    } catch (err) {
      const message = err.message || 'No se pudo desactivar el empleado.'
      error.textContent = message
      error.classList.remove('hidden')
      showToast({ message, tone: 'error' })
      confirmButton.disabled = false
      cancelButton.disabled = false
      confirmButton.textContent = 'Desactivar'
    }
  })

  return wrapper
}
