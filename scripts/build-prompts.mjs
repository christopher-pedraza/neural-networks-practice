// Builds ready-to-use generation prompts for the non-programming question types.
//
//   npm run prompts                      # every file in source_files/{quizzes,general_assignments}
//   npm run prompts -- --only Quiz       # only sources whose path contains "Quiz"
//   npm run prompts -- --chunk 15        # split .md sources into parts of 15 questions (default 20, 0 = whole file)
//   npm run prompts -- --batch           # also write generated/batch_requests.json (Anthropic Message Batches API)
//
// Output (git-ignored): generated/prompts/<name>[.partN].prompt.md  + INDEX.md  [+ batch_requests.json]
// The prompt text lives in docs/AI_PROMPT_QUESTIONS.md; this script only fills in the placeholders
// and appends the source document, so editing that file changes every future prompt.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { basename, extname, join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIRS = ['source_files/general_assignments', 'source_files/quizzes']

// ---- args -------------------------------------------------------------------
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name, dflt) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : dflt
}
const only = opt('--only', '')
const chunkSize = Number(opt('--chunk', '20'))
const outDir = resolve(root, opt('--out', 'generated/prompts'))
const model = opt('--model', 'claude-opus-5-5')
const maxTokens = Number(opt('--max-tokens', '64000'))
if (!Number.isInteger(chunkSize) || chunkSize < 0) throw new Error('--chunk must be a non-negative integer')

// ---- template ---------------------------------------------------------------
const templateFile = readFileSync(resolve(root, 'docs/AI_PROMPT_QUESTIONS.md'), 'utf8')
const sep = templateFile.indexOf('\n---\n')
if (sep < 0) throw new Error('docs/AI_PROMPT_QUESTIONS.md: separator line "---" not found')
const template = templateFile.slice(sep + 5).trim()

const fill = (vars) => template.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m)

// ---- sources ----------------------------------------------------------------
function listSources() {
  const out = []
  for (const d of SOURCE_DIRS) {
    const dir = resolve(root, d)
    try {
      for (const f of readdirSync(dir).sort()) {
        const p = join(dir, f)
        if (statSync(p).isFile() && ['.md', '.txt', '.pdf'].includes(extname(f).toLowerCase())) out.push(p)
      }
    } catch {
      console.warn(`! ${d} not found, skipped`)
    }
  }
  return out.filter((p) => p.includes(only))
}

