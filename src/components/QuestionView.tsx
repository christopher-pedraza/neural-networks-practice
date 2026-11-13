import { useState } from 'react'
import type { Question } from '../types'
import { FillBlank } from './FillBlank'
import { FindFix } from './FindFix'
import { Hints } from './Hints'
import { MultipleChoice } from './MultipleChoice'
import { Calculation } from './Calculation'
import { OpenEnded } from './OpenEnded'
import { CodeBlock } from './CodeBlock'
import { RichText } from './RichText'
import { TYPE_LABEL } from '../lib/questionTypes'

interface Props {
  q: Question
  onGraded: (correct: boolean) => void
  onNext: () => void
  /** Back to the previously shown question; undefined when there is none. */
  onBack?: () => void
  onOpenReference: (name: string) => void
  /** Show the per-blank placeholder text (a hint). Defaults to true. */
  showPlaceholders?: boolean
}

export function QuestionView({ q, onGraded, onNext, onBack, onOpenReference, showPlaceholders = true }: Props) {
  // The related APIs name the functions you need to recall, so they stay hidden until asked for (per question).
  const [relatedShown, setRelatedShown] = useState(false)
  const [slidesShown, setSlidesShown] = useState(false)
  const slides = q.slides ?? []
  const related = q.related_reference ?? []
  return (
    <article className="question">
      <header className="q-header">
        <div className="chips">
          <span className="chip category">{q.category}</span>
          <span className="chip">{TYPE_LABEL[q.type]}</span>
          {q.difficulty && <span className={`chip diff-${q.difficulty}`}>{q.difficulty}</span>}
          {q.source?.lines && <span className="chip muted">lines {q.source.lines}</span>}
        </div>
        <h2>{q.title}</h2>
      </header>

      {q.type === 'fill_blank' || q.type === 'find_fix' ? (
        <section className="description">
          <h3>What this code does</h3>
          <p>{q.description}</p>
        </section>
      ) : (
        <>
          <section className="description prompt">
            <h3>Question</h3>
            <RichText text={q.prompt} />
          </section>
          {q.code && <CodeBlock code={q.code} />}
        </>
      )}

      {related.length > 0 && (
        <div className="related">
          <button
            type="button"
            className="btn small"
            aria-expanded={relatedShown}
            onClick={() => setRelatedShown((v) => !v)}
          >
            📚 {relatedShown ? 'Hide related APIs' : `Show related APIs (${related.length})`}
          </button>
          {relatedShown &&
            related.map((name) => (
              <button key={name} type="button" className="chip link" onClick={() => onOpenReference(name)}>
                {name}
              </button>
            ))}
        </div>
      )}

      {slides.length > 0 && (
        <div className="related">
          <button
            type="button"
            className="btn small"
            aria-expanded={slidesShown}
            onClick={() => setSlidesShown((v) => !v)}
          >
            🎞 {slidesShown ? 'Hide course slides' : `Show course slides (${slides.length})`}
          </button>
          {slidesShown &&
            slides.map(({ deck, page }) => (
              <span key={`${deck}-${page}`} className="chip" title={`${deck}.pdf, printed slide number ${page}`}>
                {deck.replace(/_/g, ' ')} · slide {page}
              </span>
            ))}
        </div>
      )}

      {q.hints && q.hints.length > 0 && <Hints hints={q.hints} />}

      {(() => {
        switch (q.type) {
          case 'fill_blank':
            return <FillBlank q={q} onGraded={onGraded} onNext={onNext} onBack={onBack} showPlaceholders={showPlaceholders} />
          case 'find_fix':
            return <FindFix q={q} onGraded={onGraded} onNext={onNext} onBack={onBack} />
          case 'multiple_choice':
            return <MultipleChoice q={q} onGraded={onGraded} onNext={onNext} onBack={onBack} />
          case 'calculation':
          case 'param_count':
            return <Calculation q={q} onGraded={onGraded} onNext={onNext} onBack={onBack} />
          case 'open_ended':
            return <OpenEnded q={q} onGraded={onGraded} onNext={onNext} onBack={onBack} />
        }
      })()}
    </article>
  )
}
