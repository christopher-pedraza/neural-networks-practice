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
})