/** GeneralAssignment3.md -> ga3, Quiz1A_reference_solution.pdf -> quiz1a, Quiz2_B_answers.pdf -> quiz2b */
function idPrefix(name) {
  let m = name.match(/^GeneralAssignment(\d+)/i)
  if (m) return `ga${m[1]}`
  m = name.match(/^Quiz[_ -]?(\d+)[_ -]?([A-Za-z])?/i)
  if (m) return `quiz${m[1]}${(m[2] ?? '').toLowerCase()}`
  return basename(name, extname(name)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function readSource(path) {
  if (extname(path).toLowerCase() !== '.pdf') return { text: readFileSync(path, 'utf8'), note: '' }
  try {
    const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl')
      .replace(/\f/g, '\n')
    return {
      text,
      note:
        '(Text extracted from the PDF with pdftotext; matrices and formulas may be garbled. ' +
        'If you can see the attached PDF, prefer what it shows.)\n\n',
    }
  } catch {
    return {
      text: '',
      note: `(pdftotext is not installed or failed: ATTACH the PDF file "${basename(path)}" to the conversation together with this prompt.)`,
    }
  }
}

/** Split a markdown assignment into parts of `size` "## Question N" blocks. */
function chunkMarkdown(text, size) {
  const re = /^## Question (\d+)\s*$/gm
  const marks = [...text.matchAll(re)].map((m) => ({ index: m.index, n: Number(m[1]) }))
  if (size === 0 || marks.length <= size) return [{ text, first: marks[0]?.n, last: marks.at(-1)?.n, whole: true }]
  const header = text.slice(0, marks[0].index)
  const parts = []
  for (let i = 0; i < marks.length; i += size) {
    const group = marks.slice(i, i + size)
    const end = marks[i + size]?.index ?? text.length
    parts.push({ text: header + text.slice(group[0].index, end), first: group[0].n, last: group.at(-1).n, whole: false })
  }
  return parts
}

// ---- build ------------------------------------------------------------------
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const rows = []
const requests = []
const sources = listSources()
if (sources.length === 0) {
  console.error('No source files found (looked in ' + SOURCE_DIRS.join(', ') + ')')
  process.exit(1)
}

for (const path of sources) {
  const name = basename(path)
  const prefix = idPrefix(name)
  const { text, note } = readSource(path)
  const isMd = extname(path).toLowerCase() !== '.pdf'
  const parts = isMd ? chunkMarkdown(text, chunkSize) : [{ text, whole: true }]

  parts.forEach((part, i) => {
    const n = parts.length
    const scope = part.whole
      ? `the whole document. Extras: add 3-5 \`open_ended\` questions with ids \`${prefix}-open-01\`, \`${prefix}-open-02\`, ...`
      : `Questions ${part.first}-${part.last} only (part ${i + 1} of ${n}; ignore every other question in the document). ` +
        `Extras: add 1-2 \`open_ended\` questions with ids \`${prefix}-open-p${i + 1}-01\`, \`${prefix}-open-p${i + 1}-02\``
    const instructions = fill({ SOURCE_NAME: name, ID_PREFIX: prefix, SCOPE: scope })
    const source = `## SOURCE DOCUMENT: ${name}\n\n${note}<<<BEGIN SOURCE>>>\n${part.text.trim()}\n<<<END SOURCE>>>\n`
    const stem = n > 1 ? `${basename(name, extname(name))}.part${i + 1}` : basename(name, extname(name))
    const file = `${stem}.prompt.md`
    writeFileSync(join(outDir, file), `${instructions}\n\n---\n\n${source}`)
    const questionsInPart = (part.text.match(/^## Question \d+/gm) ?? []).length
    rows.push({ file, name, prefix, questions: questionsInPart || '?', chars: instructions.length + source.length, stem, scope: part.whole ? 'all' : `Q${part.first}-${part.last}` })
    // Message Batches API: custom_id must match ^[a-zA-Z0-9_-]{1,64}$
    requests.push({
      custom_id: stem.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
      params: {
        model,
        max_tokens: maxTokens,
        output_config: { effort: 'high' },
        system: instructions,
        messages: [{ role: 'user', content: `${source}\nGenerate the JSONL now.` }],
      },
    })
  })
}

const outputsHint = 'generated/outputs'
const index = [
  '# Generation prompts',
  '',
  'Give each prompt file to an LLM (one conversation per file; attach the PDF too where noted), save its',
  `reply as \`${outputsHint}/<stem>.jsonl\`, then import everything:`,
  '',
  '```bash',
  `node scripts/import-questions.mjs ${outputsHint}/*.jsonl --check   # dry run: what would be imported`,
  `node scripts/import-questions.mjs ${outputsHint}/*.jsonl`,
  'npm run validate',
  '```',
  '',
  '| prompt | source | id prefix | scope | questions | ~tokens in | save reply as |',
  '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.file} | ${r.name} | ${r.prefix} | ${r.scope} | ${r.questions} | ${Math.round(r.chars / 3.5 / 1000)}k | ${outputsHint}/${r.stem}.jsonl |`),
  '',
]
writeFileSync(join(outDir, 'INDEX.md'), index.join('\n'))

if (flag('--batch')) {
  const batchFile = resolve(outDir, '..', 'batch_requests.json')
  writeFileSync(batchFile, JSON.stringify({ requests }, null, 2))
  console.log(`batch file: ${relative(root, batchFile)} (${requests.length} requests, model ${model}, max_tokens ${maxTokens})`)
}

console.log(`${rows.length} prompt${rows.length === 1 ? '' : 's'} written to ${relative(root, outDir)}/`)
for (const r of rows) console.log(`  ${r.file.padEnd(52)} ${String(r.questions).padStart(3)} questions  ~${Math.round(r.chars / 3.5 / 1000)}k tokens`)
console.log(`See ${relative(root, join(outDir, 'INDEX.md'))} for what to do next.`)
