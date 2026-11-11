# Bulk generation: all quizzes and general assignments at once

Use this when an AI agent with access to the repository (Claude Code, Codex, ...) should generate the
multiple-choice / calculation / parameter-counting / open-ended questions for **every** file in
`source_files/quizzes/` and `source_files/general_assignments/` in one go. Give the agent everything
below the line. (Chat-only models: use the per-file prompts from `npm run prompts` instead, see the README.)

---

You are generating practice questions for the study app in this repository. Work autonomously and
finish the whole job.

## Inputs
- The generation rules: `docs/AI_PROMPT_QUESTIONS.md` (everything below its first `---` line). They
  are authoritative for the question types, fields, explanations and accuracy rules.
- The schema: `schema/question.schema.json`; the validator: `npm run validate`.
- Sources: all files in `source_files/general_assignments/` (6 Markdown files, ~50 questions each)
  and `source_files/quizzes/` (4 PDFs: Quiz 1 A/B, Quiz 2 A/B). Read the PDFs directly (not via a text
  dump) so matrices and formulas are not garbled.

## Procedure
1. Run `npm run prompts`. It writes one fully-filled prompt per source file (assignments are split
   into parts of 20 questions) to `generated/prompts/`, with the right `category`, `id` prefix and
   scope for each part. `generated/prompts/INDEX.md` lists them.
2. Process **every** prompt in `generated/prompts/` independently - in parallel, e.g. one sub-agent per
   prompt file - following that prompt exactly. For quiz prompts open the PDF named in the prompt.
   Each reply is **JSONL only**; save it as `generated/outputs/<prompt stem>.jsonl` (the INDEX.md
   column "save reply as" gives the exact path).
3. Import: `node scripts/import-questions.mjs generated/outputs/*.jsonl`. This merges the parts of
   one source into `public/data/questions/<source>.jsonl` and lists them in `public/data/manifest.json`.
4. Run `npm run validate`. Fix every reported problem **in the raw file under `generated/outputs/`**
   (the message names the question id), re-run step 3 and 4 until it prints `data OK`. Do not weaken
   the schema or the validator to make errors disappear.
5. Run `npm test` and `npm run build` once at the end.

## Hard requirements (details in the rules file)
- One question per source question, in source order, none skipped unless you verified that the source's
  answer key is wrong or the question is unanswerable without missing material. List every omission
  (source file, question number, reason) in your final report.
- Every question has a substantive `explanation`; every `multiple_choice` option has its own
  `explanation` saying why it is right or specifically why it is wrong.
- All arithmetic re-derived by you; shapes/parameter counts recomputed with the formulas.
- LaTeX only inside `$...$` / `$$...$$` with every backslash doubled in the JSON (`\\times`); no `Option A` / `**Selected**` text; `id`s unique across all files.
- Do not modify existing question files, the schema, the validator, or the app code.
- `public/data/questions/examples_conceptual.jsonl` contains hand-written examples from Quiz 1A. If
  your generated Quiz 1A file covers the same questions, delete that examples file and its manifest entry.

## Final report
Counts per source file and per type, the omissions list, anything you were unsure about (with the
question id), and the output of `npm run validate`.
