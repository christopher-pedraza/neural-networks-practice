/**
 * Sidebar grouping for categories. A category is the source file/document name
 * (see schema/question.schema.json), so the group is derived from that name.
 * Anything unrecognised lands in "Other" rather than being hidden.
 */
const GROUP_RULES: { group: string; test: RegExp }[] = [
  { group: 'General assignments', test: /^general\s*assignment/i },
  { group: 'Quizzes', test: /^quiz/i },
  { group: 'Programming assignments', test: /^(p|pa)\s?\d/i },
]

export const GROUP_ORDER = GROUP_RULES.map((r) => r.group)
export const FALLBACK_GROUP = 'Other'

export function groupOf(category: string): string {
  return GROUP_RULES.find((r) => r.test.test(category))?.group ?? FALLBACK_GROUP
}

/** Categories bucketed by group, groups in a stable order and categories natural-sorted inside each. */
export function groupCategories(categories: Iterable<string>): { group: string; categories: string[] }[] {
  const buckets = new Map<string, string[]>()
  for (const c of categories) {
    const g = groupOf(c)
    buckets.set(g, [...(buckets.get(g) ?? []), c])
  }
  const rank = (g: string) => {
    const i = GROUP_ORDER.indexOf(g)
    return i === -1 ? GROUP_ORDER.length : i
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([group, cats]) => ({
      group,
      categories: cats.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    }))
}
