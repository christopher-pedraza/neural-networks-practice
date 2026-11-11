import { RichText } from './RichText'

/** The "why" shown once a conceptual question has been answered or revealed. */
export function ExplanationBlock({ text }: { text: string }) {
  return (
    <section className="explanation-block" aria-label="Explanation">
      <h3>Explanation</h3>
      <RichText text={text} />
    </section>
  )
}
