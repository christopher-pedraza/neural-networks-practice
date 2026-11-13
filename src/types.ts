export type Difficulty = 'easy' | 'medium' | 'hard'

interface QuestionBase {
  id: string
  category: string
  source?: { script: string; lines?: string; item?: string }
  title: string
  difficulty?: Difficulty
  tags?: string[]
  related_reference?: string[]
  /** Course slides that explain the idea (deck = PDF stem, page is 1-based). */
  slides?: { deck: string; page: number }[]
  /** Optional for programming questions, required (and substantive) for every other type. */
  explanation?: string
}

/** fill_blank / find_fix: a code snippet the learner works on. */
interface ProgrammingBase extends QuestionBase {
  description: string
  code: string
  hints: string[]
}

export interface Blank {
  id: string
  answers: string[]
  accepted_patterns?: string[]
  placeholder?: string
  multiline?: boolean
}

export interface CodeError {
  line: number
  fixes: string[]
  explanation?: string
}

export interface FillBlankQuestion extends ProgrammingBase {
  type: 'fill_blank'
  blanks: Blank[]
}

export interface FindFixQuestion extends ProgrammingBase {
  type: 'find_fix'
  errors: CodeError[]
}

/** multiple_choice / calculation / param_count / open_ended: a prompt plus a type-specific answer. */
interface ConceptualBase extends QuestionBase {
  prompt: string
  /** Supporting material (model definition, matrix, shapes) shown in a code block. */
  code?: string
  hints?: string[]
  explanation: string
}

export interface ChoiceOption {
  text: string
  correct: boolean
  /** Why this option is right / specifically why it is wrong. */
  explanation: string
}

export interface MultipleChoiceQuestion extends ConceptualBase {
  type: 'multiple_choice'
  selection: 'single' | 'multiple'
  options: ChoiceOption[]
}

export interface NumericPart {
  id: string
  label?: string
  value: number
  /** Accepted absolute error. Default 0 (exact). */
  tolerance?: number
  unit?: string
}

export interface CalculationQuestion extends ConceptualBase {
  type: 'calculation' | 'param_count'
  parts: NumericPart[]
}

export interface OpenEndedQuestion extends ConceptualBase {
  type: 'open_ended'
  model_answer: string
  key_points: string[]
}

export type ProgrammingQuestion = FillBlankQuestion | FindFixQuestion
export type ConceptualQuestion = MultipleChoiceQuestion | CalculationQuestion | OpenEndedQuestion
export type Question = ProgrammingQuestion | ConceptualQuestion
export type QuestionType = Question['type']

export interface Manifest {
  /** Paths relative to /data/. Both .json (array) and .jsonl are supported. */
  questionFiles: string[]
  reference: string
}

export interface RefParameter {
  name: string
  type?: string
  default?: string
  description: string
}

export interface RefEntry {
  name: string
  aliases?: string[]
  kind: string
  module?: string
  signature?: string
  summary: string
  parameters?: RefParameter[]
  returns?: string
  example?: string
  notes?: string[]
  see_also?: string[]
  tags?: string[]
}

export interface ReferenceFile {
  version?: string
  entries: RefEntry[]
}
