// Merge a slide mapping into a questions file as the `slides` field.
//   node scripts/merge-slides.mjs <mapping.json> <questions.jsonl>
// mapping.json: { "<question id>": { "slides": [{ "deck": "C10_DataPreProcessing", "page": 12 }], "confidence": "high" }, ... }
// Questions without an entry, or with an empty list, are left untouched. Existing `slides` are replaced.
import { readFileSync, writeFileSync } from 'node:fs'

const [, , mapFile, qFile] = process.argv
if (!mapFile || !qFile) {
  console.error('usage: node scripts/merge-slides.mjs <mapping.json> <questions.jsonl>')
  process.exit(1)
}
const map = JSON.parse(readFileSync(mapFile, 'utf8'))
const lines = readFileSync(qFile, 'utf8').split('\n')
const seen = new Set()
let merged = 0
let untouched = 0
const out = lines.map((l) => {
  if (!l.trim()) return l
  const { slides: _old, ...q } = JSON.parse(l)
  const m = map[q.id]
  if (!m?.slides?.length) {
    untouched++
    return l
  }
  seen.add(q.id)
  merged++
  return JSON.stringify({ ...q, slides: m.slides.map(({ deck, page }) => ({ deck, page })) })
})
writeFileSync(qFile, out.join('\n'))
const unknown = Object.keys(map).filter((id) => !seen.has(id) && map[id]?.slides?.length)
console.log(`${qFile}: ${merged} merged, ${untouched} left without slides`)
if (unknown.length) console.warn(`ids in the mapping but not in the file: ${unknown.join(', ')}`)
