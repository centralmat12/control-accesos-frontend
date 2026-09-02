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

export function createPagination({ page, pageCount, onPageChange }) {
  const nav = document.createElement('nav')
  nav.className = 'flex flex-wrap items-center justify-center gap-1'
  nav.setAttribute('aria-label', 'Paginación')

  if (pageCount <= 1) {
    return nav
  }

  const previous = document.createElement('button')
  previous.type = 'button'
  previous.textContent = 'Anterior'
  previous.disabled = page <= 1
  previous.className = pageButtonClass(false, page <= 1)
  previous.addEventListener('click', () => {
    if (page > 1) onPageChange(page - 1)
  })
  nav.append(previous)

  paginationSequence(page, pageCount).forEach((item) => {
    if (item === 'ellipsis') {
      const dots = document.createElement('span')
      dots.className = 'px-2 py-1.5 text-sm text-slate-400'
      dots.textContent = '...'
      nav.append(dots)
      return
    }

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = String(item)
    button.className = pageButtonClass(item === page, false)
    if (item === page) button.setAttribute('aria-current', 'page')
    button.addEventListener('click', () => onPageChange(item))
    nav.append(button)
  })

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
