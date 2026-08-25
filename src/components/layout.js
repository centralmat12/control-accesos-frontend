import { createHeader } from './header.js'
import { createSidebar, setSidebarOpen } from './sidebar.js'

export function createLayout({ currentView, user, onNavigate, onLogout }) {
  const root = document.createElement('div')
  root.className = 'min-h-screen bg-slate-50 text-slate-900'

  const overlay = document.createElement('div')
  overlay.id = 'sidebar-overlay'
  overlay.className =
    'fixed inset-0 z-30 hidden bg-slate-950/50 opacity-0 transition-opacity lg:hidden'
  overlay.addEventListener('click', () => setSidebarOpen(false))

  const shell = document.createElement('div')
  shell.className = 'lg:pl-72'

  const content = document.createElement('div')
  content.className = 'flex min-h-screen flex-col'

  const main = document.createElement('main')
  main.id = 'app-main'
  main.className = 'flex-1 p-4 lg:p-8'

  content.append(createHeader({ currentView, user, onLogout }), main)
  shell.append(content)
  root.append(createSidebar({ currentView, onNavigate }), overlay, shell)

  return { root, main }
}
