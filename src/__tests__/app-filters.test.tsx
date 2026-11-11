import { readFileSync } from 'node:fs'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

const sample = readFileSync('src/__tests__/fixtures/sample.jsonl', 'utf8')
const reference = readFileSync('public/data/pytorch_reference.json', 'utf8')

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.endsWith('manifest.json')
        ? JSON.stringify({ questionFiles: ['questions/sample.jsonl'], reference: 'ref.json' })
        : url.endsWith('ref.json')
          ? reference
          : sample
      return new Response(body, { status: 200 })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('App filters', () => {
  it('filters by question type together with category and remembers what was switched off', async () => {
    const user = userEvent.setup()
    render(<App />)
    const types = await screen.findByRole('navigation', { name: 'Question types' })
    expect(types).toHaveTextContent('Multiple choice')
    expect(types).toHaveTextContent('Parameter counting')
    expect(types).toHaveTextContent('Open-ended')

    // Only open-ended questions -> that is the only thing that can be shown.
    const openRow = screen.getByLabelText(/Open-ended/).closest('li')!
    await user.click(openRow.querySelector('button.only')!)
    expect(screen.getByText('Why a 1×1 convolution cannot compute a product')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show model answer' })).toBeInTheDocument()

    // Category filter still applies on top: switch the only category of that question off.
    const cat = screen.getByRole('navigation', { name: 'Categories' })
    await user.click(within(cat).getByRole('button', { name: /Quizzes/ }))
    const quizRow = [...cat.querySelectorAll('li')].find((li) => li.textContent?.includes('Quiz1A_reference_solution.pdf'))!
    await user.click(quizRow.querySelector('input')!)
    expect(screen.getByText(/No questions match the current filters/)).toBeInTheDocument()
  })

  it('shows a message when no type is selected and persists the hidden types', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    const types = await screen.findByRole('navigation', { name: 'Question types' })
    await user.click(within(types).getByRole('button', { name: 'None' }))
    expect(screen.getByText(/No questions match the current filters/)).toBeInTheDocument()
    await waitFor(() => {
      const hidden = JSON.parse(localStorage.getItem('pa-practice:hidden-types')!) as string[]
      expect(hidden.sort()).toEqual(['calculation', 'fill_blank', 'find_fix', 'multiple_choice', 'open_ended', 'param_count'].sort())
    })
    unmount()

    // Reload: still nothing selected, and a type that did not exist before would default to visible.
    render(<App />)
    await screen.findByRole('navigation', { name: 'Question types' })
    expect(screen.getByText(/No questions match the current filters/)).toBeInTheDocument()
  })

  it('new categories/types default to visible even when older choices were saved', async () => {
    localStorage.setItem('pa-practice:hidden-types', JSON.stringify(['fill_blank']))
    render(<App />)
    const types = await screen.findByRole('navigation', { name: 'Question types' })
    expect(types.querySelector<HTMLInputElement>('input[type=checkbox]')).not.toBeNull()
    expect(screen.getByLabelText(/Fill in the blanks/)).not.toBeChecked()
    expect(screen.getByLabelText(/Multiple choice/)).toBeChecked()
  })

  it('groups categories, expands on demand, and selects/deselects a whole group', async () => {
    const user = userEvent.setup()
    render(<App />)
    const cat = await screen.findByRole('navigation', { name: 'Categories' })
    // Collapsed by default: only the group header is visible, not the individual categories.
    expect(within(cat).queryByText('Quiz1A_reference_solution.pdf')).toBeNull()
    const header = within(cat).getByRole('button', { name: /Quizzes/ })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(within(cat).getByText('Quiz1A_reference_solution.pdf')).toBeInTheDocument()

    const groupBox = within(cat).getByRole('checkbox', { name: 'Select all in Quizzes' })
    expect(groupBox).toBeChecked()
    await user.click(groupBox)
    expect(groupBox).not.toBeChecked()
    expect(within(cat).getByLabelText(/Quiz1A_reference_solution\.pdf/)).not.toBeChecked()
    await user.click(groupBox)
    expect(within(cat).getByLabelText(/Quiz1A_reference_solution\.pdf/)).toBeChecked()
  })

})

