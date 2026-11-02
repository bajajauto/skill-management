// When a manager must leave a comment on a validation. Mirrors client/src/lib/evidence.ts.
// The rating is the 1-3 manager band: lowest = 1, highest = 3. Nothing ticked means optional.

const DEFAULT = { always: false, lowest: true, highest: false }

/** Accepts the old single-choice values too, so frameworks saved before this change keep their meaning. */
export function normalizeEvidence(raw) {
  if (raw === 'never') return { always: false, lowest: false, highest: false }
  if (raw === 'on-negative') return { ...DEFAULT }
  if (raw === 'always') return { always: true, lowest: true, highest: true }
  if (raw && typeof raw === 'object') {
    const always = raw.always === true
    return { always, lowest: always || raw.lowest === true, highest: always || raw.highest === true }
  }
  return { ...DEFAULT }
}

export const commentRequired = (rule, score, lowest = 1, highest = 3) =>
  rule.always || (score != null && ((rule.lowest && score === lowest) || (rule.highest && score === highest)))

export function describeEvidence(rule) {
  if (rule.always) return 'required on every rating'
  if (rule.lowest && rule.highest) return 'required on the lowest and highest ratings'
  if (rule.lowest) return 'required on the lowest rating'
  if (rule.highest) return 'required on the highest rating'
  return 'optional'
}
