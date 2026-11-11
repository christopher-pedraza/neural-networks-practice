import { useMemo, type ReactNode } from 'react'
import katex from 'katex'
import { tokenize } from '../lib/richtext'

/** Renders one formula. Invalid TeX is shown as red source text instead of crashing the page. */
function Formula({ tex, display }: { tex: string; display: boolean }) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
        errorColor: '#cc0000',
      }),
    [tex, display],
  )
  // KaTeX output is escaped and `trust` is off, so it cannot inject scripts or arbitrary HTML.
  return <span className={display ? 'math-display' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }} />
}

function inline(text: string): ReactNode[] {
  return tokenize(text).map((s, i) => {
    switch (s.kind) {
      case 'code':
        return <code key={i}>{s.value}</code>
      case 'bold':
        return <strong key={i}>{s.value}</strong>
      case 'math':
        return <Formula key={i} tex={s.value} display={s.display} />
      default:
        return s.value
    }
  })
}

/**
 * Minimal markup for question text: blank line = new paragraph, `code`, **bold**, $math$, $$math$$.
 * Single newlines are kept (CSS white-space: pre-wrap). No HTML.
 */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`rich ${className}`}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>{inline(para.trim())}</p>
      ))}
    </div>
  )
}

/** Inline-only variant for option labels. */
export function RichInline({ text }: { text: string }) {
  return <>{inline(text)}</>
}
