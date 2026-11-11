interface Props {
  /** The question is finished (checked or revealed): the check/reveal slots disappear, Skip becomes Next. */
  done: boolean
  onNext: () => void
  /** Go back to the previously shown question. Omitted/undefined disables the button. */
  onBack?: () => void
  /** Renders the submit button. Leave undefined for question types without a Check step. */
  check?: { disabled?: boolean }
  reveal?: { label: string; onClick: () => void }
}

/**
 * The bottom button row shared by every question type. The slots are always in the same order
 * and anchored to the same edges - Back on the left; Check, reveal and Skip/Next packed against the
 * right edge with Skip/Next always last - so nothing moves between questions or after checking.
 */
export function ActionBar({ done, onNext, onBack, check, reveal }: Props) {
  return (
    <div className="actions">
      <button type="button" className="btn back" onClick={onBack} disabled={!onBack}>
        ← Back
      </button>
      <span className="actions-spacer" />
      {!done && check && (
        <button type="submit" className="btn primary" disabled={check.disabled}>
          Check
        </button>
      )}
      {!done && reveal && (
        <button type="button" className={`btn ${check ? '' : 'primary'}`} onClick={reveal.onClick}>
          {reveal.label}
        </button>
      )}
      <button type="button" className={`btn ${done ? 'primary' : ''}`} onClick={onNext}>
        {done ? 'Next question →' : 'Skip →'}
      </button>
    </div>
  )
}
