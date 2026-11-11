import { useCallback, useEffect, useState } from 'react'

/** Ids of the questions the learner has finished, remembered in localStorage across visits. */
export function useAnswered(storageKey: string) {
  const [ids, setIds] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as unknown
      if (Array.isArray(saved)) return new Set(saved.filter((x): x is string => typeof x === 'string'))
    } catch {
      /* ignore corrupt storage */
    }
    return new Set()
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...ids]))
    } catch {
      /* storage unavailable: progress lasts for this page load only */
    }
  }, [ids, storageKey])

  const add = useCallback((id: string) => setIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id))), [])
  const clear = useCallback(() => setIds(new Set()), [])
  return { ids, add, clear }
}