describe('App navigation and progress', () => {
  const MC_TITLES = ['Pooling and ReLU: does the order matter?', 'What softmax guarantees']

  async function onlyMultipleChoice(user: ReturnType<typeof userEvent.setup>) {
    render(<App />)
    const row = (await screen.findByLabelText(/Multiple choice/)).closest('li')!
    await user.click(row.querySelector('button.only')!)
  }
  const shownTitle = () => MC_TITLES.find((t) => screen.queryByText(t))

  it('Back returns to the question that was skipped, and is disabled on the first one', async () => {
    const user = userEvent.setup()
    await onlyMultipleChoice(user)
    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled()
    const first = shownTitle()!
    await user.click(screen.getByRole('button', { name: /Skip/ }))
    expect(shownTitle()).not.toBe(first)
    await user.click(screen.getByRole('button', { name: /Back/ }))
    expect(shownTitle()).toBe(first)
    // ...and forward again walks the trail rather than drawing a new question.
    await user.click(screen.getByRole('button', { name: /Skip/ }))
    expect(shownTitle()).not.toBe(first)
  })

  it('remembers answered questions, stops repeating them, and can be reset', async () => {
    const user = userEvent.setup()
    await onlyMultipleChoice(user)
    expect(screen.getByText(/Answered:/)).toHaveTextContent('Answered: 0 / 2')

    // Finish both questions (reveal counts as answered); a skipped one would not.
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'Show answer' }))
      await user.click(screen.getByRole('button', { name: /Next question/ }))
    }
    expect(screen.getByText(/answered every question/)).toBeInTheDocument()
    expect(screen.getByText(/Answered:/)).toHaveTextContent('Answered: 2 / 2')
    expect(JSON.parse(localStorage.getItem('pa-practice:answered')!)).toHaveLength(2)

    // Back from the "all done" screen shows the last question again.
    await user.click(screen.getByRole('button', { name: /Back/ }))
    expect(shownTitle()).toBeDefined()
    await user.click(screen.getByRole('button', { name: /Next question|Skip/ }))

    // Cancelling (button or Esc) keeps the progress...
    await user.click(screen.getAllByRole('button', { name: 'Reset progress' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Reset progress?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getAllByRole('button', { name: 'Reset progress' })[0])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(JSON.parse(localStorage.getItem('pa-practice:answered')!)).toHaveLength(2)

    // ...confirming wipes it.
    await user.click(screen.getAllByRole('button', { name: 'Reset progress' })[0])
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, reset' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(shownTitle()).toBeDefined()
    expect(screen.getByText(/Answered:/)).toHaveTextContent('Answered: 0 / 2')
    expect(JSON.parse(localStorage.getItem('pa-practice:answered')!)).toEqual([])
  })

  it('skipped questions come back, answered ones do not', async () => {
    const user = userEvent.setup()
    await onlyMultipleChoice(user)
    const first = shownTitle()!
    await user.click(screen.getByRole('button', { name: 'Show answer' }))
    await user.click(screen.getByRole('button', { name: /Next question/ }))
    const second = shownTitle()!
    expect(second).not.toBe(first)
    // Skip the remaining one repeatedly: it is the only unanswered question, so it is all we ever see.
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: /Skip/ }))
      expect(shownTitle()).toBe(second)
    }
  })

  it('"Hide answered" off keeps answered questions in the queue', async () => {
    const user = userEvent.setup()
    await onlyMultipleChoice(user)
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'Show answer' }))
      await user.click(screen.getByRole('button', { name: /Next question/ }))
    }
    await user.click(screen.getByRole('button', { name: 'Review answered questions' }))
    expect(shownTitle()).toBeDefined()
    expect(screen.getByLabelText('Hide answered')).not.toBeChecked()
  })
})
