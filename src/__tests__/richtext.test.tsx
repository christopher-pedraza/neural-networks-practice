import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { tokenize } from '../lib/richtext'
import { RichInline, RichText } from '../components/RichText'

describe('tokenize', () => {
  it('splits code, bold and inline/display math', () => {
    expect(tokenize('a `x$y` **b** $z$ $$\\frac{1}{2}$$ end')).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'code', value: 'x$y' },
      { kind: 'text', value: ' ' },
      { kind: 'bold', value: 'b' },
      { kind: 'text', value: ' ' },
      { kind: 'math', value: 'z', display: false },
      { kind: 'text', value: ' ' },
      { kind: 'math', value: '\\frac{1}{2}', display: true },
      { kind: 'text', value: ' end' },
    ])
  })

  it('accepts one-character math and multi-line display math', () => {
    expect(tokenize('$x$')).toEqual([{ kind: 'math', value: 'x', display: false }])
    expect(tokenize('$$\na \\\\ b\n$$')).toEqual([{ kind: 'math', value: 'a \\\\ b', display: true }])
  })

  it('leaves prices and badly spaced dollars as text', () => {
    for (const t of ['costs $5 or $10', 'a $ x $ b', 'only one $ here'])
      expect(tokenize(t).every((s) => s.kind === 'text')).toBe(true)
  })
})

describe('RichText with math', () => {
  it('renders inline and display formulas with KaTeX', () => {
    const { container } = render(
      <RichText text={'Let $W \\in \\mathbb{R}^{2\\times 2}$:\n\n$$\\begin{bmatrix} 1 & 2 \\\\ 0 & -1 \\end{bmatrix}$$'} />,
    )
    expect(container.querySelectorAll('.math-inline .katex')).toHaveLength(1)
    expect(container.querySelectorAll('.math-display .katex-display')).toHaveLength(1)
    // The matrix has 4 entries, rendered in the MathML twin KaTeX adds for screen readers.
    expect(container.querySelectorAll('.math-display mtable mtd')).toHaveLength(4)
    expect(container.textContent).not.toContain('$')
  })

  it('does not treat dollars inside inline code as math', () => {
    const { container } = render(<RichText text={'Use `a$b$c` as is'} />)
    expect(container.querySelector('.katex')).toBeNull()
    expect(container.querySelector('code')?.textContent).toBe('a$b$c')
  })

  it('shows invalid TeX as red source instead of crashing', () => {
    const { container } = render(<RichInline text={'bad $\\frac{1}{$ here'} />)
    expect(container.querySelector('.katex-error')).not.toBeNull()
  })
})

describe('LaTeX example question', () => {
  it('renders the shipped example (prompt matrices, hints, calculation) end to end', async () => {
    const { readFileSync } = await import('node:fs')
    const { parseQuestions } = await import('../lib/data')
    const { QuestionView } = await import('../components/QuestionView')
    const text = readFileSync('public/data/questions/examples_conceptual.jsonl', 'utf8')
    const q = parseQuestions(text, 'examples_conceptual.jsonl').find((x) => x.id === 'latex-check-linear-layer-01')!
    const { container } = render(<QuestionView q={q} onGraded={() => {}} onNext={() => {}} onOpenReference={() => {}} />)
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1)
    expect(container.querySelectorAll('.math-inline .katex').length).toBeGreaterThanOrEqual(4)
    expect(container.querySelector('.katex-error')).toBeNull()
  })
})
