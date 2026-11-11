import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadAll, type LoadedData } from './lib/data'
import { usePractice } from './hooks/usePractice'
import { useAnswered } from './hooks/useAnswered'
import { usePersistedSelection } from './hooks/usePersistedSelection'
import { CategoryFilter } from './components/CategoryFilter'
import { TypeFilter } from './components/TypeFilter'
import { ConfirmDialog } from './components/ConfirmDialog'
import { QuestionView } from './components/QuestionView'
import { ReferencePanel } from './components/ReferencePanel'
import type { QuestionType } from './types'

// Both store what the user switched OFF, so newly added categories/types show up by default.
const CATEGORIES_KEY = 'pa-practice:hidden-categories'
const TYPES_KEY = 'pa-practice:hidden-types'
const PLACEHOLDER_KEY = 'pa-practice:show-placeholders'
const ANSWERED_KEY = 'pa-practice:answered'
const HIDE_ANSWERED_KEY = 'pa-practice:hide-answered'

/** Per-session (sessionStorage) so it survives a reload but resets in a new tab/session. */
function loadShowPlaceholders(): boolean {
  try {
    return sessionStorage.getItem(PLACEHOLDER_KEY) !== 'false'
  } catch {
    return true
  }
}

export default function App() {
  const [data, setData] = useState<LoadedData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAll().then(setData, (e: Error) => setError(e.message))
  }, [])

  if (error) return <div className="status error">Could not load data: {error}</div>
  if (!data) return <div className="status">Loading…</div>
  return <Practice data={data} />
}

