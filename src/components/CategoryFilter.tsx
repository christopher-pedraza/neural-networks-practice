interface Props {
  counts: Map<string, number>
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

export function CategoryFilter({ counts, selected, onChange }: Props) {
  const all = [...counts.keys()].sort()
  const toggle = (c: string) => {
    const next = new Set(selected)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    onChange(next)
  }
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
      <ul>
        {all.map((c) => (
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
    </nav>
  )
}
