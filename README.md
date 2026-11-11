# Neural Networks Practice

Static React + TypeScript app for practising your course material: PyTorch code from your own
scripts, plus quiz / general-assignment style questions.
No backend — questions and the PyTorch reference are JSON files fetched at runtime.

| type | what you do | graded |
|---|---|---|
| `fill_blank` **Fill in the blanks** | type the missing line(s)/expressions | automatically, many valid answers |
| `find_fix` **Identify & correct** | flag the buggy lines and type the fix | automatically |
| `multiple_choice` **Multiple choice** | pick one option, or tick all that apply | automatically, all-or-nothing |
| `calculation` **Calculation** | type a number or an expression (`432*6+6`) | automatically, optional tolerance |
| `param_count` **Parameter counting** | same, for trainable-parameter / weight counts | automatically, exact |
| `open_ended` **Open-ended** | write an answer, reveal the model answer, tick the key points you covered | self-graded |

- Every conceptual question (all types except the two code ones) has a **required explanation**:
  after answering you see why the right answer is right and, for multiple choice, a reason for
  **each** wrong option.
- Code questions accept *multiple valid answers*, show a description of what the snippet does and
  have progressive hints.
- Filter by **question type** and by **category** (script / source document) in the sidebar; both
  are remembered (the app stores what you switched *off*, so newly generated files appear by default).
- A searchable **PyTorch reference** opens as a side panel without leaving the question.
- Infinite practice mode (shuffled, reshuffles when exhausted).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # component + grading tests
npm run validate   # check public/data/** against schema/
npm run build      # validate + typecheck + bundle to dist/
```
Requires Node >= 22.18 (the validator imports the app's TS normaliser directly).

## Adding questions

### Programming questions (from Python scripts)

1. Give the AI the prompt in [`docs/AI_PROMPT.md`](docs/AI_PROMPT.md) plus a Python script.
2. Save its output as `public/data/questions/<name>.jsonl` (a `.json` array also works).
3. List the file in [`public/data/manifest.json`](public/data/manifest.json) → `questionFiles`.
4. Put the reference in `public/data/pytorch_reference.json`.
5. `npm run validate` — it reports the file/line and the problem for bad AI output.

### Quiz / assignment questions (multiple choice, calculations, parameter counts, open-ended)

Sources live in `source_files/quizzes/` and `source_files/general_assignments/`; the rules the AI
follows are in [`docs/AI_PROMPT_QUESTIONS.md`](docs/AI_PROMPT_QUESTIONS.md).

```bash
npm run prompts                 # one filled-in prompt per source file -> generated/prompts/ (+ INDEX.md)
#   --chunk 15                    assignments are split into parts of N questions (default 20, 0 = whole file)
#   --only Quiz                   only sources whose path contains "Quiz"
#   --batch                       also write generated/batch_requests.json for the Anthropic Message Batches API
# give each prompt to an LLM, save its reply as generated/outputs/<prompt-name>.jsonl, then:
npm run import -- generated/outputs/*.jsonl    # strips fences/chatter, merges parts, updates manifest.json
npm run validate                               # reports file:line + problem; fix the raw file and re-import
```

- **Agent with repo access** (does all of the above for all files at once, in parallel):
  give it [`docs/AI_PROMPT_QUESTIONS_ALL_FILES.md`](docs/AI_PROMPT_QUESTIONS_ALL_FILES.md).
- **Batch API**: `npm run prompts -- --batch`, then
  `curl https://api.anthropic.com/v1/messages/batches -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d @generated/batch_requests.json`.
  Each request's `custom_id` is the prompt name; save each result's text as `generated/outputs/<custom_id>.jsonl`
  (the `.partN` dots in prompt names become `_` in the id, rename accordingly).
- PDFs are turned into text with `pdftotext` (poppler); if it is missing the prompt tells you to
  attach the PDF instead.
- `public/data/questions/examples_conceptual.jsonl` holds 8 hand-checked example questions (one per type
  from Quiz 1A / General Assignment 6). Delete it (and its manifest line) once you have generated the real files.
- Question text supports `` `inline code` ``, `**bold**`, blank-line paragraphs and **LaTeX math** (`$x$` inline, `$$...$$` display, rendered by KaTeX; backslashes must be doubled in JSONL, e.g. `\\times`)

Schemas: [`schema/question.schema.json`](schema/question.schema.json),
[`schema/reference.schema.json`](schema/reference.schema.json).
`public/data` holds the questions generated from the scripts in `pa_source_files/`; the test fixture in `src/__tests__/fixtures/` is only used by the tests.

## Answer matching

Whitespace around punctuation and quote style are ignored (`x=a+b` ≡ `x = a + b`,
`'a'` ≡ `"a"`); keywords still need their spaces and matching is case-sensitive.
Anything else must be listed in `answers` / `fixes` (or covered by `accepted_patterns`).

## Deploy (GitHub Pages)

Repo → Settings → Pages → Source: **GitHub Actions**. Pushing to `main` runs
`.github/workflows/deploy.yml`. The build uses relative URLs (`base: './'`), so it
works under `https://<user>.github.io/<repo>/` without configuration.

## Layout

```
public/data/            manifest.json, questions/*.jsonl, pytorch_reference.json
schema/                 JSON Schemas for the data files
docs/AI_PROMPT.md       prompt template for generating data
scripts/validate-data.mjs
src/lib/                data.ts (fetch/parse), normalize.ts + grade.ts (answer checking)
src/hooks/usePractice.ts  shuffled infinite queue
scripts/build-prompts.mjs, import-questions.mjs   bulk generation helpers (see above)
docs/AI_PROMPT_QUESTIONS*.md   prompt templates for quizzes / general assignments
src/lib/numeric.ts      safe expression parser + tolerance grading for calculation questions
src/components/         QuestionView, FillBlank, FindFix, MultipleChoice, Calculation, OpenEnded,
                        ExplanationBlock, RichText, Hints, TypeFilter, CategoryFilter, ReferencePanel
```
