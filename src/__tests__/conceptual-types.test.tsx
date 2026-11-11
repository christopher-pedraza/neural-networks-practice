import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuestionView } from '../components/QuestionView'
import { TypeFilter } from '../components/TypeFilter'
import { parseNumeric, gradeNumeric } from '../lib/numeric'
import { parseQuestions } from '../lib/data'
import type { Question, QuestionType } from '../types'

const questions = parseQuestions(readFileSync('src/__tests__/fixtures/sample.jsonl', 'utf8'), 'x.jsonl')
const get = (id: string) => questions.find((q) => q.id === id) as Question

function setup(id: string) {
  const onGraded = vi.fn()
  const onNext = vi.fn()
  render(<QuestionView q={get(id)} onGraded={onGraded} onNext={onNext} onOpenReference={vi.fn()} />)
  return { onGraded, onNext, user: userEvent.setup() }
}

describe('parseNumeric', () => {
  it('reads numbers, thousands separators and arithmetic', () => {
    expect(parseNumeric('2598')).toBe(2598)
    expect(parseNumeric('2,598')).toBe(2598)
    expect(parseNumeric(' 1,234,567 ')).toBe(1234567)
    expect(parseNumeric('432*6+6')).toBe(2598)
    expect(parseNumeric('(3*12*12+1)*6')).toBe(2598)
    expect(parseNumeric('3×12×12')).toBe(432)
    expect(parseNumeric('2^3^2')).toBe(512) // right-associative
    expect(parseNumeric('2**10')).toBe(1024)
    expect(parseNumeric('-4 + 1.5e1')).toBe(11)
    expect(parseNumeric('sqrt(16)/2')).toBe(2)
    expect(parseNumeric('exp(0) + ln(e)')).toBe(2)
    expect(parseNumeric('.5')).toBe(0.5)
  })
  it('accepts implicit multiplication, but not two bare numbers side by side', () => {
    expect(parseNumeric('2(3+4)')).toBe(14)
    expect(parseNumeric('(1+2)(3+4)')).toBe(21)
    expect(parseNumeric('(1+2)3')).toBe(9)
    expect(parseNumeric('(3*12*12+1)6')).toBe(2598)
    expect(parseNumeric('2sqrt(16)')).toBe(8)
    expect(parseNumeric('-2(3)')).toBe(-6)
    expect(parseNumeric('2^3(2)')).toBe(16)
    expect(parseNumeric('4pi')).toBeCloseTo(12.566370614, 8)
    expect(parseNumeric('2 598')).toBeNull() // thousands separated by a space is not 2*598
    expect(parseNumeric('(1)(2) 3')).toBe(6)
  })
  it('rejects anything that is not a plain expression', () => {
    for (const bad of ['', '  ', 'abc', '1 +', '(1', '1)', '2 3', 'alert(1)', '1/0', 'sqrt', '3x12', 'process.exit()']) {
      expect(parseNumeric(bad), bad).toBeNull()
    }
  })
  it('applies the absolute tolerance', () => {
    const part = { id: 'p', value: 0.665, tolerance: 0.0006 }
    expect(gradeNumeric(part, '0.6654')).toBe(true)
    expect(gradeNumeric(part, '0.67')).toBe(false)
    expect(gradeNumeric({ id: 'n', value: 1041 }, '1041.5')).toBe(false) // counts are exact
    expect(gradeNumeric({ id: 'n', value: 1041 }, '112+24+905')).toBe(true)
  })
})

