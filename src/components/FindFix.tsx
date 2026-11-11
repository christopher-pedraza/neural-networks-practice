import { useRef, useState, type FormEvent } from 'react'
import type { FindFixQuestion } from '../types'
import { gradeFindFix } from '../lib/grade'
import { ActionBar } from './ActionBar'

interface Props {
  q: FindFixQuestion
  onGraded: (correct: boolean) => void
  onNext: () => void
  onBack?: () => void
}

export function FindFix({ q, onGraded, onNext, onBack }: Props) {
  const lines = q.code.split('\n')
  const [marked, setMarked] = useState<Set<number>>(new Set())
  const [fixes, setFixes] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const graded = useRef(false)

  const result = gradeFindFix(q, marked, fixes)
  const done = revealed || (checked && result.allCorrect)
  const locked = done

  function toggle(line: number) {
    if (locked) return
    setChecked(false)
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
    // Pre-fill the editor with the current line so the learner edits it.
    setFixes((f) => (line in f ? f : { ...f, [line]: lines[line - 1].trim() }))
  }

  function check(e: FormEvent) {
    e.preventDefault()
    if (revealed || marked.size === 0) return
    setChecked(true)
    if (!graded.current) {
      graded.current = true
      onGraded(result.allCorrect)
    }
  }

  function reveal() {
    setRevealed(true)
    if (!graded.current) {
      graded.current = true
      onGraded(false)
    }
  }

  const errorByLine = new Map(q.errors.map((e) => [e.line, e]))
  const wrongMarks = [...result.verdicts.values()].filter((v) => v === 'not-an-error').length
  const wrongFixes = [...result.verdicts.values()].filter((v) => v === 'wrong-fix').length
  const found = [...result.verdicts.values()].filter((v) => v !== 'not-an-error').length

  return (
    <form className="answer-area" onSubmit={check}>
      <p className="muted">
        Click a line number (or the line) to flag it as wrong, then type the corrected line.
        {q.errors.length > 1 ? ` There are ${q.errors.length} errors.` : ' There is 1 error.'}
      </p>
      <pre className="code" aria-label="Buggy code">
        {lines.map((text, i) => {
          const n = i + 1
          const isMarked = marked.has(n)
          const verdict = checked && !revealed ? result.verdicts.get(n) : undefined
          const cls = [
            'code-line',
            'clickable',
            isMarked ? 'marked' : '',
            verdict === 'correct' ? 'ok' : verdict ? 'bad' : '',
            revealed && errorByLine.has(n) ? 'revealed' : '',
          ].join(' ')
          return (
            <div key={n}>
              <div className={cls} onClick={() => toggle(n)}>
                <button
                  type="button"
                  className="ln"
                  aria-pressed={isMarked}
                  aria-label={`Flag line ${n}`}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    toggle(n)
                  }}
                >
                  {isMarked ? '✗' : n}
                </button>
                <span className="src">{text || ' '}</span>
              </div>
              {isMarked && (
                <div className="fix-row" onClick={(e) => e.stopPropagation()}>
                  <label>
                    Fix for line {n}:
                    <input
                      type="text"
                      className={`blank-input ${verdict === 'correct' ? 'ok' : verdict ? 'bad' : ''}`}
                      value={revealed && errorByLine.has(n) ? errorByLine.get(n)!.fixes[0] : (fixes[n] ?? '')}
                      disabled={locked}
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(ev) => {
                        setChecked(false)
                        setFixes((f) => ({ ...f, [n]: ev.target.value }))
                      }}
                    />
                  </label>
                  {verdict === 'not-an-error' && <span className="bad-text">This line is fine.</span>}
                  {verdict === 'wrong-fix' && <span className="bad-text">Right line, but the fix isn't right yet.</span>}
                  {verdict === 'correct' && <span className="ok-text">✓</span>}
                </div>
              )}
            </div>
          )
        })}
      </pre>

      {checked && !revealed && (
        <div className={`feedback ${result.allCorrect ? 'ok' : 'bad'}`}>
          {result.allCorrect
            ? '✅ Correct — all errors found and fixed!'
            : `❌ Found ${found} of ${q.errors.length} errors` +
              (wrongFixes ? `; ${wrongFixes} fix${wrongFixes > 1 ? 'es' : ''} not right` : '') +
              (wrongMarks ? `; ${wrongMarks} flagged line${wrongMarks > 1 ? 's are' : ' is'} not an error` : '') +
              (result.missed.length ? `; ${result.missed.length} still to find` : '') +
              '.'}
        </div>
      )}

      {done && (
        <div className="solution">
          {q.errors.map((e) => (
            <div key={e.line} className="solution-item">
              <strong>Line {e.line}:</strong>
              {e.fixes.map((f, i) => (
                <code key={i} className={i === 0 ? 'canonical' : ''}>
                  {f === '' ? '(delete this line)' : f}
                </code>
              ))}
              {e.explanation && <div className="muted">{e.explanation}</div>}
            </div>
          ))}
          {q.explanation && <p className="explanation">{q.explanation}</p>}
        </div>
      )}

      <ActionBar
        done={done}
        onNext={onNext}
        onBack={onBack}
        check={{ disabled: marked.size === 0 }}
        reveal={{ label: 'Show solution', onClick: reveal }}
      />
    </form>
  )
}
