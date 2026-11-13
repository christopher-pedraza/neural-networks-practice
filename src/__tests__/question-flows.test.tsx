import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuestionView } from '../components/QuestionView'
import { ReferencePanel } from '../components/ReferencePanel'
import { matchesAny } from '../lib/normalize'
import { parseQuestions } from '../lib/data'
import type { Question, ReferenceFile } from '../types'

const questions = parseQuestions(readFileSync('src/__tests__/fixtures/sample.jsonl', 'utf8'), 'x.jsonl')
const reference = JSON.parse(readFileSync('public/data/pytorch_reference.json', 'utf8')) as ReferenceFile
const get = (id: string) => questions.find((q) => q.id === id) as Question

function setup(id: string) {
  const onGraded = vi.fn()
  const onNext = vi.fn()
  const onOpenReference = vi.fn()
  render(<QuestionView q={get(id)} onGraded={onGraded} onNext={onNext} onOpenReference={onOpenReference} />)
  return { onGraded, onNext, onOpenReference, user: userEvent.setup() }
}

describe('normalize', () => {
  it('ignores spacing around punctuation and quote style but not keyword spacing', () => {
    expect(matchesAny('x=a+b', ['x = a + b'])).toBe(true)
    expect(matchesAny("f('a')", ['f("a")'])).toBe(true)
    expect(matchesAny('forxiny', ['for x in y'])).toBe(false)
  })
})

describe('fill_blank', () => {
  it('shows description, reveals hints one by one, grades inline blanks', async () => {
    const { user, onGraded } = setup('lin-reg-setup-01')
    expect(screen.getByText(/one-feature linear regression/)).toBeInTheDocument()

    expect(screen.queryByText(/One input feature/)).toBeNull()
    await user.click(screen.getByRole('button', { name: /Show hint/ }))
    expect(screen.getByText(/One input feature/)).toBeInTheDocument()
    expect(screen.queryByText(/Regression \+ squared error/)).toBeNull()

    await user.type(screen.getByLabelText('Blank model'), 'nn.Linear(1,1)')
    await user.type(screen.getByLabelText('Blank loss'), 'nn.L1Loss()')
    await user.type(screen.getByLabelText('Blank params'), 'model.parameters()')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/2 of 3 blanks correct/)).toBeInTheDocument()
    expect(onGraded).toHaveBeenLastCalledWith(false)

    const loss = screen.getByLabelText('Blank loss')
    await user.clear(loss)
    await user.type(loss, 'nn.MSELoss(){enter}') // Enter submits
    expect(screen.getByText(/Correct!/)).toBeInTheDocument()
    expect(onGraded).toHaveBeenCalledTimes(1) // only the first check counts
    expect(screen.getByRole('button', { name: /Next question/ })).toBeInTheDocument()
  })

  it('reveals the canonical solution', async () => {
    const { user, onGraded } = setup('mnist-forward-flatten-01')
    await user.click(screen.getByRole('button', { name: 'Show solution' }))
    expect(screen.getByLabelText('Blank flat')).toHaveValue('x = x.view(x.size(0), -1)')
    expect(screen.getByText('x = x.flatten(1)')).toBeInTheDocument() // other accepted answers listed
    expect(onGraded).toHaveBeenCalledWith(false)
  })

  it('accepts any listed alternative', async () => {
    const { user } = setup('mnist-forward-flatten-01')
    await user.type(screen.getByLabelText('Blank flat'), 'x = torch.flatten(x, 1)')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/Correct!/)).toBeInTheDocument()
  })
})

describe('placeholders toggle', () => {
  const placeholders = (id: string) =>
    get(id).type === 'fill_blank' ? (get(id) as { blanks: { placeholder?: string }[] }).blanks.map((b) => b.placeholder) : []

  it('shows blank placeholders by default and hides them when turned off', () => {
    const id = 'lin-reg-setup-01'
    const expected = placeholders(id).filter(Boolean) as string[]
    expect(expected.length).toBeGreaterThan(0)

    const { unmount } = render(
      <QuestionView q={get(id)} onGraded={vi.fn()} onNext={vi.fn()} onOpenReference={vi.fn()} />,
    )
    for (const p of expected) expect(screen.getAllByPlaceholderText(p).length).toBeGreaterThan(0)
    unmount()

    render(
      <QuestionView q={get(id)} onGraded={vi.fn()} onNext={vi.fn()} onOpenReference={vi.fn()} showPlaceholders={false} />,
    )
    for (const p of expected) expect(screen.queryByPlaceholderText(p)).toBeNull()
  })
})

