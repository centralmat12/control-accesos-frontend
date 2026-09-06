function skeletonLine(width = 'w-full', height = 'h-3') {
  return `<span class="block ${height} ${width} rounded bg-slate-200 dark:bg-slate-700"></span>`
}

function skeletonRoot(label) {
  const root = document.createElement('div')
  root.className = 'animate-pulse'
  root.setAttribute('role', 'status')
  root.setAttribute('aria-label', label)
  return root
}

export function createTableSkeleton({ rows = 8, columns = 5, label = 'Cargando listado' } = {}) {
  const root = skeletonRoot(label)
  root.classList.add(
    'overflow-hidden',
    'rounded-xl',
    'border',
    'border-slate-200',
    'bg-white',
    'shadow-sm',
  )
  root.innerHTML = `
    <div class="overflow-hidden">
      <div class="flex gap-6 border-b border-slate-200 bg-slate-50 px-4 py-3">
        ${Array.from({ length: columns }, (_, index) =>
          skeletonLine(index === 0 ? 'w-28' : 'w-20', 'h-3'),
        ).join('')}
      </div>
      <div class="divide-y divide-slate-100">
        ${Array.from(
          { length: rows },
          () => `
            <div class="flex min-h-12 items-center gap-6 px-4 py-3">
              ${Array.from({ length: columns }, (_, index) =>
                skeletonLine(index === 0 ? 'w-36' : 'w-24'),
              ).join('')}
            </div>
          `,
        ).join('')}
      </div>
    </div>
  `
  return root
}

export function createDashboardSkeleton() {
  const root = skeletonRoot('Cargando dashboard')
  root.classList.add('space-y-8')
  root.innerHTML = `
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      ${Array.from(
        { length: 4 },
        () => `
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex items-start justify-between gap-4">
              <div class="w-full space-y-3">
                ${skeletonLine('w-28')}
                ${skeletonLine('w-16', 'h-8')}
              </div>
              <span class="h-10 w-10 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700"></span>
            </div>
          </div>
        `,
      ).join('')}
    </div>
    <div data-dashboard-table-skeleton></div>
  `
  root
    .querySelector('[data-dashboard-table-skeleton]')
    ?.replaceChildren(createTableSkeleton({ rows: 6, columns: 6, label: 'Cargando últimas fichadas' }))
  return root
}

export function createDetailSkeleton() {
  const root = skeletonRoot('Cargando detalle')
  root.classList.add('grid', 'gap-4', 'sm:grid-cols-2')
  root.innerHTML = Array.from(
    { length: 6 },
    () => `<div class="space-y-2">${skeletonLine('w-20')}${skeletonLine('w-32', 'h-4')}</div>`,
  ).join('')
  return root
}

export function createViewSkeleton() {
  const root = skeletonRoot('Cargando vista')
  root.classList.add('space-y-4')
  root.innerHTML = `
    ${skeletonLine('w-40', 'h-6')}
    ${skeletonLine('w-64')}
    <div class="h-24 rounded-xl border border-slate-200 bg-white"></div>
  `
  return root
}
