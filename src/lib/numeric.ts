// Parses what a learner types into a number so that "2,598", "432*6+6" and
// "(3*12*12+1)*6" (or "(3*12*12+1)6") are all accepted for calculation questions (the
// quizzes explicitly allow equations). A tiny recursive-descent parser: no eval().

import type { NumericPart } from '../types'

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log, // natural log, as everywhere in ML
  log2: Math.log2,
  log10: Math.log10,
  abs: Math.abs,
}
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E }

type Tok = { n: number } | { op: string } | { id: string }

function tokenize(src: string): Tok[] | null {
  // Thousands separators ("1,041") and underscores ("1_041"); "×" "·" "−" etc. as operators.
  const s = src
    .replace(/(\d)[,_](?=\d{3}(\D|$))/g, '$1')
    .replace(/[×·∗⋅]/g, '*')
    .replace(/[−–]/g, '-')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/\*\*/g, '^')
  const out: Tok[] = []
  const re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z][A-Za-z0-9]*)|([-+*/^()]))/y
  let pos = 0
  while (pos < s.length) {
    if (/^\s*$/.test(s.slice(pos))) break
    re.lastIndex = pos
    const m = re.exec(s)
    if (!m) return null
    pos = re.lastIndex
    if (m[1] !== undefined) out.push({ n: Number(m[1]) })
    else if (m[2] !== undefined) out.push({ id: m[2].toLowerCase() })
    else out.push({ op: m[3] })
  }
  return out
}

/** Returns the numeric value of `input`, or null if it is empty or not a valid expression. */
export function parseNumeric(input: string): number | null {
  const toks = tokenize(input)
  if (!toks || toks.length === 0) return null
  let i = 0
  const peekOp = () => {
    const t = toks[i]
    return t && 'op' in t ? t.op : undefined
  }
  const fail = (): never => {
    throw new SyntaxError('bad expression')
  }

  // expr := term (('+'|'-') term)*
  function expr(): number {
    let v = term()
    for (let o = peekOp(); o === '+' || o === '-'; o = peekOp()) {
      i++
      const r = term()
      v = o === '+' ? v + r : v - r
    }
    return v
  }
  // Implicit multiplication: "2(3+4)", "(1+2)(3+4)", "3pi", "2sqrt(4)". A number directly followed
  // by another number ("2 598") is NOT a product - that is far more likely a typo.
  const startsFactor = () => {
    const t = toks[i]
    if (!t) return false
    if ('id' in t) return true
    if ('op' in t) return t.op === '('
    const prev = toks[i - 1] // a number directly after ")" is a factor: "(1+2)3"
    return !!prev && 'op' in prev && prev.op === ')'
  }
  // term := unary (('*'|'/')? unary)*
  function term(): number {
    let v = unary()
    for (;;) {
      const o = peekOp()
      if (o === '*' || o === '/') {
        i++
        const r = unary()
        v = o === '*' ? v * r : v / r
      } else if (startsFactor()) {
        v *= power()
      } else {
        return v
      }
    }
  }
  // unary := ('-'|'+') unary | power
  function unary(): number {
    const o = peekOp()
    if (o === '-' || o === '+') {
      i++
      const v = unary()
      return o === '-' ? -v : v
    }
    return power()
  }
  // power := atom ('^' unary)?   (right-associative)
  function power(): number {
    const base = atom()
    if (peekOp() === '^') {
      i++
      return Math.pow(base, unary())
    }
    return base
  }
  function atom(): number {
    const t = toks![i++]
    if (!t) return fail()
    if ('n' in t) return t.n
    if ('id' in t) {
      if (t.id in CONSTS && peekOp() !== '(') return CONSTS[t.id]
      const f = FUNCS[t.id]
      if (!f || peekOp() !== '(') return fail()
      i++
      const v = expr()
      if (peekOp() !== ')') return fail()
      i++
      return f(v)
    }
    if (t.op === '(') {
      const v = expr()
      if (peekOp() !== ')') return fail()
      i++
      return v
    }
    return fail()
  }

  try {
    const v = expr()
    return i === toks.length && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

/** Is `input` an accepted answer for `part` (within its absolute tolerance)? */
export function gradeNumeric(part: NumericPart, input: string): boolean {
  const v = parseNumeric(input)
  if (v === null) return false
  const tol = (part.tolerance ?? 0) + 1e-9 * Math.max(1, Math.abs(part.value))
  return Math.abs(v - part.value) <= tol
}

/** Canonical display of a part's value, e.g. 2598 -> "2,598". */
export function formatValue(part: NumericPart): string {
  return part.value.toLocaleString('en-US', { maximumFractionDigits: 10 })
}
