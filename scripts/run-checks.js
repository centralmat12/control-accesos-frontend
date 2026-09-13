import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const files = readdirSync(dir)
  .filter((name) => name.startsWith('check-') && name.endsWith('.js'))
  .sort((a, b) => a.localeCompare(b))

let failed = 0

for (const file of files) {
  console.log(`\n==> ${file}`)
  const result = spawnSync(process.execPath, [join(dir, file)], { stdio: 'inherit' })
  if (result.status !== 0) failed += 1
}

if (failed > 0) {
  console.error(`\n${failed} script(s) failed`)
  process.exit(1)
}

console.log(`\n${files.length} check scripts passed`)