describe('find_fix', () => {
  it('requires flagging the right lines AND a valid fix; supports multiple valid fixes', async () => {
    const { user, onGraded } = setup('mnist-eval-bugs-01')
    const check = screen.getByRole('button', { name: 'Check' })
    expect(check).toBeDisabled() // nothing flagged yet

    // flag a correct line (2) and an innocent line (4)
    await user.click(screen.getByRole('button', { name: 'Flag line 2' }))
    await user.click(screen.getByRole('button', { name: 'Flag line 4' }))
    const [fix2] = screen.getAllByRole('textbox')
    await user.clear(fix2)
    await user.type(fix2, 'model.eval()')
    await user.click(check)
    expect(
      screen.getByText(/Found 1 of 2 errors.*1 flagged line is not an error.*1 still to find/),
    ).toBeInTheDocument()
    expect(onGraded).toHaveBeenLastCalledWith(false)

    // un-flag line 4, flag line 9 with an alternative valid fix
    await user.click(screen.getByRole('button', { name: 'Flag line 4' }))
    await user.click(screen.getByRole('button', { name: 'Flag line 9' }))
    const fix9 = screen.getAllByRole('textbox')[1]
    await user.clear(fix9)
    await user.type(fix9, 'pred = logits.argmax(-1)')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/all errors found and fixed/)).toBeInTheDocument()
    expect(screen.getByText(/Evaluation must run in eval mode/)).toBeInTheDocument()
  })

  it('leaving a flagged line unchanged is not a valid fix', async () => {
    const { user } = setup('lin-reg-order-bug-01')
    await user.click(screen.getByRole('button', { name: 'Flag line 4' }))
    await user.click(screen.getByRole('button', { name: 'Flag line 5' }))
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/Found 2 of 2 errors; 2 fixes not right/)).toBeInTheDocument()
  })

  it('solves the swapped-lines question', async () => {
    const { user } = setup('lin-reg-order-bug-01')
    await user.click(screen.getByRole('button', { name: 'Flag line 4' }))
    await user.click(screen.getByRole('button', { name: 'Flag line 5' }))
    const [a, b] = screen.getAllByRole('textbox')
    await user.clear(a)
    await user.type(a, 'optimizer.zero_grad()')
    await user.clear(b)
    await user.type(b, 'loss.backward()')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/all errors found and fixed/)).toBeInTheDocument()
  })

  it('related APIs are hidden until revealed (per question), then chips call back', async () => {
    const { user, onOpenReference } = setup('mnist-eval-bugs-01')
    expect(screen.queryByRole('button', { name: 'torch.no_grad' })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Show related APIs \(3\)/ }))
    await user.click(screen.getByRole('button', { name: 'torch.no_grad' }))
    expect(onOpenReference).toHaveBeenCalledWith('torch.no_grad')
  })
})

describe('ReferencePanel', () => {
  it('searches by name and summary text, and jumps to a requested entry', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <ReferencePanel entries={reference.entries} request={null} onClose={() => {}} />,
    )
    const search = screen.getByPlaceholderText(/Search/)
    await user.type(search, 'zero_grad')
    expect(screen.getAllByRole('button', { name: /zero_grad/ })).toHaveLength(1)
    await user.clear(search)
    await user.type(search, 'dropout')
    expect(screen.getByRole('button', { name: /Module\.eval/ })).toBeInTheDocument() // matches summary
    expect(screen.queryByRole('button', { name: /torch\.flatten/ })).toBeNull()

    rerender(
      <ReferencePanel
        entries={reference.entries}
        request={{ name: 'torch.flatten', nonce: 1 }}
        onClose={() => {}}
      />,
    )
    expect(screen.getByRole('heading', { name: 'torch.flatten' })).toBeInTheDocument()
    expect(search).toHaveValue('') // search cleared so the entry is visible in the list
  })
})

describe('course slides', () => {
  it('are hidden until asked for and shown as text', async () => {
    const q = { ...get('lin-reg-setup-01'), slides: [{ deck: 'C10_DataPreProcessing', page: 12 }] } as Question
    render(<QuestionView q={q} onGraded={vi.fn()} onNext={vi.fn()} onOpenReference={vi.fn()} />)
    expect(screen.queryByText(/slide 12/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /show course slides \(1\)/i }))
    expect(screen.getByText('C10 DataPreProcessing · slide 12')).toBeInTheDocument()
  })
})