describe('multiple_choice (multiple)', () => {
  const id = 'quiz1a-pool-relu-order-01'

  it('shows check boxes, no explanations before answering, and grades all-or-nothing', async () => {
    const { user, onGraded } = setup(id)
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(screen.getByText(/Select all that apply/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Explanation' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled()

    // only one of the two correct options ticked -> wrong
    await user.click(screen.getByRole('checkbox', { name: /Max pooling followed by ReLU/ }))
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(onGraded).toHaveBeenCalledWith(false)
    expect(screen.getByText(/0 wrong options ticked, 1 correct option missed/)).toBeInTheDocument()
  })

  it('after checking, explains every option (right and wrong) plus the overall explanation, and locks', async () => {
    const { user, onGraded, onNext } = setup(id)
    await user.click(screen.getByRole('checkbox', { name: /Average pooling followed by ReLU/ }))
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(onGraded).toHaveBeenCalledWith(false)

    // wrong pick is explained
    expect(screen.getByText(/✗ Incorrect — you chose this\./)).toBeInTheDocument()
    expect(screen.getByText(/The mean of the original window is/)).toBeInTheDocument()
    // missed correct options are explained
    expect(screen.getAllByText(/✓ Correct option — you missed it\./)).toHaveLength(2)
    expect(screen.getByText(/ReLU turns the window into/)).toBeInTheDocument()
    // untouched wrong option is explained too
    expect(screen.getByText(/ReLU is non-decreasing, so max/)).toBeInTheDocument()
    // overall explanation
    expect(within(screen.getByRole('region', { name: 'Explanation' })).getByText(/Max pooling commutes with ReLU/)).toBeInTheDocument()
    // locked: no retry
    expect(screen.getByRole('checkbox', { name: /Max pooling followed by ReLU/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Next question/ }))
    expect(onNext).toHaveBeenCalled()
  })

  it('accepts exactly the correct set', async () => {
    const { user, onGraded } = setup(id)
    await user.click(screen.getByRole('checkbox', { name: /Max pooling followed by ReLU/ }))
    await user.click(screen.getByRole('checkbox', { name: /ReLU followed by average pooling/ }))
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(onGraded).toHaveBeenCalledWith(true)
    expect(screen.getByText(/Correct!/)).toBeInTheDocument()
  })

  it('renders the supporting code block', () => {
    setup(id)
    expect(screen.getByLabelText('Question material').textContent).toBe('X = [[-6,  2],\n     [-2,  4]]') // layout preserved
  })
})

describe('multiple_choice (single)', () => {
  it('uses radio buttons and replaces the previous choice', async () => {
    const { user, onGraded } = setup('quiz1a-softmax-properties-01')
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    await user.click(screen.getByRole('radio', { name: /Outputs can be negative/ }))
    await user.click(screen.getByRole('radio', { name: /non-negative and sum to 1/ }))
    expect(screen.getByRole('radio', { name: /Outputs can be negative/ })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(onGraded).toHaveBeenCalledWith(true)
  })

  it('"Show answer" reveals the reasoning and counts as a miss', async () => {
    const { user, onGraded } = setup('quiz1a-softmax-properties-01')
    await user.click(screen.getByRole('button', { name: 'Show answer' }))
    expect(onGraded).toHaveBeenCalledWith(false)
    expect(screen.getByText(/✓ Correct option\./)).toBeInTheDocument()
    expect(screen.getByText(/so no output can be negative/)).toBeInTheDocument()
  })
})

describe('calculation / param_count', () => {
  it('grades several parts, accepts expressions, lets you retry, and counts only the first check', async () => {
    const { user, onGraded } = setup('quiz1a-cnn-infeatures-params-01')
    await user.type(screen.getByLabelText('in_features of the Linear layer'), '6*6*5')
    await user.type(screen.getByLabelText('Total trainable parameters'), '1040')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/1 of 2 answers correct/)).toBeInTheDocument()
    expect(onGraded).toHaveBeenLastCalledWith(false)
    expect(screen.queryByRole('region', { name: 'Explanation' })).toBeNull() // not solved yet

    const total = screen.getByLabelText('Total trainable parameters')
    await user.clear(total)
    await user.type(total, '112 + 24 + 905{enter}')
    expect(screen.getByText(/Correct!/)).toBeInTheDocument()
    expect(onGraded).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('region', { name: 'Explanation' })).toHaveTextContent('112 + 24 + 905 = 1,041')
  })

  it('respects the tolerance and flags unreadable input', async () => {
    const { user } = setup('test-calc-tolerance-01')
    const box = screen.getByLabelText('p0')
    await user.type(box, '0.7')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/Not quite/)).toBeInTheDocument()
    await user.clear(box)
    await user.type(box, 'abc')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/Couldn't read that/)).toBeInTheDocument()
    await user.clear(box)
    await user.type(box, '0.6654')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/Correct!/)).toBeInTheDocument()
  })

  it('shows the solution with formatted values on reveal', async () => {
    const { user, onGraded } = setup('quiz1a-cnn-infeatures-params-01')
    await user.click(screen.getByRole('button', { name: 'Show solution' }))
    expect(onGraded).toHaveBeenCalledWith(false)
    expect(screen.getByLabelText('Total trainable parameters')).toHaveValue('1,041')
    expect(screen.getByRole('region', { name: 'Explanation' })).toBeInTheDocument()
  })
})

describe('open_ended', () => {
  it('reveals the model answer, then self-grades against the key points', async () => {
    const { user, onGraded, onNext } = setup('quiz1a-conv1x1-product-01')
    expect(screen.queryByRole('region', { name: 'Model answer' })).toBeNull()
    await user.type(screen.getByRole('textbox'), 'It is linear.')
    await user.click(screen.getByRole('button', { name: 'Show model answer' }))
    expect(screen.getByRole('region', { name: 'Model answer' })).toHaveTextContent('fixed weighted sum')
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getByRole('region', { name: 'Explanation' })).toBeInTheDocument()
    expect(onGraded).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Not quite/ }))
    expect(onGraded).toHaveBeenCalledWith(false)
    expect(screen.getByText(/Marked as missed/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Next question/ }))
    expect(onNext).toHaveBeenCalled()
  })
})

describe('TypeFilter', () => {
  it('lists only present types with counts and toggles / isolates them', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const counts = new Map<QuestionType, number>([
      ['fill_blank', 5],
      ['multiple_choice', 3],
    ])
    render(<TypeFilter counts={counts} selected={new Set<QuestionType>(['fill_blank', 'multiple_choice'])} onChange={onChange} />)
    expect(screen.queryByLabelText(/Calculation/)).toBeNull()
    expect(screen.getByLabelText(/Multiple choice/)).toBeChecked()

    await user.click(screen.getByLabelText(/Multiple choice/))
    expect(onChange).toHaveBeenLastCalledWith(new Set(['fill_blank']))

    const mcRow = screen.getByLabelText(/Multiple choice/).closest('li')!
    await user.click(within(mcRow).getByRole('button', { name: 'only' }))
    expect(onChange).toHaveBeenLastCalledWith(new Set(['multiple_choice']))

    await user.click(screen.getByRole('button', { name: 'None' }))
    expect(onChange).toHaveBeenLastCalledWith(new Set())
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenLastCalledWith(new Set(['fill_blank', 'multiple_choice']))
  })
})
