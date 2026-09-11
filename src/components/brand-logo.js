import { APP_NAME } from '../config/navigation.js'
import {
  BRAND_LOGO,
  BRAND_LOGO_LOGIN,
  BRAND_LOGO_MARK,
  BRAND_LOGO_SIDEBAR,
} from '../config/branding.js'
import { escapeHtml } from '../utils/format.js'

function imageMarkup({ src, alt, width, height, className, extraAttrs = '' }) {
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${width}" height="${height}" class="${className}" decoding="async"${extraAttrs} />`
}

export function brandLogoHorizontalMarkup({ variant = 'login', alt = APP_NAME } = {}) {
  const size = variant === 'sidebar' ? BRAND_LOGO_SIDEBAR : BRAND_LOGO_LOGIN
  const className =
    variant === 'sidebar'
      ? 'h-auto w-[168px] max-w-full object-contain object-left'
      : 'h-auto w-[220px] max-w-full object-contain'

  return `
    ${imageMarkup({
      src: BRAND_LOGO.horizontalBlue,
      alt,
      width: size.width,
      height: size.height,
      className: `${className} dark:hidden`,
    })}
    ${imageMarkup({
      src: BRAND_LOGO.horizontalWhite,
      alt,
      width: size.width,
      height: size.height,
      className: `${className} hidden dark:block`,
    })}
  `
}

export function brandLogoMarkMarkup({ alt = APP_NAME, extraClass = '' } = {}) {
  return imageMarkup({
    src: BRAND_LOGO.circularBlue,
    alt,
    width: BRAND_LOGO_MARK.width,
    height: BRAND_LOGO_MARK.height,
    className: `size-9 object-contain ${extraClass}`.trim(),
    extraAttrs: ' data-brand-mark',
  })
}

export function brandLogoAuthMarkup({ subtitle }) {
  return `
    <div class="mb-8 flex flex-col items-center text-center">
      <h1 class="flex justify-center">
        ${brandLogoHorizontalMarkup({ variant: 'login', alt: APP_NAME })}
      </h1>
      <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(subtitle)}</p>
    </div>
  `
}
