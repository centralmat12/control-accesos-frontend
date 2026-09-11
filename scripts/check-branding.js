import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BRAND_LOGO,
  BRAND_LOGO_LOGIN,
  BRAND_LOGO_MARK,
  BRAND_LOGO_SIDEBAR,
} from '../src/config/branding.js'
import { APP_NAME } from '../src/config/navigation.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

const files = {
  horizontalBlue: 'public/branding/logo-horizontal-blue.png',
  horizontalWhite: 'public/branding/logo-horizontal-white.png',
  circularBlue: 'public/branding/logo-circular-blue.png',
  faviconSvg: 'public/favicon.svg',
}

check('Los recursos de marca existen en public/branding', () => {
  Object.values(files).forEach((relative) => {
    assert.equal(existsSync(join(root, relative)), true, relative)
  })
  assert.equal(BRAND_LOGO.horizontalBlue, '/branding/logo-horizontal-blue.png')
  assert.equal(BRAND_LOGO.horizontalWhite, '/branding/logo-horizontal-white.png')
  assert.equal(BRAND_LOGO.circularBlue, '/branding/logo-circular-blue.png')
})

check('Login y sidebar referencian los logos sin incrustarlos', () => {
  const login = read('src/views/login.js')
  const sidebar = read('src/components/sidebar.js')
  const brand = read('src/components/brand-logo.js')
  const config = read('src/config/branding.js')
  const html = read('index.html')

  assert.match(login, /brandLogoAuthMarkup/)
  assert.match(login, /Iniciá sesión para acceder al panel/)
  assert.equal(login.includes('>CA<'), false)
  assert.equal(login.includes('${APP_NAME}'), false)
  assert.match(sidebar, /brandLogoHorizontalMarkup/)
  assert.match(sidebar, /brandLogoMarkMarkup/)
  assert.match(sidebar, /data-brand-horizontal/)
  assert.match(brand, /data-brand-mark/)
  assert.match(sidebar, /lg:hidden/)
  assert.equal(sidebar.includes('>CA<'), false)
  assert.match(brand, /alt: APP_NAME/)
  assert.match(brand, /object-contain/)
  assert.match(brand, /dark:hidden/)
  assert.match(brand, /hidden dark:block/)
  assert.match(brand, /width="\$\{width\}"/)
  assert.match(brand, /height="\$\{height\}"/)
  assert.match(html, /\/branding\/logo-circular-blue\.png/)
  assert.match(html, /\/favicon\.png/)
  assert.equal(config.includes('data:image'), false)
  assert.equal(brand.includes('data:image'), false)
  assert.equal(login.includes('data:image'), false)
  assert.equal(sidebar.includes('data:image'), false)
})

check('El logo horizontal y el circular no se muestran a la vez', () => {
  const sidebar = read('src/components/sidebar.js')
  assert.match(sidebar, /mark: collapsed \? 'hidden lg:block' : 'hidden'/)
  assert.match(sidebar, /horizontal: collapsed \? 'min-w-0 lg:hidden' : 'min-w-0'/)
  assert.match(sidebar, /classList\.toggle\('lg:hidden', collapsed\)/)
  assert.match(sidebar, /classList\.toggle\('lg:block', collapsed\)/)
  assert.equal(BRAND_LOGO_LOGIN.width >= 200 && BRAND_LOGO_LOGIN.width <= 240, true)
  assert.equal(BRAND_LOGO_SIDEBAR.width <= 168, true)
  assert.equal(BRAND_LOGO_MARK.width >= 32 && BRAND_LOGO_MARK.width <= 40, true)
  assert.equal(APP_NAME, 'Control de Accesos')
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
