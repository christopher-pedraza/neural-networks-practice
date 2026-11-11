import type { Blank, CalculationQuestion, FindFixQuestion, MultipleChoiceQuestion } from '../types'
import { matchesAny } from './normalize.ts'
import { gradeNumeric } from './numeric.ts'

export function gradeBlank(blank: Blank, input: string): boolean {
  return matchesAny(input, blank.answers, blank.accepted_patterns)
}

export type LineVerdict = 'correct' | 'wrong-fix' | 'not-an-error'

export interface FindFixResult {
  /** Verdict for each line the learner flagged. */
  verdicts: Map<number, LineVerdict>
  /** Real error lines the learner did not flag. */
  missed: number[]
  allCorrect: boolean
}

export function gradeFindFix(
  q: FindFixQuestion,
  marked: ReadonlySet<number>,
  fixes: Readonly<Record<number, string>>,
): FindFixResult {
  const byLine = new Map(q.errors.map((e) => [e.line, e]))
  const verdicts = new Map<number, LineVerdict>()
  for (const line of marked) {
    const err = byLine.get(line)
    if (!err) verdicts.set(line, 'not-an-error')
    else verdicts.set(line, matchesAny(fixes[line] ?? '', err.fixes) ? 'correct' : 'wrong-fix')
  }
  const missed = q.errors.filter((e) => !marked.has(e.line)).map((e) => e.line)
  const allCorrect = missed.length === 0 && [...verdicts.values()].every((v) => v === 'correct')
  return { verdicts, missed, allCorrect }
}

export interface ChoiceResult {
  /** Exactly the correct set was picked. */
  correct: boolean
  wrongPicks: number
  missed: number
}

/** All-or-nothing, as in the quizzes: the picked set must equal the set of correct options. */
export function gradeChoice(q: MultipleChoiceQuestion, picked: ReadonlySet<number>): ChoiceResult {
  let wrongPicks = 0
  let missed = 0
  q.options.forEach((o, i) => {
    if (picked.has(i) && !o.correct) wrongPicks++
    if (!picked.has(i) && o.correct) missed++
  })
  return { correct: wrongPicks === 0 && missed === 0, wrongPicks, missed }
}

/** Verdict per part id. */
export function gradeCalculation(q: CalculationQuestion, values: Readonly<Record<string, string>>): Map<string, boolean> {
  return new Map(q.parts.map((p) => [p.id, gradeNumeric(p, values[p.id] ?? '')]))
}
