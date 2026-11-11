// Validates public/data/** against schema/*.json plus cross-field rules the
// JSON Schema cannot express. Run: npm run validate  (also runs before build)
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import katex from 'katex'
import { normalize } from '../src/lib/normalize.ts'
import { tokenize } from '../src/lib/richtext.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(root, 'public/data')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const errors = []
const fail = (where, msg) => errors.push(`${where}: ${msg}`)

const ajv = new Ajv2020({ allErrors: true })
const validateQuestion = ajv.compile(readJson(resolve(root, 'schema/question.schema.json')))
const validateReference = ajv.compile(readJson(resolve(root, 'schema/reference.schema.json')))
// Which content fields belong to which type (everything else is common). Gives readable
// errors instead of Ajv's "must NOT be valid" when e.g. a calculation carries a `description`.
const FIELDS_BY_TYPE = {
  fill_blank: ['description', 'code', 'hints', 'blanks'],
  find_fix: ['description', 'code', 'hints', 'errors'],
  multiple_choice: ['prompt', 'code', 'hints', 'selection', 'options'],
  calculation: ['prompt', 'code', 'hints', 'parts'],
  param_count: ['prompt', 'code', 'hints', 'parts'],
  open_ended: ['prompt', 'code', 'hints', 'model_answer', 'key_points'],
}
const ALL_CONTENT_FIELDS = [...new Set(Object.values(FIELDS_BY_TYPE).flat())]
const strayFields = (q) =>
  FIELDS_BY_TYPE[q?.type] ? ALL_CONTENT_FIELDS.filter((f) => f in q && !FIELDS_BY_TYPE[q.type].includes(f)) : []
const fmt = (errs) => errs.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ')

// ---- manifest -------------------------------------------------------------
const manifestPath = resolve(dataDir, 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error('public/data/manifest.json is missing')
  process.exit(1)
}
const manifest = readJson(manifestPath)
if (!Array.isArray(manifest.questionFiles) || typeof manifest.reference !== 'string') {
  console.error('manifest.json must be { "questionFiles": string[], "reference": string }')
  process.exit(1)
}

// ---- reference ------------------------------------------------------------
const refNames = new Set()
const refPath = resolve(dataDir, manifest.reference)
if (!existsSync(refPath)) {
  fail(manifest.reference, 'file listed in manifest does not exist')
} else {
  const ref = readJson(refPath)
  if (!validateReference(ref)) fail(manifest.reference, fmt(validateReference.errors))
  for (const e of ref.entries ?? []) {
    if (refNames.has(e.name)) fail(manifest.reference, `duplicate entry name "${e.name}"`)
    refNames.add(e.name)
  }
  for (const e of ref.entries ?? [])
    for (const s of e.see_also ?? [])
      if (!refNames.has(s) && !(ref.entries ?? []).some((x) => x.name === s))
        fail(manifest.reference, `"${e.name}".see_also: unknown entry "${s}"`)
}

