import { useState } from 'react'
import { RichInline } from './RichText'

export function Hints({ hints }: { hints: string[] }) {
  const [shown, setShown] = useState(0)
  return (
    <div className="hints">
      {shown < hints.length && (
        <button type="button" className="btn" onClick={() => setShown(shown + 1)}>
          💡 {shown === 0 ? 'Show hint' : 'Show next hint'} ({shown}/{hints.length})
        </button>
      )}
      {shown > 0 && (
        <ol className="hint-list">
          {hints.slice(0, shown).map((h, i) => (
            <li key={i}>
              <RichInline text={h} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
