import { useRef, useState } from 'react'
import type { OpenEndedQuestion } from '../types'
import { ActionBar } from './ActionBar'
import { ExplanationBlock } from './ExplanationBlock'
import { RichInline, RichText } from './RichText'

interface Props {
  q: OpenEndedQuestion
  onGraded: (correct: boolean) => void
  onNext: () => void
  onBack?: () => void
}

/** Free-text answer, then reveal the model answer and self-grade against its key points. */
export function OpenEnded({ q, onGraded, onNext, onBack }: Props) {
  const [text, setText] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [covered, setCovered] = useState<Set<number>>(new Set())
  const [rated, setRated] = useState<boolean | null>(null)
  const graded = useRef(false)

  function rate(correct: boolean) {
    setRated(correct)
    if (!graded.current) {
      graded.current = true
      onGraded(correct)
    }
  }

  function toggle(i: number) {
    if (rated !== null) return
    setCovered((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="answer-area">
      <label className="open-answer">
        <span className="muted">Your answer (optional — it is not graded automatically)</span>
        <textarea
          className="blank-input"
          rows={5}
          value={text}
          disabled={rated !== null}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your answer from memory, then reveal the model answer to compare."
          spellCheck={false}
        />
      </label>

      {revealed && (
        <>
          <section className="model-answer" aria-label="Model answer">
            <h3>Model answer</h3>
            <RichText text={q.model_answer} />
            <h3>Did your answer cover these points?</h3>
            <ul className="key-points">
              {q.key_points.map((k, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={covered.has(i)} disabled={rated !== null} onChange={() => toggle(i)} />
                    <span>
                      <RichInline text={k} />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {rated === null ? (
              <div className="actions">
                <button type="button" className="btn primary" onClick={() => rate(true)}>
                  ✅ I got it
                </button>
                <button type="button" className="btn" onClick={() => rate(false)}>
                  ❌ Not quite
                </button>
              </div>
            ) : (
              <div className={`feedback ${rated ? 'ok' : 'bad'}`}>
                {rated ? 'Marked as correct.' : 'Marked as missed — review the explanation below.'}
              </div>
            )}
          </section>
          <ExplanationBlock text={q.explanation} />
        </>
      )}

      <ActionBar
        done={rated !== null}
        onNext={onNext}
        onBack={onBack}
        reveal={revealed ? undefined : { label: 'Show model answer', onClick: () => setRevealed(true) }}
      />
    </div>
  )
}
