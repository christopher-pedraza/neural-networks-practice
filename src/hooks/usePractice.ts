import { useCallback, useMemo, useRef, useState } from 'react'
import type { Question } from '../types'

function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Options {
  /** Ids the learner has already finished. */
  answered: ReadonlySet<string>
  /** Leave answered questions out of the queue. */
  hideAnswered: boolean
  /** Bump to throw the queue away and rebuild it (e.g. after resetting progress). */
  resetNonce: number
}

interface Nav {
  key: string
  /** The current shuffled pass; `pos` is the next index to hand out. */
  order: Question[]
  pos: number
  /** Every question shown since the queue was last rebuilt, so Back can revisit them. */
  trail: Question[]
  /** Index into `trail` of what is on screen; `trail.length` means "nothing left to show". */
  cursor: number
}

/**
 * Practice queue over `pool`: a shuffled pass through the questions, then a fresh shuffle of whatever
 * is still unanswered. Back/Next walk a trail of what was shown. The queue is rebuilt (and the trail
 * cleared) when the filters, the "hide answered" setting or `resetNonce` change - but NOT when a
 * question gets answered, so the question on screen never disappears from under the learner.
 */
export function usePractice(pool: Question[], { answered, hideAnswered, resetNonce }: Options) {
  const poolRef = useRef(pool)
  const answeredRef = useRef(answered)
  poolRef.current = pool
  answeredRef.current = answered

  const key = `${hideAnswered}:${resetNonce}:${pool.map((q) => q.id).join('|')}`

  const build = useCallback(
    () => shuffle(poolRef.current.filter((q) => !hideAnswered || !answeredRef.current.has(q.id))),
    [hideAnswered],
  )

  const initial = useMemo<Nav>(() => {
    const order = build()
    return { key, order, pos: order.length ? 1 : 0, trail: order.slice(0, 1), cursor: 0 }
    // `key` already covers every input that should restart the queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const [state, setState] = useState<Nav>(initial)
  const nav = state.key === key ? state : initial

  const next = useCallback(() => {
    setState((prev) => {
      const n = prev.key === key ? prev : initial
      if (n.cursor < n.trail.length - 1) return { ...n, cursor: n.cursor + 1 }
      let { order, pos } = n
      if (pos >= order.length) {
        order = build()
        pos = 0
      }
      if (order.length === 0) return { ...n, order, pos, cursor: n.trail.length }
      return { ...n, order, pos: pos + 1, trail: [...n.trail, order[pos]], cursor: n.trail.length }
    })
  }, [key, initial, build])

  const back = useCallback(() => {
    setState((prev) => {
      const n = prev.key === key ? prev : initial
      return n.cursor > 0 ? { ...n, cursor: n.cursor - 1 } : n
    })
  }, [key, initial])

  const current = nav.trail[nav.cursor] as Question | undefined
  return { current, next, back, canBack: nav.cursor > 0, instanceKey: `${key}:${nav.cursor}:${current?.id}` }
}
