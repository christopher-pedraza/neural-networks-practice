// Turns raw LLM replies into question files the app can load.
//
//   node scripts/import-questions.mjs generated/outputs/*.jsonl [--check] [--name <file-stem>]
//
// - strips ``` fences, blank lines and any chatter around the JSONL
// - merges "<source>.partN" replies into one public/data/questions/<source>.jsonl
// - adds the file to public/data/manifest.json (questionFiles)
// - does NOT judge the content: run `npm run validate` afterwards (it reports file:line + problem)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const check = args.includes('--check')
const nameIdx = args.indexOf('--name')
const forcedName = nameIdx >= 0 ? args[nameIdx + 1] : undefined
const inputs = args.filter((a, i) => !a.startsWith('--') && !(nameIdx >= 0 && i === nameIdx + 1))
if (inputs.length === 0) {
  console.error('usage: node scripts/import-questions.mjs <raw-output-files...> [--check] [--name <stem>]')
  process.exit(2)
}

const groups = new Map() // stem -> { lines: string[], from: string[] }
let problems = 0
for (const file of [...inputs].sort()) {
  const stem = forcedName ?? basename(file, extname(file)).replace(/\.part\d+$/i, '').toLowerCase().replace(/[^a-z0-9_.-]+/g, '_')
  const g = groups.get(stem) ?? { lines: [], from: [] }
  groups.set(stem, g)
  g.from.push(file)
  let kept = 0
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((raw, i) => {
      const line = raw.trim()
      if (line === '' || line.startsWith('```')) return
      if (!line.startsWith('{')) {
        console.warn(`  ! ${file}:${i + 1} dropped non-JSON line: ${line.slice(0, 70)}${line.length > 70 ? '…' : ''}`)
        return
      }
      try {
        JSON.parse(line)
      } catch (e) {
        problems++
        console.error(`  ✗ ${file}:${i + 1} invalid JSON (${e.message}) - left out, fix it in the raw file and re-run`)
        return
      }
      g.lines.push(line)
      kept++
    })
  console.log(`${file}: ${kept} question${kept === 1 ? '' : 's'}`)
}

const manifestPath = resolve(root, 'public/data/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
for (const [stem, g] of groups) {
  const rel = `questions/${stem}.jsonl`
  const target = resolve(root, 'public/data', rel)
  const action = existsSync(target) ? 'overwrite' : 'create'
  console.log(`→ ${action} public/data/${rel} (${g.lines.length} questions from ${g.from.length} file${g.from.length === 1 ? '' : 's'})`)
  if (check) continue
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, g.lines.join('\n') + '\n')
  if (!manifest.questionFiles.includes(rel)) manifest.questionFiles.push(rel)
}
if (!check) {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  console.log('\nNext: npm run validate')
} else {
  console.log('\n(--check: nothing written)')
}
process.exit(problems ? 1 : 0)
