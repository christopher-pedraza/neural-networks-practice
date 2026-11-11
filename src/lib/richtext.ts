/**
 * Tokenizer for the mini-markup used in question text. Shared by the UI (RichText) and the
 * data validator (scripts/validate-data.mjs), so both agree on what counts as math.
 *
 * Supported: `inline code`, **bold**, $inline math$, $$display math$$.
 * Order matters: code spans win over math, so a `$` inside backticks is never math.
 * Inline math must hug its delimiters ("$x$", not "$ x $") and the closing "$" must not be followed
 * by a digit, so prices such as "$5 or $10" are left alone.
 */
export type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'math'; value: string; display: boolean }

const TOKEN = /(`[^`\n]+`|\$\$(?!\$)[\s\S]+?\$\$|\$(?=[^\s$])[^$\n]*?[^\s$]\$(?!\d)|\*\*[^*\n]+\*\*)/g

export function tokenize(text: string): Segment[] {
  const out: Segment[] = []
  text.split(TOKEN).forEach((part, i) => {
    if (part === '') return
    if (i % 2 === 0) out.push({ kind: 'text', value: part })
    else if (part.startsWith('`')) out.push({ kind: 'code', value: part.slice(1, -1) })
    else if (part.startsWith('$$')) out.push({ kind: 'math', value: part.slice(2, -2).trim(), display: true })
    else if (part.startsWith('$')) out.push({ kind: 'math', value: part.slice(1, -1), display: false })
    else out.push({ kind: 'bold', value: part.slice(2, -2) })
  })
  return out
}
