import type { AdminSection, AppState } from '../types'
import { validate } from './validate'

export type SetupArea = Extract<AdminSection, 'framework' | 'skills' | 'questions' | 'scoring'>
export const SETUP_AREAS: SetupArea[] = ['framework', 'skills', 'questions', 'scoring']

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
