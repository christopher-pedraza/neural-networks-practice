# Prompt: map questions to course slides

Use this when an AI agent with access to the repository (Claude Code, Codex, ...) should add the
`slides` field (deck + page of the lecture slides that explain the idea) to questions that do not
have it yet. Give the agent everything below the line, and fill in the **Scope** line.

Already mapped: `generalassignment5.jsonl`, `generalassignment6.jsonl`. Cost reference: about 2k tokens
per question when done by sub-agents (GA5: 44 questions, ~88k tokens). Programming questions are
cheaper per question because many share one snippet and one slide set.

---

You are adding slide references to the practice questions in this repository. Work autonomously and
finish the whole scope.

## Scope
<!-- Replace with what to map, e.g.:
     "all of public/data/questions/quiz*.jsonl"
     "public/data/questions/generalassignment1.jsonl to generalassignment4.jsonl"
     "everything under public/data/questions/ that has no `slides` field yet, except extra_*.jsonl" -->
Map: **<files or globs>**

## Inputs
- Questions: `public/data/questions/*.jsonl` (one JSON object per line). Use `jq` to read them.
- Slide text: `source_files/course_material_md/<deck>.md`, one file per lecture deck (17 decks:
  C01-C13, C20, D01, D02, D08). If the folder is missing, recreate it from the PDFs in
  `source_files/course_material/`:
  ```bash
  mkdir -p source_files/course_material_md
  for f in source_files/course_material/*.pdf; do
    pdftotext -layout "$f" - | sed 's/\f/\n\n---\n\n/g' | cat -s > "source_files/course_material_md/$(basename "$f" .pdf).md"
  done
  ```
- **Page numbers**: every PDF page is one chunk and chunks are separated by a line that is exactly
  `---`. PDF page N (1-based) is the Nth chunk, so the text before the first `---` is page 1. Print a page with
  `awk -v RS='\n---\n' 'NR==14' source_files/course_material_md/C10_DataPreProcessing.md`.
  The deck name is the file name without `.md`, e.g. `C10_DataPreProcessing`.
- **Cite the number PRINTED on the slide, not the PDF page** (the user checks printed numbers in notes). It is
  the number in the footer line at the end of the chunk (`P. Wonka   12`). For every deck except C02 it equals
  the PDF page (title/divider pages without a footer follow the same numbering). **C02_TensorDataStructure**
  skips slide 6, so from PDF page 6 on, printed = PDF page + 1. Always read the footer of the chunk you cite
  and use that number; if a chunk has no footer, derive it from its neighbours.
- The schema field (`slides`) is described in `schema/question.schema.json`; `npm run validate` checks
  that each deck exists and the number is in range (when `source_files/` is present).

## Rules
1. Per question, give 1-3 slides that **directly explain the idea being tested**. Prefer the most specific
   page (the slide with the formula / definition / diagram), not the start of a section.
2. **Open and read every page before citing it.** Locate candidates with `rg` on keywords, then read the
   page. Never cite a page from memory or from the table of contents alone.
3. For programming questions (`fill_blank` / `find_fix`) cite the slides for the concept the code
   implements (e.g. the attention-score slide for a masked-softmax snippet). Variants of the same snippet
   (`-v2`, `-v3`, ...) share the same slides.
4. For calculations and parameter counts cite the slide with the formula used. For pure arithmetic with no
   matching concept, give an empty list instead of guessing.
5. Give a confidence per question: `high` (the slide states the idea/formula explicitly), `medium` (same
   topic, but not the exact point), `low` (best guess; prefer an empty list over `low`).
6. Do not change anything in a question except adding/replacing its `slides` field.

## Procedure
1. List the questions in scope: `jq -r '[.id,.type,.title]|@tsv' <file>`. Group them by topic.
2. Split the work across sub-agents in parallel, **one per question file** (or per ~50 questions for big
   files), and tell each one to read only the decks relevant to its topics. Each sub-agent writes a mapping
   file in the scratchpad/temp directory (not in the repo):
   ```json
   { "<question id>": { "slides": [ { "deck": "C10_DataPreProcessing", "page": 12 } ], "confidence": "high" } }
   ```
   covering every question id of its file exactly once.
3. Merge each mapping into its question file:
   `node scripts/merge-slides.mjs <mapping.json> public/data/questions/<file>.jsonl`
4. `npm run validate` (it fails on an unknown deck or out-of-range page), then `npm test`.
5. Report: per file the number of questions mapped, the counts per confidence level, the ids left without
   slides, and the token usage of the sub-agents.
