import { login } from '../api/auth.js'
import { APP_NAME } from '../config/navigation.js'

export function renderLogin(container, { onSuccess }) {
  const view = document.createElement('div')
  view.className =
    'flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-900'

  view.innerHTML = `
    <div class="w-full max-w-md">
      <div class="mb-8 flex flex-col items-center text-center">
        <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">CA</span>
        <h1 class="mt-4 text-xl font-semibold tracking-tight text-white">${APP_NAME}</h1>
        <p class="mt-1 text-sm text-slate-400">Iniciá sesión para acceder al panel</p>
      </div>

      <form id="login-form" class="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8" novalidate>
        <div class="space-y-4">
          <div>
            <label for="login-email" class="mb-1.5 block text-sm font-medium text-slate-300">Correo</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autocomplete="username"
              required
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              placeholder="correo@empresa.com"
            />
          </div>
          <div>
            <label for="login-password" class="mb-1.5 block text-sm font-medium text-slate-300">Contraseña</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              placeholder="••••••••"
            />
          </div>
        </div>

        <p id="login-error" class="mt-4 hidden rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert"></p>

        <button
          type="submit"
          id="login-submit"
          class="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Iniciar sesión
        </button>
      </form>
    </div>
  `

  const form = view.querySelector('#login-form')
  const errorEl = view.querySelector('#login-error')
  const submitBtn = view.querySelector('#login-submit')

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    const data = new FormData(form)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')

    errorEl.classList.add('hidden')
    errorEl.textContent = ''
    submitBtn.disabled = true
    submitBtn.textContent = 'Ingresando...'

    try {
      await login({ email, password })
      onSuccess()
    } catch (error) {
      errorEl.textContent = error.message || 'No se pudo iniciar sesión.'
      errorEl.classList.remove('hidden')
      submitBtn.disabled = false
      submitBtn.textContent = 'Iniciar sesión'
    }
  })

  container.replaceChildren(view)
  view.querySelector('#login-email')?.focus()
}
