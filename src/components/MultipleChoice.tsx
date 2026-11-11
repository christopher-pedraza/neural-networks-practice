import { useRef, useState, type FormEvent } from 'react'
import type { MultipleChoiceQuestion } from '../types'
import { gradeChoice } from '../lib/grade'
import { ActionBar } from './ActionBar'
import { ExplanationBlock } from './ExplanationBlock'
import { RichInline } from './RichText'

interface Props {
  q: MultipleChoiceQuestion
  onGraded: (correct: boolean) => void
  onNext: () => void
  onBack?: () => void
}

const letter = (i: number) => String.fromCharCode(65 + i)

export function MultipleChoice({ q, onGraded, onNext, onBack }: Props) {
  const multi = q.selection === 'multiple'
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const graded = useRef(false)

  const result = gradeChoice(q, picked)
  // Unlike the code questions there is no retry: a second guess is trivial with a handful of options,
  // so checking locks the question and shows the reasoning for every option.
  const done = checked || revealed

  function toggle(i: number) {
    if (done) return
    setPicked((prev) => {
      if (!multi) return new Set([i])
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function finish(correct: boolean) {
    if (graded.current) return
    graded.current = true
    onGraded(correct)
  }

  function check(e: FormEvent) {
    e.preventDefault()
    if (done || picked.size === 0) return
    setChecked(true)
    finish(result.correct)
  }

  function reveal() {
    setRevealed(true)
    finish(false)
  }

  const nCorrect = q.options.filter((o) => o.correct).length

  return (
    <form className="answer-area" onSubmit={check}>
      <fieldset className="choices" disabled={done}>
        <legend className="muted">
          {multi ? `Select all that apply (${nCorrect === 1 ? 'one or more answers may be correct' : 'one or more'})` : 'Select one answer'}
        </legend>
        {q.options.map((o, i) => {
          const isPicked = picked.has(i)
          const state = !done
            ? ''
            : o.correct
              ? isPicked ? 'ok' : 'missed'
              : isPicked ? 'bad' : ''
          return (
            <div key={i} className={`choice ${state} ${isPicked && !done ? 'picked' : ''}`}>
              <label>
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={q.id}
                  checked={isPicked}
                  onChange={() => toggle(i)}
                />
                <span className="choice-letter">{letter(i)}</span>
                <span className="choice-text">
                  <RichInline text={o.text} />
                </span>
              </label>
              {done && (
                <div className="choice-why">
                  <strong className={o.correct ? 'ok-text' : 'bad-text'}>
                    {o.correct
                      ? isPicked ? '✓ Correct — you chose this.' : revealed ? '✓ Correct option.' : '✓ Correct option — you missed it.'
                      : isPicked ? '✗ Incorrect — you chose this.' : 'Incorrect option.'}
                  </strong>{' '}
                  <RichInline text={o.explanation} />
                </div>
              )}
            </div>
          )
        })}
      </fieldset>

      {checked && (
        <div className={`feedback ${result.correct ? 'ok' : 'bad'}`}>
          {result.correct
            ? '✅ Correct!'
            : multi
              ? `❌ Not quite — ${result.wrongPicks} wrong option${result.wrongPicks === 1 ? '' : 's'} ticked, ${result.missed} correct option${result.missed === 1 ? '' : 's'} missed.`
              : '❌ Not quite.'}
        </div>
      )}

      {done && <ExplanationBlock text={q.explanation} />}

      <ActionBar
        done={done}
        onNext={onNext}
        onBack={onBack}
        check={{ disabled: picked.size === 0 }}
        reveal={{ label: 'Show answer', onClick: reveal }}
      />
    </form>
  )
}