function Practice({ data }: { data: LoadedData }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of data.questions) m.set(q.category, (m.get(q.category) ?? 0) + 1)
    return m
  }, [data.questions])

  const typeCounts = useMemo(() => {
    const m = new Map<QuestionType, number>()
    for (const q of data.questions) m.set(q.type, (m.get(q.type) ?? 0) + 1)
    return m
  }, [data.questions])

  const [selected, setSelected] = usePersistedSelection(CATEGORIES_KEY, [...counts.keys()])
  const [selectedTypes, setSelectedTypes] = usePersistedSelection<QuestionType>(TYPES_KEY, [...typeCounts.keys()])

  const pool = useMemo(
    () => data.questions.filter((q) => selected.has(q.category) && selectedTypes.has(q.type)),
    [data.questions, selected, selectedTypes],
  )

  // "Answered" = checked or revealed at least once. It is remembered across visits, and by default
  // answered questions drop out of the queue until progress is reset.
  const answered = useAnswered(ANSWERED_KEY)
  const [hideAnswered, setHideAnswered] = useState(() => {
    try {
      return localStorage.getItem(HIDE_ANSWERED_KEY) !== 'false'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(HIDE_ANSWERED_KEY, String(hideAnswered))
    } catch {
      /* storage unavailable: the toggle still works for this page load */
    }
  }, [hideAnswered])
  const [resetNonce, setResetNonce] = useState(0)
  const { current, next, back, canBack, instanceKey } = usePractice(pool, {
    answered: answered.ids,
    hideAnswered,
    resetNonce,
  })
  const answeredInPool = useMemo(() => pool.filter((q) => answered.ids.has(q.id)).length, [pool, answered.ids])

  const [stats, setStats] = useState({ attempted: 0, firstTry: 0 })
  const onGraded = useCallback(
    (correct: boolean) => {
      if (!current) return
      // Re-doing a question you already finished doesn't count towards the score again.
      if (!answered.ids.has(current.id)) {
        setStats((s) => ({ attempted: s.attempted + 1, firstTry: s.firstTry + (correct ? 1 : 0) }))
      }
      answered.add(current.id)
    },
    [current, answered],
  )
  const [confirmingReset, setConfirmingReset] = useState(false)
  const closeReset = useCallback(() => setConfirmingReset(false), [])
  const resetProgress = useCallback(() => {
    setConfirmingReset(false)
    answered.clear()
    setStats({ attempted: 0, firstTry: 0 })
    setResetNonce((n) => n + 1)
  }, [answered])

  const [showPlaceholders, setShowPlaceholders] = useState(loadShowPlaceholders)
  useEffect(() => {
    try {
      sessionStorage.setItem(PLACEHOLDER_KEY, String(showPlaceholders))
    } catch {
      /* storage unavailable: the toggle still works for this page load */
    }
  }, [showPlaceholders])

  const [refOpen, setRefOpen] = useState(false)
  const [refRequest, setRefRequest] = useState<{ name: string; nonce: number } | null>(null)
  const openReference = useCallback((name: string) => {
    setRefOpen(true)
    setRefRequest((r) => ({ name, nonce: (r?.nonce ?? 0) + 1 }))
  }, [])

  return (
    <div className={`app ${refOpen ? 'with-ref' : ''}`}>
      <header className="topbar">
        <h1>Neural Networks Practice</h1>
        <div className="topbar-right">
          <span className="stats" title="Questions answered correctly on the first check">
            First-try correct: <strong>{stats.firstTry}</strong> / {stats.attempted}
          </span>
          <span className="stats" title="Questions finished (checked or revealed) in the current selection">
            Answered: <strong>{answeredInPool}</strong> / {pool.length}
          </span>
          <label className="toggle" title="Leave questions you have already finished out of the queue">
            <input type="checkbox" checked={hideAnswered} onChange={(e) => setHideAnswered(e.target.checked)} />
            Hide answered
          </label>
          <button type="button" className="btn small" onClick={() => setConfirmingReset(true)} title="Mark every question as unanswered again">
            Reset progress
          </button>
          <label className="toggle" title="Placeholders under each blank are hints; hide them to practise from memory">
            <input
              type="checkbox"
              checked={showPlaceholders}
              onChange={(e) => setShowPlaceholders(e.target.checked)}
            />
            Blank placeholders
          </label>
          <button type="button" className={`btn ${refOpen ? 'primary' : ''}`} onClick={() => {
              if (!refOpen) setRefRequest(null)
              setRefOpen(!refOpen)
            }}
          >
            📖 PyTorch reference
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <TypeFilter counts={typeCounts} selected={selectedTypes} onChange={setSelectedTypes} />
        <CategoryFilter counts={counts} selected={selected} onChange={setSelected} />
      </aside>

      <main className="main">
        {current ? (
          <QuestionView
            key={instanceKey}
            q={current}
            onGraded={onGraded}
            onNext={next}
            onBack={canBack ? back : undefined}
            onOpenReference={openReference}
            showPlaceholders={showPlaceholders}
          />
        ) : pool.length > 0 ? (
          <div className="status all-done">
            <p>🎉 You have answered every question in the current selection.</p>
            <div className="done-actions">
              {canBack && (
                <button type="button" className="btn" onClick={back}>
                  ← Back
                </button>
              )}
              <button type="button" className="btn" onClick={() => setHideAnswered(false)}>
                Review answered questions
              </button>
              <button type="button" className="btn primary" onClick={() => setConfirmingReset(true)}>
                Reset progress
              </button>
            </div>
          </div>
        ) : (
          <div className="status">
            {counts.size === 0
              ? 'No questions found. Add files to public/data/questions and list them in manifest.json.'
              : 'No questions match the current filters. Select at least one question type and one category.'}
          </div>
        )}
      </main>

      {confirmingReset && (
        <ConfirmDialog
          title="Reset progress?"
          message="Every question will count as unanswered again and your first-try score goes back to zero."
          confirmLabel="Yes, reset"
          onConfirm={resetProgress}
          onCancel={closeReset}
        />
      )}

      {refOpen && (
        <ReferencePanel
          entries={data.reference.entries}
          request={refRequest}
          onClose={() => setRefOpen(false)}
        />
      )}
    </div>
  )
}