// ---- questions ------------------------------------------------------------
const seenIds = new Map()
let total = 0
const allQuestions = []
const BLANK_RE = /<<BLANK:([A-Za-z0-9_-]+)>>/g
// Math is written as $...$ / $$...$$ and rendered by KaTeX; everything outside of it must be plain text.
// A single backslash before t/b/f/r inside a JSON string is an escape (\\times -> TAB + "imes"), so
// control characters mean the generator forgot to double the backslash.
const CONTROL_RE = /[\t\b\f\r\v]/
const STRAY_TEX_RE = /\\(?:\(|\[|[A-Za-z]{2,})/
// Generators sometimes copy the source's option labels / answer-key markers into the text.
const OPTION_LABEL_RE = /^\s*(?:option\s+)?[A-Ha-h][.):]\s/i

for (const file of manifest.questionFiles) {
  const p = resolve(dataDir, file)
  if (!existsSync(p)) {
    fail(file, 'file listed in manifest does not exist')
    continue
  }
  const text = readFileSync(p, 'utf8')
  let items = []
  if (file.endsWith('.jsonl')) {
    text.split('\n').forEach((line, i) => {
      if (!line.trim()) return
      try {
        items.push({ q: JSON.parse(line), where: `${file}:${i + 1}` })
      } catch (e) {
        fail(`${file}:${i + 1}`, `invalid JSON (${e.message})`)
      }
    })
  } else {
    try {
      const arr = JSON.parse(text)
      if (!Array.isArray(arr)) throw new Error('top level must be an array')
      items = arr.map((q, i) => ({ q, where: `${file}[${i}]` }))
    } catch (e) {
      fail(file, e.message)
    }
  }

  for (const { q, where } of items) {
    total++
    const tag = `${where} (${q?.id ?? '?'})`
    if (!validateQuestion(q)) {
      const stray = strayFields(q)
      fail(
        tag,
        fmt(validateQuestion.errors) +
          (stray.length ? ` -- type "${q.type}" must not have: ${stray.map((f) => `"${f}"`).join(', ')}` : ''),
      )
      continue
    }
    if (seenIds.has(q.id)) fail(tag, `duplicate id, also at ${seenIds.get(q.id)}`)
    seenIds.set(q.id, where)
    allQuestions.push(q)

    for (const r of q.related_reference ?? [])
      if (!refNames.has(r)) fail(tag, `related_reference "${r}" not found in reference file`)

    const lines = (q.code ?? '').split('\n')

    if (q.type === 'fill_blank') {
      const inCode = [...q.code.matchAll(BLANK_RE)].map((m) => m[1])
      const declared = q.blanks.map((b) => b.id)
      for (const id of new Set(inCode))
        if (!declared.includes(id)) fail(tag, `marker <<BLANK:${id}>> has no entry in "blanks"`)
      for (const id of declared)
        if (!inCode.includes(id)) fail(tag, `blank "${id}" has no <<BLANK:${id}>> marker in code`)
      if (new Set(inCode).size !== inCode.length) fail(tag, 'a <<BLANK:id>> marker appears twice')
      if (new Set(declared).size !== declared.length) fail(tag, 'duplicate blank ids')
      for (const b of q.blanks) {
        if (b.answers.some((a) => normalize(a) === ''))
          fail(tag, `blank "${b.id}" has an answer that is empty after normalisation`)
        for (const pat of b.accepted_patterns ?? []) {
          try {
            new RegExp(pat)
          } catch (e) {
            fail(tag, `blank "${b.id}" accepted_patterns "${pat}" is not a valid regex`)
          }
        }
      }
    } else if (q.type === 'find_fix') {
      const seenLines = new Set()
      for (const err of q.errors) {
        if (err.line > lines.length)
          fail(tag, `error line ${err.line} is beyond the end of code (${lines.length} lines)`)
        if (seenLines.has(err.line)) fail(tag, `two errors on line ${err.line}`)
        seenLines.add(err.line)
        const original = lines[err.line - 1] ?? ''
        if (err.fixes.some((f) => normalize(f) === normalize(original)))
          fail(tag, `a fix for line ${err.line} equals the buggy line (learner could pass without changing it)`)
      }
    } else {
      checkConceptual(q, tag)
    }
  }
}

// ---- non-programming question types ------------------------------------------
function checkMarkup(text, tag) {
  const snippet = text.length > 50 ? `${text.slice(0, 50)}...` : text
  if (CONTROL_RE.test(text))
    fail(tag, `text contains a TAB/backspace/form-feed/CR character ("${snippet}"); in JSONL write LaTeX backslashes doubled: \\\\times, \\\\theta, \\\\frac`)
  for (const seg of tokenize(text)) {
    if (seg.kind === 'math') {
      try {
        katex.renderToString(seg.value, { throwOnError: true, strict: 'ignore', displayMode: seg.display })
      } catch (e) {
        fail(tag, `invalid LaTeX "${seg.value.slice(0, 60)}": ${e.message}`)
      }
    } else if (seg.kind === 'text') {
      if (STRAY_TEX_RE.test(seg.value))
        fail(tag, `LaTeX outside $...$ ("${snippet}"); wrap formulas in $...$ (\\( \\) and \\[ \\] are not supported)`)
      if (seg.value.includes('$'))
        fail(tag, `unpaired or badly spaced "$" ("${snippet}"); math must be written $x$ with no space inside the dollar signs`)
    }
  }
}

function checkConceptual(q, tag) {
  if (/<<BLANK:/.test(q.code ?? '')) fail(tag, '"code" contains a <<BLANK:...>> marker, which only fill_blank supports')

  const texts = [q.prompt, q.explanation, q.model_answer, ...(q.hints ?? []), ...(q.key_points ?? [])]
  for (const o of q.options ?? []) texts.push(o.text, o.explanation)
  for (const p of q.parts ?? [])
    for (const s of [p.label, p.unit])
      if (s?.includes('$')) fail(tag, `part "${p.id}": labels and units are plain text, no $...$ math`)
  for (const t of texts) if (typeof t === 'string') checkMarkup(t, tag)

  if (q.type === 'multiple_choice') {
    const nCorrect = q.options.filter((o) => o.correct).length
    if (q.selection === 'single' && nCorrect !== 1)
      fail(tag, `selection "single" needs exactly 1 correct option, found ${nCorrect}`)
    if (q.selection === 'multiple' && nCorrect < 1) fail(tag, 'selection "multiple" needs at least 1 correct option')
    if (nCorrect === q.options.length) fail(tag, 'every option is marked correct - a question needs at least one wrong option')
    const seen = new Set()
    for (const [i, o] of q.options.entries()) {
      const where = `option ${String.fromCharCode(65 + i)}`
      if (OPTION_LABEL_RE.test(o.text)) fail(tag, `${where} text starts with a letter label (the app adds A, B, C itself)`)
      if (/\*\*Selected\*\*/.test(o.text)) fail(tag, `${where} text contains the source's "**Selected**" marker`)
      if (seen.has(o.text.trim())) fail(tag, `${where} duplicates another option's text`)
      seen.add(o.text.trim())
      if (normalize(o.explanation) === normalize(o.text)) fail(tag, `${where} explanation just repeats the option text`)
    }
  } else if (q.type === 'calculation' || q.type === 'param_count') {
    const ids = new Set()
    for (const p of q.parts) {
      if (ids.has(p.id)) fail(tag, `duplicate part id "${p.id}"`)
      ids.add(p.id)
      if (q.parts.length > 1 && !p.label) fail(tag, `part "${p.id}" needs a "label" because the question has several parts`)
      if (!Number.isInteger(p.value) && p.tolerance === undefined)
        fail(tag, `part "${p.id}" has a non-integer value ${p.value} but no "tolerance" (the learner could never match it exactly)`)
      if (q.type === 'param_count' && (!Number.isInteger(p.value) || p.value < 0))
        fail(tag, `param_count part "${p.id}" must be a non-negative integer, got ${p.value}`)
    }
  } else if (q.type === 'open_ended') {
    if (q.key_points.length < 2 && q.model_answer.length > 200)
      fail(tag, 'a long model_answer should come with at least 2 key_points to self-grade against')
  }
}

if (errors.length) {
  console.error(`\nData validation failed (${errors.length} problem${errors.length > 1 ? 's' : ''}):\n`)
  for (const e of errors) console.error('  ✗ ' + e)
  process.exit(1)
}
const byType = {}
for (const { type } of allQuestions) byType[type] = (byType[type] ?? 0) + 1
console.log(`  by type: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}`)
console.log(`✓ ${total} questions, ${refNames.size} reference entries — data OK`)
