import { useEffect, useRef, useState } from 'react'
import { groupCategories } from '../lib/groups'

interface Props {
  counts: Map<string, number>
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

function GroupCheckbox({ checked, indeterminate, label, onChange }: {
  checked: boolean
  indeterminate: boolean
  label: string
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return <input ref={ref} type="checkbox" aria-label={label} checked={checked} onChange={onChange} />
}

export function CategoryFilter({ counts, selected, onChange }: Props) {
  const groups = groupCategories(counts.keys())
  const all = groups.flatMap((g) => g.categories)
  // Groups start collapsed so the sidebar stays short; the header still shows how much is selected.
  const [open, setOpen] = useState<Set<string>>(new Set())

  const toggle = (c: string) => {
    const next = new Set(selected)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    onChange(next)
  }
  const toggleGroup = (cats: string[]) => {
    const next = new Set(selected)
    const allOn = cats.every((c) => next.has(c))
    for (const c of cats) {
      if (allOn) next.delete(c)
      else next.add(c)
    }
    onChange(next)
  }
  const toggleOpen = (g: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })

  return (
    <nav className="filter-section" aria-label="Categories">
      <div className="filter-head">
        <h3>Categories</h3>
        <div>
          <button type="button" className="linkbtn" onClick={() => onChange(new Set(all))}>
            All
          </button>
          {' · '}
          <button type="button" className="linkbtn" onClick={() => onChange(new Set())}>
            None
          </button>
        </div>
      </div>
      {groups.map(({ group, categories }) => {
        const nOn = categories.filter((c) => selected.has(c)).length
        const total = categories.reduce((n, c) => n + (counts.get(c) ?? 0), 0)
        const isOpen = open.has(group)
        return (
          <div className="cat-group" key={group}>
            <div className="group-head">
              <GroupCheckbox
                label={`Select all in ${group}`}
                checked={nOn === categories.length}
                indeterminate={nOn > 0 && nOn < categories.length}
                onChange={() => toggleGroup(categories)}
              />
              <button
                type="button"
                className="group-toggle"
                aria-expanded={isOpen}
                onClick={() => toggleOpen(group)}
              >
                <span className="chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                <span className="group-name">{group}</span>
                <span className="count" title={`${nOn} of ${categories.length} selected · ${total} questions`}>
                  {nOn}/{categories.length}
                </span>
              </button>
            </div>
            {isOpen && (
              <ul>
                {categories.map((c) => (
                  <li key={c}>
                    <label>
                      <input type="checkbox" checked={selected.has(c)} onChange={() => toggle(c)} />
                      <span className="cat-name">{c}</span>
                      <span className="count">{counts.get(c)}</span>
                    </label>
                    <button type="button" className="linkbtn only" onClick={() => onChange(new Set([c]))}>
                      only
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}
