import type { AdminSection, AppState } from '../types'
import { validate } from './validate'

export type SetupArea = Extract<AdminSection, 'framework' | 'skills' | 'questions' | 'scoring'>
export const SETUP_AREAS: SetupArea[] = ['framework', 'skills', 'questions', 'scoring']

const STEP_NAME: Record<SetupArea, string> = { framework: 'Framework', skills: 'Skills', questions: 'Questions', scoring: 'Scoring' }

/**
 * Setup is a process: a step opens once every step before it is finished. A cohort that has already been published
 * is being edited rather than set up, so all of its steps stay open. Maps a locked step to the step to finish first.
 */
export function lockedSteps(state: AppState): Partial<Record<AdminSection, { first: SetupArea; message: string }>> {
  if (state.publication) return {}
  const { done } = setupProgress(state)
  const first = SETUP_AREAS.find((a) => !done[a])
  if (!first) return {}
  const out: Partial<Record<AdminSection, { first: SetupArea; message: string }>> = {}
  const order: AdminSection[] = [...SETUP_AREAS, 'publish']
  for (const s of order.slice(order.indexOf(first) + 1)) out[s] = { first, message: `Finish ${STEP_NAME[first]} first` }
  return out
}

/** Which setup areas are finished, i.e. have content and no blocking errors. */
export function setupProgress(state: AppState) {
  const issues = validate(state)
  const errors = (a: AdminSection) => issues.filter((i) => i.area === a && i.severity === 'error').length
  const hasSkills = state.nodes.some((n) => n.type === 'skill')
  const done: Record<SetupArea, boolean> = {
    // Framework and scoring start with valid defaults, so they only count once the admin has accepted or edited them.
    framework: state.config.reviewed.framework && errors('framework') === 0,
    skills: hasSkills && errors('skills') === 0,
    questions: state.questions.length > 0 && errors('questions') === 0,
    scoring: state.config.reviewed.scoring && errors('scoring') === 0,
  }
  const count = SETUP_AREAS.filter((a) => done[a]).length
  return { done, count, total: SETUP_AREAS.length, issues }
}
