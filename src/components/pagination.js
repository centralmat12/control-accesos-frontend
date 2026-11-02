import { paginationSequence } from '../utils/paginate.js'

function pageButtonClass(active, disabled) {
  if (disabled) {
    return 'rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-400 cursor-not-allowed'
  }

  if (active) {
    return 'rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white'
  }

  return 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100'
}

function appendPageButtons(nav, page, pageCount, onPageChange, { separators = false } = {}) {
  paginationSequence(page, pageCount).forEach((item, index) => {
    if (separators && index > 0) nav.append(dot())
    if (item === 'ellipsis') {
      const dots = document.createElement('span')
      dots.className = 'px-1 py-1.5 text-sm text-slate-400'
      dots.textContent = '…'
      nav.append(dots)
      return
    }

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = String(item)
    button.className = `${pageButtonClass(item === page, false)}${separators ? ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500' : ''}`
    if (item === page) button.setAttribute('aria-current', 'page')
    button.addEventListener('click', () => onPageChange(item))
    nav.append(button)
  })
}

function dot() {
  const mark = document.createElement('span')
  mark.className = 'px-0.5 text-sm text-slate-300 dark:text-slate-600'
  mark.setAttribute('aria-hidden', 'true')
  mark.textContent = '·'
  return mark
}

export function createPagination({ page, pageCount, onPageChange, summary = '' }) {
  const nav = document.createElement('nav')
  nav.setAttribute('aria-label', 'Paginación')

  if (pageCount <= 1) {
    nav.className = 'flex flex-wrap items-center justify-center gap-1'
    return nav
  }

  if (summary) {
    nav.className = 'flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between'
    const label = document.createElement('p')
    label.className = 'text-sm text-slate-600 dark:text-slate-300'
    label.textContent = summary
    const controls = document.createElement('div')
    controls.className = 'flex flex-wrap items-center justify-end gap-1'
    const previous = document.createElement('button')
    previous.type = 'button'
    previous.textContent = 'Anterior'
    previous.disabled = page <= 1
    previous.className = `${pageButtonClass(false, page <= 1)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`
    previous.addEventListener('click', () => {
      if (page > 1) onPageChange(page - 1)
    })
    const status = document.createElement('span')
    status.className = 'px-1 text-sm text-slate-600 sm:hidden dark:text-slate-300'
    status.textContent = `Página ${page} de ${pageCount}`
    const pages = document.createElement('span')
    pages.className = 'hidden items-center gap-1 sm:inline-flex'
    appendPageButtons(pages, page, pageCount, onPageChange, { separators: true })
    const next = document.createElement('button')
    next.type = 'button'
    next.textContent = 'Siguiente'
    next.disabled = page >= pageCount
    next.className = `${pageButtonClass(false, page >= pageCount)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`
    next.addEventListener('click', () => {
      if (page < pageCount) onPageChange(page + 1)
    })
    controls.append(previous, dot(), status, pages, dot(), next)
    nav.append(label, controls)
    return nav
  }

  nav.className = 'flex flex-wrap items-center justify-center gap-1'

  const previous = document.createElement('button')
  previous.type = 'button'
  previous.textContent = 'Anterior'
  previous.disabled = page <= 1
  previous.className = pageButtonClass(false, page <= 1)
  previous.addEventListener('click', () => {
    if (page > 1) onPageChange(page - 1)
  })
  nav.append(previous)

  appendPageButtons(nav, page, pageCount, onPageChange)

  const next = document.createElement('button')
  next.type = 'button'
  next.textContent = 'Siguiente'
  next.disabled = page >= pageCount
  next.className = pageButtonClass(false, page >= pageCount)
  next.addEventListener('click', () => {
    if (page < pageCount) onPageChange(page + 1)
  })
  nav.append(next)

  return nav
}
