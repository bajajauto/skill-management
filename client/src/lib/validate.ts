import type { AppState, AdminSection } from '../types'

export interface Issue {
  id: string
  severity: 'error' | 'warning'
  area: AdminSection
  message: string
}

export function validate(state: AppState): Issue[] {
  const { config, nodes, questions } = state
  const issues: Issue[] = []
  const add = (severity: Issue['severity'], area: AdminSection, id: string, message: string) =>
    issues.push({ id, severity, area, message })

  // Framework
  if (!config.organization) add('error', 'framework', 'no-organization', 'Select the organization this assessment applies to.')
  if (!config.businessUnit?.trim()) add('error', 'framework', 'no-business-unit', 'Enter the business unit this assessment applies to.')
  if (config.levels.length === 0) add('error', 'framework', 'no-levels', 'Define at least one proficiency level.')
  const levelNames = config.levels.map((l) => l.name.trim().toLowerCase())
  if (levelNames.some((n) => !n)) add('error', 'framework', 'blank-level', 'A proficiency level has no name.')
  if (new Set(levelNames).size !== levelNames.length) add('error', 'framework', 'dup-level', 'Proficiency level names must be unique.')
  if (config.scale.type === 'likert' && config.scale.labels.some((l) => !l.trim()))
    add('error', 'framework', 'likert-labels', 'Every Likert point needs a label.')

  // Skill library
  const skills = nodes.filter((n) => n.type === 'skill')
  const tasks = nodes.filter((n) => n.type === 'task')
  const subskills = nodes.filter((n) => n.type === 'subskill')
  if (!skills.length) add('error', 'skills', 'no-skills', `Add at least one ${config.labels.skill.toLowerCase()}.`)
  if (config.structure === 'skill-subskill' && skills.length && !subskills.length)
    add('error', 'skills', 'no-subskills', `Add ${config.labels.subskill.toLowerCase()}s under your skills.`)
  if (config.structure !== 'skill-subskill' && skills.length && !tasks.length)
    add('error', 'skills', 'no-tasks', `Add ${config.labels.task.toLowerCase()}s under your skills.`)

  const children = new Map<string, number>()
  for (const n of nodes) if (n.parentId) children.set(n.parentId, (children.get(n.parentId) ?? 0) + 1)
  for (const n of nodes) {
    if (n.type !== config.ratedAt && !children.get(n.id))
      add('warning', 'skills', `empty-${n.id}`, `${config.labels[n.type]} "${n.name}" has no ${config.labels[n.type === 'skill' ? (config.structure === 'skill-task' ? 'task' : 'subskill') : 'task'].toLowerCase()}s.`)
  }
  const rated = nodes.filter((n) => n.type === config.ratedAt)
  const unlevelled = rated.filter((n) => !n.levelId)
  if (unlevelled.length)
    add('error', 'skills', 'no-level', `${unlevelled.length} ${config.labels[config.ratedAt].toLowerCase()}${unlevelled.length > 1 ? 's have' : ' has'} no proficiency level.`)

  // Question bank
  const live = questions.filter((q) => q.active)
  const orphans = live.filter((q) => !q.skillId || !q.levelId)
  if (orphans.length) add('error', 'questions', 'orphans', `${orphans.length} active question${orphans.length > 1 ? 's are' : ' is'} not mapped to a skill and level.`)
  const noKey = live.filter((q) => !q.correct || !q.options[['A', 'B', 'C', 'D'].indexOf(q.correct)]?.trim())
  if (noKey.length) add('error', 'questions', 'no-key', `${noKey.length} active question${noKey.length > 1 ? 's have' : ' has'} a missing or invalid correct answer.`)
  const levelsWithTasks = new Set(rated.map((n) => n.levelId).filter(Boolean))
  for (const s of skills) {
    const covered = new Set(live.filter((q) => q.skillId === s.id).map((q) => q.levelId))
    for (const lvl of config.levels) {
      const hasContent = nodes.some((n) => n.type === config.ratedAt && n.levelId === lvl.id && rootOf(n.id, nodes) === s.id)
      if (hasContent && levelsWithTasks.has(lvl.id) && !covered.has(lvl.id))
        add('warning', 'questions', `cov-${s.id}-${lvl.id}`, `"${s.name}" at ${lvl.name} has no objective-test questions.`)
    }
  }

  // Scoring
  const { manager, test, weights } = config.scoring
  for (const [label, b] of [['Manager', manager], ['Test', test]] as const)
    if (!(b.s1Max >= 0 && b.s1Max < b.s2Max && b.s2Max < 100))
      add('error', 'scoring', `bands-${label}`, `${label} score bands must increase and stay below 100%.`)
  if (Object.values(weights).some((w) => !(w > 0))) add('error', 'scoring', 'weights', 'Difficulty weights must be greater than zero.')
  if (config.scoring.progressionMin < config.scoring.courseTriggerBelow - 1)
    add('warning', 'scoring', 'thr', 'Progression minimum is far below the gap trigger, so clusters could progress while flagged as gaps.')

  return issues
}

export function rootOf(id: string, nodes: AppState['nodes']): string {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let cur = byId.get(id)
  while (cur?.parentId) cur = byId.get(cur.parentId)
  return cur?.id ?? id
}

