import type { EvidenceRule } from '../types'

/**
 * When a manager must leave a comment on a validation. The rating is the 1-3 manager band.
 * Nothing ticked means comments are optional.
 */
export const OPTIONAL: EvidenceRule = { always: false, lowest: false, highest: false }
const DEFAULT: EvidenceRule = { always: false, lowest: true, highest: false }

export const isOptional = (r: EvidenceRule) => !r.always && !r.lowest && !r.highest

/** Accepts the old single-choice values too, so frameworks saved before this change keep their meaning. */
export function normalizeEvidence(raw: unknown): EvidenceRule {
  if (raw === 'never') return OPTIONAL
  if (raw === 'on-negative') return DEFAULT
  if (raw === 'always') return { always: true, lowest: true, highest: true }
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<EvidenceRule>
    const always = r.always === true
    // "Always" means every rating, so it can't exist without both ends.
    return { always, lowest: always || r.lowest === true, highest: always || r.highest === true }
  }
  return DEFAULT
}

export const commentRequired = (rule: EvidenceRule, score: number | null, lowest = 1, highest = 3) =>
  rule.always || (score != null && ((rule.lowest && score === lowest) || (rule.highest && score === highest)))

export function describeEvidence(rule: EvidenceRule): string {
  if (rule.always) return 'required on every rating'
  if (rule.lowest && rule.highest) return 'required on the lowest and highest ratings'
  if (rule.lowest) return 'required on the lowest rating'
  if (rule.highest) return 'required on the highest rating'
  return 'optional'
}

export type EvidenceKey = 'optional' | 'always' | 'lowest' | 'highest'

/**
 * Apply one tick or untick. Returns the new rule and, when the change was refused or something else moved with it,
 * a plain-language note explaining why.
 *
 *  - Optional means no comment is ever required, so it can't sit alongside any other choice, and can't be unticked on its own.
 *  - Always required means every rating, so Lowest and Highest are both included and locked while it is on.
 *  - Lowest and Highest can be combined. Unticking the last one falls back to Optional.
 */
export function changeEvidence(rule: EvidenceRule, key: EvidenceKey, on: boolean): { rule: EvidenceRule; note: string | null } {
  if (key === 'optional') {
    if (!on) return { rule, note: 'Choose when a comment is required to turn Optional off. Until then comments stay optional.' }
    return { rule: OPTIONAL, note: isOptional(rule) ? null : 'Optional means no comment is required, so the other choices were cleared.' }
  }

  if (key === 'always') {
    if (on) return { rule: { always: true, lowest: true, highest: true }, note: rule.lowest || rule.highest ? 'Always required covers every rating, so Lowest and Highest are included and locked.' : null }
    return { rule: OPTIONAL, note: 'Back to optional. Tick Lowest or Highest to require comments on specific ratings.' }
  }

  if (rule.always) {
    return { rule, note: 'Always required covers every rating, so you can’t untick one. Untick Always required first.' }
  }
  const next = { ...rule, [key]: on }
  return { rule: next, note: isOptional(next) ? 'Nothing is ticked, so comments are optional.' : null }
}

/** Guards against a rule that contradicts itself, for example one that arrived from an old or hand-edited file. */
export function evidenceError(rule: EvidenceRule): string | null {
  if (rule.always && !(rule.lowest && rule.highest)) return 'Always required must include both the lowest and the highest rating.'
  return null
}
