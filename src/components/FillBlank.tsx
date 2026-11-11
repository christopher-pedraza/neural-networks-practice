import { useRef, useState, type FormEvent } from 'react'
import type { Blank, FillBlankQuestion } from '../types'
import { gradeBlank } from '../lib/grade'
import { ActionBar } from './ActionBar'

const MARKER = /<<BLANK:([A-Za-z0-9_-]+)>>/g

type Segment = { text: string } | { blank: string }

function parseLine(line: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of line.matchAll(MARKER)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) })
    out.push({ blank: m[1] })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last) })
  return out
}

const isMultiline = (b: Blank) => b.multiline ?? b.answers.some((a) => a.includes('\n'))

interface Props {
  q: FillBlankQuestion
  onGraded: (correct: boolean) => void
  onNext: () => void
  onBack?: () => void
  /** When false, blank placeholders and answer-length-based widths (both are hints) are hidden. */
  showPlaceholders?: boolean
}

export function FillBlank({ q, onGraded, onNext, onBack, showPlaceholders = true }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const graded = useRef(false)

  const blanks = new Map(q.blanks.map((b) => [b.id, b]))
  const results = new Map(q.blanks.map((b) => [b.id, gradeBlank(b, values[b.id] ?? '')]))
  const allCorrect = [...results.values()].every(Boolean)
  const done = revealed || (checked && allCorrect)

  function check(e: FormEvent) {
    e.preventDefault()
    if (revealed) return
    setChecked(true)
    if (!graded.current) {
      graded.current = true
      onGraded(allCorrect)
    }
  }

  function reveal() {
    setRevealed(true)
    if (!graded.current) {
      graded.current = true
      onGraded(false)
    }
  }

  function renderBlank(id: string) {
    const b = blanks.get(id)
    if (!b) return <span className="bad">[unknown blank {id}]</span>
    const solved = revealed ? b.answers[0] : (values[id] ?? '')
    const state = revealed ? 'revealed' : checked ? (results.get(id) ? 'ok' : 'bad') : ''
    const common = {
      className: `blank-input ${state}`,
      value: solved,
      placeholder: showPlaceholders ? (b.placeholder ?? '…') : '…',
      disabled: revealed || (checked && allCorrect),
      spellCheck: false,
      autoComplete: 'off',
      'aria-label': `Blank ${id}`,
      onChange: (ev: { target: { value: string } }) => {
        setChecked(false)
        setValues((v) => ({ ...v, [id]: ev.target.value }))
      },
    }
    if (isMultiline(b)) {
      return (
        <textarea
          {...common}
          rows={Math.max(2, b.answers[0].split('\n').length)}
          style={{
            width: showPlaceholders
              ? `${Math.max(24, ...b.answers[0].split('\n').map((l) => l.length + 4))}ch`
              : '40ch',
          }}
        />
      )
    }
    return (
      <input
        {...common}
        type="text"
        style={{
          width: showPlaceholders
            ? `${Math.max(12, b.answers[0].length + 4, (b.placeholder ?? '').length + 2)}ch`
            : '28ch',
        }}
      />
    )
  }

  return (
    <form className="answer-area" onSubmit={check}>
      <pre className="code" aria-label="Code with blanks">
        {q.code.split('\n').map((line, i) => (
          <div className="code-line" key={i}>
            <span className="ln">{i + 1}</span>
            <span className="src">
              {parseLine(line).map((s, j) =>
                'text' in s ? <span key={j}>{s.text}</span> : <span key={j}>{renderBlank(s.blank)}</span>,
              )}
              {line === '' && ' '}
            </span>
          </div>
        ))}
      </pre>

      {checked && !revealed && (
        <div className={`feedback ${allCorrect ? 'ok' : 'bad'}`}>
          {allCorrect
            ? '✅ Correct!'
            : `❌ ${[...results.values()].filter(Boolean).length} of ${q.blanks.length} blanks correct. Fix the red ones, or use a hint.`}
        </div>
      )}

      {done && (
        <div className="solution">
          {q.blanks.map((b) => (
            <div key={b.id} className="solution-item">
              <strong>{q.blanks.length > 1 ? `${b.id}: ` : 'Accepted: '}</strong>
              {b.answers.map((a, i) => (
                <code key={i} className={i === 0 ? 'canonical' : ''}>
                  {a}
                </code>
              ))}
            </div>
          ))}
          {q.explanation && <p className="explanation">{q.explanation}</p>}
        </div>
      )}

      <ActionBar
        done={done}
        onNext={onNext}
        onBack={onBack}
        check={{}}
        reveal={{ label: 'Show solution', onClick: reveal }}
      />
    </form>
  )
}
