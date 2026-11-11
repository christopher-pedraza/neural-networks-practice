import { useEffect, useState } from 'react'

/**
 * A filter selection ("which of `available` are shown") persisted in localStorage.
 * It stores what the user switched OFF, so categories/types that appear later
 * (e.g. after generating a new question file) are shown by default.
 */
export function usePersistedSelection<T extends string>(storageKey: string, available: T[]) {
  const [selected, setSelected] = useState<Set<T>>(() => {
    let hidden: string[] = []
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as unknown
      if (Array.isArray(saved)) hidden = saved.filter((x): x is string => typeof x === 'string')
    } catch {
      /* ignore corrupt storage */
    }
    return new Set(available.filter((a) => !hidden.includes(a)))
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(available.filter((a) => !selected.has(a))))
    } catch {
      /* storage unavailable: the filter still works for this page load */
    }
    // `available` is fixed for the lifetime of the loaded data.
  }, [selected, storageKey])

  return [selected, setSelected] as const
}
