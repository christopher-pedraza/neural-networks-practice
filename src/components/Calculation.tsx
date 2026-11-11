import { useRef, useState, type FormEvent } from 'react'
import type { CalculationQuestion } from '../types'
import { formatValue, parseNumeric } from '../lib/numeric'
import { gradeCalculation } from '../lib/grade'
import { ExplanationBlock } from './ExplanationBlock'

interface Props {
  q: CalculationQuestion
  onGraded: (correct: boolean) => void
  onNext: () => void
}

/** Serves both `calculation` and `param_count`: one numeric box per part; expressions are accepted. */
export function Calculation({ q, onGraded, onNext }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const graded = useRef(false)

  const results = gradeCalculation(q, values)
  const allCorrect = [...results.values()].every(Boolean)
  const done = revealed || (checked && allCorrect)
  const anyInput = q.parts.some((p) => (values[p.id] ?? '').trim() !== '')

  function finish(correct: boolean) {
    if (graded.current) return
    graded.current = true
    onGraded(correct)
  }

  function check(e: FormEvent) {
    e.preventDefault()
    if (revealed || !anyInput) return
    setChecked(true)
    finish(allCorrect)
  }

  function reveal() {
    setRevealed(true)
    finish(false)
  }

  return (
    <form onSubmit={check}>
      <div className="numeric-parts">
        {q.parts.map((p, i) => {
          const raw = values[p.id] ?? ''
          const state = revealed ? 'revealed' : checked ? (results.get(p.id) ? 'ok' : 'bad') : ''
          const label = p.label ?? (q.parts.length > 1 ? `Part ${i + 1}` : 'Answer')
          const unparsable = checked && !revealed && raw.trim() !== '' && parseNumeric(raw) === null
          return (
            <div key={p.id} className="numeric-part">
              <label>
                <span className="numeric-label">{label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`blank-input numeric-input ${state}`}
                  value={revealed ? formatValue(p) : raw}
                  placeholder="number or expression"
                  disabled={done}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={label}
                  onChange={(ev) => {
                    setChecked(false)
                    setValues((v) => ({ ...v, [p.id]: ev.target.value }))
                  }}
                />
              </label>
              {p.unit && <span className="muted">{p.unit}</span>}
              {unparsable && <span className="bad-text">Couldn't read that as a number or expression.</span>}
            </div>
          )
        })}
      </div>
      <p className="muted numeric-hint">An equation such as <code>3*12*12*6 + 6</code> is fine — no need to simplify.</p>

      {checked && !revealed && (
        <div className={`feedback ${allCorrect ? 'ok' : 'bad'}`}>
          {allCorrect
            ? '✅ Correct!'
            : q.parts.length > 1
              ? `❌ ${[...results.values()].filter(Boolean).length} of ${q.parts.length} answers correct. Fix the red ones, or use a hint.`
              : '❌ Not quite. Try again, or use a hint.'}
        </div>
      )}

      {done && (
        <>
          <div className="solution">
            {q.parts.map((p, i) => (
              <div key={p.id} className="solution-item">
                <strong>{p.label ?? (q.parts.length > 1 ? `Part ${i + 1}` : 'Answer')}:</strong>
                <code className="canonical">
                  {formatValue(p)}
                  {p.unit ? ` ${p.unit}` : ''}
                </code>
                {p.tolerance ? <span className="muted">(±{p.tolerance} accepted)</span> : null}
              </div>
            ))}
          </div>
          <ExplanationBlock text={q.explanation} />
        </>
      )}

      <div className="actions">
        {!done && (
          <>
            <button type="submit" className="btn primary" disabled={!anyInput}>
              Check
            </button>
            <button type="button" className="btn" onClick={reveal}>
              Show solution
            </button>
          </>
        )}
        <button type="button" className={`btn ${done ? 'primary' : ''}`} onClick={onNext}>
          {done ? 'Next question →' : 'Skip →'}
        </button>
      </div>
    </form>
  )
}
