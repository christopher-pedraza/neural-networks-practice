/** Supporting material for conceptual questions (model definitions, matrices, shape tables). */
export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="code plain" aria-label="Question material">
      {code}
    </pre>
  )
}
