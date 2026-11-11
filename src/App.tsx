import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadAll, type LoadedData } from './lib/data'
import { usePractice } from './hooks/usePractice'
import { usePersistedSelection } from './hooks/usePersistedSelection'
import { CategoryFilter } from './components/CategoryFilter'
import { TypeFilter } from './components/TypeFilter'
import { QuestionView } from './components/QuestionView'
import { ReferencePanel } from './components/ReferencePanel'
import type { QuestionType } from './types'

// Both store what the user switched OFF, so newly added categories/types show up by default.
const CATEGORIES_KEY = 'pa-practice:hidden-categories'
const TYPES_KEY = 'pa-practice:hidden-types'
const PLACEHOLDER_KEY = 'pa-practice:show-placeholders'

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
  const { current, next, instanceKey } = usePractice(pool)

  const [stats, setStats] = useState({ attempted: 0, firstTry: 0 })
  const onGraded = useCallback(
    (correct: boolean) =>
      setStats((s) => ({ attempted: s.attempted + 1, firstTry: s.firstTry + (correct ? 1 : 0) })),
    [],
  )

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
            onOpenReference={openReference}
            showPlaceholders={showPlaceholders}
          />
        ) : (
          <div className="status">
            {counts.size === 0
              ? 'No questions found. Add files to public/data/questions and list them in manifest.json.'
              : 'No questions match the current filters. Select at least one question type and one category.'}
          </div>
        )}
      </main>

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
