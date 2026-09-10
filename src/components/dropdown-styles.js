export const DROPDOWN_TRIGGER_CLASS =
  'inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-900 shadow-sm outline-none hover:bg-slate-50 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'

export const DROPDOWN_PANEL_CLASS =
  'z-[80] max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-900'

export const DROPDOWN_OPTION_CLASS =
  'flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:bg-slate-800'

export const DROPDOWN_OPTION_ACTIVE_CLASS = 'bg-slate-100 dark:bg-slate-800'
export const DROPDOWN_OPTION_SELECTED_CLASS =
  'bg-blue-50 font-medium text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'

export const DROPDOWN_ARROW =
  '<span aria-hidden="true" class="shrink-0 text-slate-400">▾</span>'

export const NATIVE_SELECT_HIDE_CLASS =
  'pointer-events-none absolute h-px w-px overflow-hidden opacity-0'

export function classTokenList(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function addClassTokens(element, value) {
  const tokens = classTokenList(value)
  if (!tokens.length) return
  element.classList.add(...tokens)
}

export function removeClassTokens(element, value) {
  const tokens = classTokenList(value)
  if (!tokens.length) return
  element.classList.remove(...tokens)
}
