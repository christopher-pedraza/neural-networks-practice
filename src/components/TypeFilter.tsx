import type { QuestionType } from '../types'
import { QUESTION_TYPES } from '../lib/questionTypes'

interface Props {
  counts: Map<QuestionType, number>
  selected: Set<QuestionType>
  onChange: (next: Set<QuestionType>) => void
}

/** Which kinds of question to practise. Only types that exist in the loaded data are listed. */
export function TypeFilter({ counts, selected, onChange }: Props) {
  const available = QUESTION_TYPES.filter((t) => counts.has(t.type))
  const toggle = (t: QuestionType) => {
    const next = new Set(selected)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    onChange(next)
  }
  return (
    <nav className="filter-section" aria-label="Question types">
      <div className="filter-head">
        <h3>Question types</h3>
        <div>
          <button type="button" className="linkbtn" onClick={() => onChange(new Set(available.map((t) => t.type)))}>
            All
          </button>
          {' · '}
          <button type="button" className="linkbtn" onClick={() => onChange(new Set())}>
            None
          </button>
        </div>
      </div>
      <ul>
        {available.map(({ type, label }) => (
          <li key={type}>
            <label>
              <input type="checkbox" checked={selected.has(type)} onChange={() => toggle(type)} />
              <span className="cat-name" title={label}>{label}</span>
              <span className="count">{counts.get(type)}</span>
            </label>
            <button type="button" className="linkbtn only" onClick={() => onChange(new Set([type]))}>
              only
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
