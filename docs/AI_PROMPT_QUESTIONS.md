# Prompt template: convert quizzes & general assignments into practice questions

This generates the **non-programming** question types (`multiple_choice`, `calculation`,
`param_count`, `open_ended`) plus quiz coding parts (`fill_blank` / `find_fix`).
For programming questions from Python scripts use [`AI_PROMPT.md`](AI_PROMPT.md) instead.

**Easiest way:** `npm run prompts` builds one ready-to-paste prompt per source file in
`generated/prompts/` (placeholders already filled in, source text appended). See the README.

**By hand:** copy everything below the line into the AI, replace the placeholders, then paste the
source document after it.

| placeholder | meaning | example |
|---|---|---|
| `{{SOURCE_NAME}}` | file name; becomes `category` and `source.script` | `GeneralAssignment3.md` |
| `{{ID_PREFIX}}` | prefix for every `id` | `ga3` |
| `{{SCOPE}}` | which part of the document to cover, and which extra open-ended questions to add | `the whole document. Extras: add 3-5 open_ended questions with ids ga3-open-01, ga3-open-02, ...` |

---

You convert university exam material for a *Neural Network Design and Training* course into
practice questions for a study app. Output **JSONL**: one complete JSON object per line, no
prose, no markdown fences, no trailing commas, no comments. Every line must validate against
the schema described below. The app grades answers where it can and, after the learner
answers, shows an explanation, so **the quality of the explanations is the point of this task.**

## Task
Source document: `{{SOURCE_NAME}}` (pasted/attached after this prompt). Cover **{{SCOPE}}**.

1. Convert **every** question in scope into exactly one practice question, in source order. Do not
   silently skip any; the only permitted reason to omit one is listed under "Accuracy" below.
2. Then add the **extra `open_ended` questions** that the scope line asks for. They ask the learner
   to *explain why* about key concepts the covered questions test (not a copy of an existing
   question), use the id pattern given in the scope line, and are required.

### How to read the source
- **General assignments (`.md`)**: `## Question N` blocks. Options look like
  `- **Option B:** text — **Selected**`. **`Selected` marks the correct option(s)** (the answer key).
  Numeric questions end with `**Your answer:** 10` - that number is the answer key.
  "(Select all that apply)" = several options may be correct; "(Select one answer.)" or no note =
  exactly one. Math is LaTeX (`$...$`); keep it as LaTeX (see "Text formatting rules").
- **Quizzes (`.pdf`, or text extracted from them)**: reference solutions. Part I = tick the
  correct statements (filled circle `•` / "Answer. A, C." mark the correct options, and per-option
  True/False reasoning is given - use it, but re-verify it). Part II = compute numbers /
  parameter counts. Part III = coding (fill the missing line / find the faulty lines).
- **Ignore** point values, grading schemes, "Version A/B" footers, "Source in the practice
  questions" provenance paragraphs, and any remarks about how the quiz was derived.
- Different versions of a quiz (A/B) are different files; cover only the one you were given.

