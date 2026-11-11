import type { QuestionType } from '../types'

/** Display order and labels for the type filter and the question header chip. */
export const QUESTION_TYPES: readonly { type: QuestionType; label: string }[] = [
  { type: 'fill_blank', label: 'Fill in the blanks' },
  { type: 'find_fix', label: 'Identify & correct' },
  { type: 'multiple_choice', label: 'Multiple choice' },
  { type: 'calculation', label: 'Calculation' },
  { type: 'param_count', label: 'Parameter counting' },
  { type: 'open_ended', label: 'Open-ended' },
]

export const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map((t) => [t.type, t.label])) as Record<
  QuestionType,
  string
>
