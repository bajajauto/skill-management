import type { AppState, Config, NodeType, Question, SkillNode } from '../types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const defaultConfig = (): Config => ({
  reviewed: { framework: false, scoring: false },
  organization: '',
  businessUnit: '',
  structure: 'skill-subskill-task',
  ratedAt: 'task',
  labels: { skill: 'Skill', subskill: 'Sub-skill', task: 'Task' },
  levels: [
    { id: 'lvl-basic', name: 'Basic' },
    { id: 'lvl-intermediate', name: 'Intermediate' },
    { id: 'lvl-advanced', name: 'Advanced' },
  ],
  scale: { type: 'binary', yesLabel: 'Yes', noLabel: 'No', allowNA: true },
  evidence: 'on-negative',
  scoring: {
    // 1 = 0-33%, 2 = 34-66%, 3 = 67-100% (architecture doc, rating scale)
    manager: { s1Max: 33, s2Max: 66 },
    // Placeholder from the FRD proficiency rubric: L1 up to 60, L2 61-85, L3 above 85
    test: { s1Max: 60, s2Max: 85 },
    courseTriggerBelow: 3,
    progressionMin: 3,
    weights: { easy: 1, medium: 1.5, hard: 2 },
    missingInput: 'incomplete',
  },
})

export const emptyState = (): AppState => ({
  config: defaultConfig(),
  nodes: [],
  questions: [],
  publication: null,
  dirtySincePublish: false,
})

export const nodeTypesFor = (structure: Config['structure']): NodeType[] =>
  structure === 'skill-subskill-task'
    ? ['skill', 'subskill', 'task']
    : structure === 'skill-subskill'
      ? ['skill', 'subskill']
      : ['skill', 'task']

export const childTypeOf = (type: NodeType, structure: Config['structure']): NodeType | null => {
  const chain = nodeTypesFor(structure)
  const i = chain.indexOf(type)
  return i >= 0 && i < chain.length - 1 ? chain[i + 1] : null
}

export function sampleState(): AppState {
  const base = emptyState()
  base.config.reviewed = { framework: true, scoring: true } // the example is a complete setup
  base.config.organization = 'BAL'
  base.config.businessUnit = 'Powertrain'
  const [basic, inter] = base.config.levels
  const mk = (
    id: string,
    type: NodeType,
    parentId: string | null,
    name: string,
    levelId: string | null = null,
    critical = false,
  ): SkillNode => ({ id, type, parentId, name, description: '', levelId, critical })

  const nodes: SkillNode[] = [
    mk('s1', 'skill', null, 'Machining Operations', null, true),
    mk('s1a', 'subskill', 's1', 'CNC Setup'),
    mk('t1', 'task', 's1a', 'Load and verify a work offset', basic.id),
    mk('t2', 'task', 's1a', 'Mount fixtures and check runout', basic.id),
    mk('t3', 'task', 's1a', 'Optimise tool path for cycle time', inter.id),
    mk('s1b', 'subskill', 's1', 'Quality Checks'),
    mk('t4', 'task', 's1b', 'Measure with vernier and micrometer', basic.id),
    mk('t5', 'task', 's1b', 'Interpret a GD&T callout', inter.id),
    mk('s2', 'skill', null, 'Stakeholder Communication'),
    mk('s2a', 'subskill', 's2', 'Escalation'),
    mk('t6', 'task', 's2a', 'Raise a blocker with the right owner', basic.id),
    mk('t7', 'task', 's2a', 'Write a concise status update', basic.id),
  ]
  const q = (
    text: string,
    skillId: string,
    levelId: string,
    difficulty: Question['difficulty'],
    correct: Question['correct'],
  ): Question => ({
    id: uid(),
    text,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correct,
    explanation: '',
    difficulty,
    topic: '',
    skillId,
    levelId,
    active: true,
  })
  const questions = [
    q('What does a work offset define on a CNC machine?', 's1', basic.id, 'easy', 'B'),
    q('Which fixture check best detects runout?', 's1', basic.id, 'medium', 'C'),
    q('Which change most reduces cycle time without hurting finish?', 's1', inter.id, 'hard', 'A'),
  ]
  return { ...base, nodes, questions, dirtySincePublish: true }
}
