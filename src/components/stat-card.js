export function createStatCard({ label, value, icon, accent }) {
  const accents = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  const article = document.createElement('article')
  article.className =
    'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

  article.innerHTML = `
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-slate-500">${label}</p>
        <p class="mt-2 text-3xl font-semibold tracking-tight text-slate-900">${value}</p>
      </div>
      <span class="flex h-10 w-10 items-center justify-center rounded-lg ${accents[accent]}">
        ${icon}
      </span>
    </div>
  `

  return article
}
