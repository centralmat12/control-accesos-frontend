import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

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

function normalizeArchiveList(text) {
  return String(text)
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\.\//, ''))
}

function validateNormalizedEntries(entries) {
  if (!entries.includes('index.html')) {
    throw new Error('El bundle no incluye index.html en la raíz.')
  }
  if (!entries.some((line) => line.startsWith('assets/'))) {
    throw new Error('El bundle no incluye archivos bajo assets/.')
  }
}

check('La validación remota ya no usa tar | grep bajo pipefail', () => {
  const workflow = readFileSync(join(root, '.github/workflows/deploy-frontend.yml'), 'utf8')
  assert.equal(workflow.includes('ARCHIVE_LIST="$STAGE/archive-list.txt"'), true)
  assert.equal(workflow.includes('tar -tzf "$STAGE/bundle.tar.gz" > "$ARCHIVE_LIST"'), true)
  assert.equal(workflow.includes(`sed 's#^\\./##' "$ARCHIVE_LIST"`), true)
  assert.equal(workflow.includes('El bundle no incluye index.html en la raíz.'), true)
  assert.equal(workflow.includes('El bundle no incluye archivos bajo assets/.'), true)
  assert.equal(workflow.includes("tar -tzf \"$STAGE/bundle.tar.gz\" | grep -qx 'index.html'"), false)
  assert.equal(workflow.includes("tar -tzf \"$STAGE/bundle.tar.gz\" | grep -qE"), false)
})

check('Normaliza ./ y acepta un tar con index y assets prefijados', () => {
  const raw = ['./index.html', './assets/', './assets/index-DbuzNFzX.js', './favicon.svg'].join('\n')
  const entries = normalizeArchiveList(raw)
  assert.deepEqual(entries, ['index.html', 'assets/', 'assets/index-DbuzNFzX.js', 'favicon.svg'])
  validateNormalizedEntries(entries)
  assert.equal(raw.split(/\n/).includes('index.html'), false)
})

check('Rechaza un archive sin index.html en la raíz normalizada', () => {
  assert.throws(
    () => validateNormalizedEntries(normalizeArchiveList('./assets/\n./assets/app.js\n')),
    /El bundle no incluye index\.html en la raíz\./,
  )
})

check('Rechaza un archive sin entradas bajo assets/', () => {
  assert.throws(
    () => validateNormalizedEntries(normalizeArchiveList('./index.html\n./favicon.svg\n')),
    /El bundle no incluye archivos bajo assets\/\./,
  )
})

check('Un tar real creado como en CI pasa la validación normalizada', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ca-deploy-archive-'))
  try {
    mkdirSync(join(dir, 'tree', 'assets'), { recursive: true })
    writeFileSync(join(dir, 'tree', 'index.html'), '<!doctype html>\n')
    writeFileSync(join(dir, 'tree', 'assets', 'index-test.js'), 'export {}\n')
    const bundle = join(dir, 'bundle.tar.gz')
    const packed = spawnSync('tar', ['-C', join(dir, 'tree'), '-czf', bundle, '.'], { encoding: 'utf8' })
    assert.equal(packed.status, 0, packed.stderr || packed.error?.message)
    const listed = spawnSync('tar', ['-tzf', bundle], { encoding: 'utf8' })
    assert.equal(listed.status, 0, listed.stderr || listed.error?.message)
    const archiveList = join(dir, 'archive-list.txt')
    writeFileSync(archiveList, listed.stdout)
    const entries = normalizeArchiveList(readFileSync(archiveList, 'utf8'))
    validateNormalizedEntries(entries)
    assert.equal(entries.includes('index.html'), true)
    assert.equal(entries.some((line) => line.startsWith('assets/')), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