## Choosing the type
| source question | output type |
|---|---|
| Statements, "which are correct?" (select all / select one) | `multiple_choice` (`selection` `"multiple"` / `"single"`) |
| Options are just numbers for something you compute (a loss, a count, one output dimension), or "answer with a single number" | `calculation`, or `param_count` if it asks for a number of trainable parameters / weights / biases. The learner types the number; **drop the options** and put what each tempting wrong option corresponds to into `explanation` |
| The answer is a shape/tuple, a matrix, a sequence or a formula | `multiple_choice` (a typed free-form answer can't be graded reliably) |
| Part II with several sub-answers (a), (b) | one `calculation`/`param_count` with several `parts` |
| Quiz Part III coding: "fill the missing line" | `fill_blank` |
| Quiz Part III coding: "find the faulty lines" | `find_fix` |
| Extra "explain why / compare" concepts | `open_ended` |

Never invent facts that are not supported by the source or by standard deep-learning knowledge.
Do not copy-paste whole slides. Each question must be **self-contained**: drop references like
"as on slide 40" or "the notes"; if the question cannot be answered without that material, omit it.

## Common fields (every question)
| field | required | notes |
|---|---|---|
| `id` | yes | unique across all files, lowercase `[a-z0-9_.-]`: `{{ID_PREFIX}}-q<NN>-<short-slug>` using the source question number (`{{ID_PREFIX}}-q07-bn-axes`); quizzes: `{{ID_PREFIX}}-p1-q3-dilation` (part and number); extras: the pattern from the scope line, e.g. `{{ID_PREFIX}}-open-01` |
| `type` | yes | `multiple_choice` \| `calculation` \| `param_count` \| `open_ended` \| `fill_blank` \| `find_fix` |
| `category` | yes | **exactly** `"{{SOURCE_NAME}}"` for every question |
| `source` | yes | `{"script": "{{SOURCE_NAME}}", "item": "Question 7"}` (`"Part II.2"` for quizzes) |
| `title` | yes | short topic label that does not give the answer away |
| `difficulty` | yes | `"easy"` (recall) \| `"medium"` (one reasoning step) \| `"hard"` (multi-step or subtle) |
| `tags` | yes | 1-4 lowercase topic tags: `"batchnorm"`, `"convolution"`, `"attention"`, `"loss"`, ... |
| `explanation` | **yes** | see "Explanations" - the most important field |
| `hints` | no (required for fill_blank/find_fix) | 1-3 strings, vague -> specific; never give the answer away in hint 1 |
| `related_reference` | no | omit (the PyTorch reference file is unrelated to these documents) |

All non-programming types additionally have `prompt` (required), `code` (optional) and **must not**
have `description`, `blanks` or `errors`.

## Text formatting rules (the app renders very little markup)
- Allowed in `prompt`, option `text`, explanations, key points, hints: plain text, `` `inline code` ``,
  `**bold**`, a blank line (`\n\n`) for a new paragraph, and **LaTeX math**: `$...$` inline,
  `$$...$$` for a centred display formula (rendered with KaTeX). **No HTML, no markdown headings,
  lists or tables.**
- **Use LaTeX for math**: variables and shapes (`$W \\in \\mathbb{R}^{D\\times K}$`, `$(N, K)$`), equations
  (`$$H_{out} = \\frac{H + 2p - k}{s} + 1$$`), sums, and matrices/vectors
  (`$$\\begin{bmatrix} 1 & 2 \\\\ 0 & -1 \\end{bmatrix}$$`). Keep the source's math as LaTeX instead of flattening it.
  Plain text is fine for simple things (`4 × 6`, `3x3`, "N samples").
- **JSON escaping - critical.** Inside a JSON string every LaTeX backslash must be written doubled:
  `"$W \\times x$"`, `"\\frac{a}{b}"`, `"\\theta"`, and `\\\\` for a matrix row break. A single `\t`, `\b`,
  `\f` or `\r` is a JSON escape and silently turns `\times`, `\beta`, `\frac`, `\rho` into a TAB, backspace,
  form feed or carriage return (the validator rejects those). Never use `\(...\)` or `\[...\]`.
- Math rules: the opening `$` must touch the formula (`$x$`, not `$ x $`); write currency without `$`;
  no blank line inside `$$...$$`; math inside `**bold**` is not rendered; use `\\text{...}` for words in a
  formula. Option text may contain inline math. `title`, part `label`/`unit` and `tags` are plain text (no `$`).
- Matrices can use `bmatrix` (as above). For a matrix **in code form** (e.g. a tensor literal like the
  PyTorch one), use the `code` field (a monospace block, newlines as `\n`), column-aligned:
  `"X = [[-6,  2],\n     [-2,  4]]"`. Do not put code fences inside any field.
- Never refer to options by letter ("A and C are true", "see option B") in any text, and never put
  `A)`, `Option A:` or `**Selected**` into option `text` - the app adds the letters itself and keeps
  the option order, so if the source says "both A and C" or "none of the above" rephrase it.

## `multiple_choice`
```
"prompt": "…", "code": "… (optional)", "selection": "single" | "multiple",
"options": [ {"text": "…", "correct": true|false, "explanation": "…"}, … ]
```
- 2-8 options, in source order, rewritten as stand-alone statements.
- `selection: "single"` -> **exactly one** option has `correct: true`. `"multiple"` -> one or more.
  Use `"multiple"` only where the source says "select all that apply" / "one or more".
- At least one option must be incorrect.
- `explanation` of the question: see below. **Every option needs its own `explanation`.**

## `calculation` and `param_count`
```
"prompt": "…", "code": "… (optional, e.g. the nn.Sequential)",
"parts": [ {"id": "total", "label": "Total trainable parameters", "value": 2598, "tolerance": 0, "unit": "parameters"} ]
```
- The learner types a number or an arithmetic expression (`432*6+6`); the app evaluates it.
- `value` is the correct number. `tolerance` is the accepted absolute error: omit (exact) for counts,
  sizes and other integers; for decimals set it to half of the last expected digit (e.g. 3 decimals
  -> `0.0005`) and say in the `prompt` how many decimals to give. A non-integer `value` without a
  `tolerance` is rejected.
- `param_count` values must be non-negative integers.
- With more than one part every part needs a `label`; use `id`s like `in_features`, `total`.
- If the source has a blank to fill inside code (`nn.Linear(____, 5)`), keep the code in `code` with
  `____` and ask for it as its own part.
- State all assumptions in the `prompt` (bias or not, stride, padding, groups, batch size...).

## `open_ended`
```
"prompt": "…", "model_answer": "2-6 sentences", "key_points": ["…", "…"]
```
- Self-graded: the learner reads `model_answer`, ticks which `key_points` they covered.
  `key_points` are 2-5 short, independent, checkable statements. Ask for reasoning ("Explain why…",
  "Compare…", "What goes wrong if…"), not for one-word recall.

## Explanations (required, this is what the learner studies from)
Every question's `explanation` must be at least 30 characters and **actually teach**:
- **multiple_choice**
  - Question `explanation`: 2-5 sentences giving the underlying concept or rule that decides the
    question and the takeaway, **not** a restatement of the options.
  - **Each option's `explanation`** (1-2 sentences, mandatory for correct *and* incorrect options):
    - correct option -> *why it is true* (the fact, formula or short derivation);
    - incorrect option -> *specifically why it is false*: name the wrong claim, state what is true
      instead, and, if there is one, the misconception that makes it tempting. "This is incorrect"
      or "This is false" alone is never acceptable. Do not just negate the option text.
- **calculation / param_count**: a worked solution - the formula, every intermediate number, the
  final value - and the typical wrong results with the mistake that produces each (forgetting the
  bias, counting the batch, using 'same' instead of 'valid' padding, ...), taken from the wrong
  options of the source question where there were any.
- **open_ended**: why the model answer is right, and the usual mistakes or half-answers.
- **fill_blank / find_fix**: why the correct code is right and what the wrong variants break.

## Accuracy (do this before writing each question)
1. Work every calculation out yourself; do not trust arithmetic in the source. Recount parameters,
   recompute shapes with the formulas, re-evaluate hinge/softmax/pooling numbers.
2. If your result disagrees with the source's answer key, or the source is ambiguous or incomplete
   (missing figure, missing slide content, unreadable formula), **omit that question** - an
   incorrect study question is worse than a missing one. This is the only permitted omission.
3. Use the exact numbers of the source; do not change values.

## Quiz coding parts (`fill_blank`, `find_fix`)
These reuse the programming schema; the code must be self-contained Python (add shape comments such
as `# logits: (B, K)`). Required: `description` (1-3 sentences what the *correct* code does, without
giving the answer away), `code`, `hints` (>= 2), and - for this task - `explanation`.
- `fill_blank`: put `<<BLANK:id>>` in `code` where the answer goes (whole line or inline), plus
  `"blanks": [{"id": "pred", "answers": ["…", "…"], "placeholder": "…"}]`. `answers` lists **every**
  reasonable spelling (`logits.argmax(dim=1)`, `logits.argmax(1)`, `torch.argmax(logits, dim=1)`);
  `answers[0]` is canonical; the learner types without indentation; spacing around punctuation and
  quote style are ignored but matching is case-sensitive. Every marker needs a `blanks` entry and
  vice versa.
- `find_fix`: `code` is the *buggy* code; `"errors": [{"line": 8, "fixes": ["entire corrected line", …], "explanation": "what is wrong"}]`
  with 1-based `line` numbers inside `code`, one entry per faulty line, `fixes[0]` canonical, every
  fix the **whole** line and different from the buggy line. A line with several mistakes needs a fix
  that corrects all of them.

## Output examples (each object is ONE line of the .jsonl file)
{"id":"quiz1a-pool-relu-order-01","type":"multiple_choice","category":"Quiz1A_reference_solution.pdf","source":{"script":"Quiz1A_reference_solution.pdf","item":"Part I.5"},"title":"Pooling and ReLU: does the order matter?","difficulty":"medium","tags":["pooling","relu"],"prompt":"Consider the 2×2 window X below. Pooling uses all four entries and ReLU acts element-wise. Which statements are correct?","code":"X = [[-6,  2],\n     [-2,  4]]","selection":"multiple","options":[{"text":"Max pooling followed by ReLU gives 4.","correct":true,"explanation":"The window's maximum is 4, and ReLU leaves a positive value unchanged, so the result is 4."},{"text":"Average pooling followed by ReLU gives 1.5.","correct":false,"explanation":"The mean of the original window is (−6 + 2 − 2 + 4)/4 = −0.5, and ReLU(−0.5) = 0. The value 1.5 belongs to the opposite order (ReLU first, then average)."},{"text":"Reversing the order of max pooling and ReLU changes the result.","correct":false,"explanation":"ReLU is non-decreasing, so max(ReLU(x_i)) = ReLU(max(x_i)). Both orders give 4. The order only matters for average pooling."},{"text":"ReLU followed by average pooling gives 1.5.","correct":true,"explanation":"ReLU turns the window into [[0, 2], [0, 4]]; the mean over all four positions is (0 + 2 + 0 + 4)/4 = 1.5."}],"hints":["Compute the four orderings separately instead of reasoning about them in general.","Which of the two pooling operations commutes with a non-decreasing function like ReLU?"],"explanation":"Max pooling commutes with ReLU because ReLU is non-decreasing: both orders give 4. Average pooling does not commute with ReLU: averaging first gives max(0, −0.5) = 0, while clipping the negatives first gives (0 + 2 + 0 + 4)/4 = 1.5. Average pooling always divides by all four positions, including the zeros created by ReLU."}

{"id":"quiz1a-cnn-infeatures-params-01","type":"param_count","category":"Quiz1A_reference_solution.pdf","source":{"script":"Quiz1A_reference_solution.pdf","item":"Part II.2"},"title":"in_features and total parameters of a small CNN","difficulty":"medium","tags":["convolution","shapes","parameters"],"prompt":"Input shape: (N, 3, 12, 10). Convolutions use stride 1, dilation 1 and groups 1. Find the missing in_features of the final linear layer, then count the trainable parameters of the whole model.","code":"import torch.nn as nn\nmodel = nn.Sequential(\n    nn.Conv2d(3, 4, 3, padding=1, bias=True), nn.ReLU(),\n    nn.MaxPool2d(2, stride=2),\n    nn.Conv2d(4, 6, 1, bias=False), nn.Flatten(),\n    nn.Linear(____, 5, bias=True),\n)","parts":[{"id":"in_features","label":"in_features of the Linear layer","value":180},{"id":"total","label":"Total trainable parameters","value":1041,"unit":"parameters"}],"hints":["Track the tensor shape through every layer, one at a time.","ReLU, pooling and flatten have no trainable parameters; the 1×1 convolution has no bias."],"explanation":"Shapes: (N,3,12,10) → conv with padding 1 keeps the spatial size: (N,4,12,10) → max-pool 2×2 halves it: (N,4,6,5) → 1×1 conv: (N,6,6,5) → flatten: (N,180), so in_features = 6·6·5 = 180.\n\nParameters: first conv 4·(3·3·3 + 1) = 112; second conv has no bias: 6·4·1·1 = 24; linear layer 180·5 + 5 = 905. Total 112 + 24 + 905 = 1,041."}

{"id":"ga6-hinge-loss-01","type":"calculation","category":"GeneralAssignment6.md","source":{"script":"GeneralAssignment6.md","item":"Question on multiclass hinge loss"},"title":"Multiclass hinge loss","difficulty":"easy","tags":["loss","hinge"],"prompt":"A classifier gives scores s_dog = 4, s_cat = 2 and s_ship = 1. The true class is cat. With margin 1, compute the multiclass hinge loss L = Σ_{j≠cat} max(0, s_j − s_cat + 1).","parts":[{"id":"loss","label":"Hinge loss L","value":3}],"hints":["Only the two wrong classes contribute a term each.","A term is zero when the wrong class's score is more than the margin below the true score."],"explanation":"dog: max(0, 4 − 2 + 1) = 3, because dog scores above the true class and violates the margin. ship: max(0, 1 − 2 + 1) = max(0, 0) = 0, because ship is exactly one margin below cat, which is allowed. The true class itself is excluded from the sum. L = 3 + 0 = 3."}

{"id":"quiz1a-conv1x1-product-01","type":"open_ended","category":"Quiz1A_reference_solution.pdf","source":{"script":"Quiz1A_reference_solution.pdf","item":"Part I.4"},"title":"Why a 1×1 convolution cannot compute a product","difficulty":"hard","tags":["convolution","linearity"],"prompt":"A bias-free 1×1 convolution (stride 1, padding 0, groups 1) receives two input channels u and v. Explain why, whatever its weights, it cannot output the product u·v for every input.","model_answer":"A bias-free 1×1 convolution computes a fixed weighted sum w1·u + w2·v at every position, so it is a linear function of (u, v). Matching u·v on the inputs (1, 0) and (0, 1) would force w1 = 0 and w2 = 0, but then the output at (1, 1) is 0 instead of 1. No choice of weights works.","key_points":["The layer is linear in its inputs (a weighted sum with no bias).","Evaluating at (1, 0) and (0, 1) forces both weights to zero.","The zero weights then fail at (1, 1), where u·v = 1."],"hints":["What kind of function of (u, v) can a weighted sum represent?","Try the inputs (1, 0), (0, 1) and (1, 1)."],"explanation":"The product u·v is not linear: scaling both inputs by 2 scales it by 4. A bias-free 1×1 convolution is linear, so it cannot represent it exactly. A non-linearity (or a bilinear/attention-style layer) is needed to multiply features. The counter-example with (1, 0), (0, 1), (1, 1) is a compact proof."}

{"id":"quiz1a-p3-q1-accuracy-argmax","type":"fill_blank","category":"Quiz1A_reference_solution.pdf","source":{"script":"Quiz1A_reference_solution.pdf","item":"Part III.1"},"title":"Predicted class per image","difficulty":"easy","tags":["argmax","accuracy"],"description":"Computes classification accuracy from a batch of class scores: pick a class per row, compare with the labels, average the hits.","code":"import torch\n\ndef accuracy(logits: torch.Tensor, labels: torch.Tensor):\n    # logits: (B, K), labels: (B,)\n    <<BLANK:pred>>\n    correct = predictions == labels\n    return correct.float().mean()","blanks":[{"id":"pred","answers":["predictions = logits.argmax(dim=1)","predictions = logits.argmax(1)","predictions = torch.argmax(logits, dim=1)","predictions = logits.argmax(dim=-1)"],"placeholder":"class index per row"}],"hints":["The result must have shape (B,), one class index per image.","Which axis of (B, K) holds the classes?"],"explanation":"The class axis is dimension 1, so argmax(dim=1) returns one class index per row and predictions has shape (B,). Comparing with labels gives one Boolean per image; converting to float and averaging gives the fraction of correct predictions. argmax(dim=0) would pick the best image per class instead."}

Example with LaTeX (note the doubled backslashes in the raw JSON line):

{"id":"latex-check-linear-layer-01","type":"calculation","category":"{{SOURCE_NAME}}","title":"Linear layer on a column vector (LaTeX rendering check)","difficulty":"easy","tags":["linear","shapes"],"prompt":"A linear layer computes $y = Wx + b$ with $W \\in \\mathbb{R}^{2\\times 2}$, $x \\in \\mathbb{R}^{2}$ and $b \\in \\mathbb{R}^{2}$:\n\n$$W = \\begin{bmatrix} 1 & 2 \\\\ 0 & -1 \\end{bmatrix}, \\quad x = \\begin{bmatrix} 3 \\\\ 4 \\end{bmatrix}, \\quad b = \\begin{bmatrix} -1 \\\\ 1 \\end{bmatrix}$$\n\nCompute the two entries of $y$.","parts":[{"id":"y1","label":"y₁","value":10},{"id":"y2","label":"y₂","value":-3}],"hints":["Each entry of $Wx$ is the dot product of one **row** of $W$ with $x$.","Do not forget to add $b$ at the end."],"explanation":"Row by row: $(Wx)_1 = 1\\cdot 3 + 2\\cdot 4 = 11$ and $(Wx)_2 = 0\\cdot 3 + (-1)\\cdot 4 = -4$, so\n\n$$y = \\begin{bmatrix} 11 \\\\ -4 \\end{bmatrix} + \\begin{bmatrix} -1 \\\\ 1 \\end{bmatrix} = \\begin{bmatrix} 10 \\\\ -3 \\end{bmatrix}$$\n\nCommon wrong results: forgetting the bias gives $(11, -4)$; using $W^\\top x$ (columns instead of rows) gives $(3, 2)$ before the bias and $(2, 3)$ after it."}

## Final checks before you answer
1. Every line is valid standalone JSON (escape `"` as `\"`, newlines as `\n`); no code fences, no text before/after.
2. `category` is exactly `{{SOURCE_NAME}}`; ids are unique and use the `{{ID_PREFIX}}-` prefix.
3. multiple_choice: `selection` matches the number of correct options; every option has its own explanation that says *why* it is right or wrong.
4. calculation/param_count: values recomputed by you; decimals have a `tolerance`; multi-part questions have labels.
5. LaTeX backslashes doubled in the JSON, math only inside `$...$`/`$$...$$`, no `Option A`/`**Selected**` text, no references to options by letter, no `description` on non-programming types.
6. Nothing in scope was skipped without a verified reason; the extra `open_ended` questions from the scope line are present.
7. Output only the JSONL lines. (Afterwards the user runs `npm run validate`.)
