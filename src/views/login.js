import { login } from '../api/auth.js'
import { APP_NAME } from '../config/navigation.js'
import { createThemeToggle } from '../components/theme-toggle.js'

export function renderLogin(container, { onSuccess }) {
  const view = document.createElement('div')
  view.className =
    'relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100'

  view.innerHTML = `
    <div id="login-theme-toggle" class="absolute right-4 top-4 sm:right-6 sm:top-6"></div>
    <div class="w-full max-w-md">
      <div class="mb-8 flex flex-col items-center text-center">
        <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">CA</span>
        <h1 class="mt-4 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">${APP_NAME}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Iniciá sesión para acceder al panel</p>
      </div>

      <form id="login-form" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8" novalidate>
        <div class="space-y-4">
          <div>
            <label for="login-email" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Correo</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autocomplete="username"
              required
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
              placeholder="correo@empresa.com"
            />
          </div>
          <div>
            <label for="login-password" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
              placeholder="••••••••"
            />
          </div>
        </div>

        <p id="login-error" class="mt-4 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert"></p>

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

  view.querySelector('#login-theme-toggle')?.replaceChildren(createThemeToggle())

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
