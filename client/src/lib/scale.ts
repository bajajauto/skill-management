import type { Bands, Scale } from '../types'

export function defaultLikertLabels(points: number): string[] {
  const presets: Record<number, string[]> = {
    3: ['Not yet', 'Developing', 'Proficient'],
    4: ['Not yet', 'Developing', 'Proficient', 'Expert'],
    5: ['No exposure', 'Beginner', 'Developing', 'Proficient', 'Expert'],
    6: ['No exposure', 'Beginner', 'Developing', 'Competent', 'Proficient', 'Expert'],
    7: ['No exposure', 'Novice', 'Beginner', 'Developing', 'Competent', 'Proficient', 'Expert'],
  }
  return presets[points] ?? Array.from({ length: points }, (_, i) => `Level ${i + 1}`)
}

export interface ScaleOption {
  value: number
  label: string
}

/** The values a rater can pick from. Percentage scales are continuous, so they return stepped values. */
export function scaleOptions(scale: Scale): ScaleOption[] {
  if (scale.type === 'binary') {
    return [
      { value: 1, label: scale.yesLabel },
      { value: 0, label: scale.noLabel },
    ]
  }
  if (scale.type === 'likert') {
    const start = scale.startAtZero ? 0 : 1
    return scale.labels.map((label, i) => ({ value: start + i, label }))
  }
  const out: ScaleOption[] = []
  for (let v = 0; v <= 100; v += scale.step) out.push({ value: v, label: `${v}%` })
  return out
}

export function scaleRange(scale: Scale): [number, number] {
  if (scale.type === 'binary') return [0, 1]
  if (scale.type === 'likert') return scale.startAtZero ? [0, scale.points - 1] : [1, scale.points]
  return [0, 100]
}

/** Normalise a raw rating to 0-100 so every scale feeds the same score bands. */
export function toPercent(scale: Scale, value: number): number {
  const [min, max] = scaleRange(scale)
  return ((value - min) / (max - min)) * 100
}

/** 0 is reserved for "not assessed", so a scored result is always 1-3. */
export function percentToScore(pct: number, bands: Bands): 1 | 2 | 3 {
  const p = Math.round(pct)
  if (p <= bands.s1Max) return 1
  if (p <= bands.s2Max) return 2
  return 3
}

export function scaleSummary(scale: Scale): string {
  if (scale.type === 'binary') return `${scale.yesLabel} / ${scale.noLabel} (1 / 0)`
  if (scale.type === 'likert') return `${scale.points}-point Likert`
  return `Percentage, ${scale.step}% steps`
}
