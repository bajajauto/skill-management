export type NodeType = 'skill' | 'subskill' | 'task'
export type StructureKey = 'skill-subskill-task' | 'skill-subskill' | 'skill-task'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Level {
  id: string
  name: string
}

export type Scale =
  | { type: 'binary'; yesLabel: string; noLabel: string; allowNA: boolean }
  | { type: 'likert'; points: number; labels: string[]; startAtZero: boolean }
  | { type: 'percentage'; step: number }

export interface SkillNode {
  id: string
  type: NodeType
  parentId: string | null
  name: string
  description: string
  levelId: string | null
  critical: boolean
}

export interface Question {
  id: string
  text: string
  options: [string, string, string, string]
  correct: 'A' | 'B' | 'C' | 'D' | ''
  explanation: string
  difficulty: Difficulty
  topic: string
  skillId: string | null
  levelId: string | null
  active: boolean
}

/** Percent bands that convert to a 0-3 score. 0 is reserved for "not assessed". */
export interface Bands {
  s1Max: number
  s2Max: number
}

export interface ScoringConfig {
  manager: Bands
  test: Bands
  courseTriggerBelow: 1 | 2 | 3
  progressionMin: 1 | 2 | 3
  weights: Record<Difficulty, number>
  missingInput: 'incomplete' | 'treat-as-zero'
}

export const ORGANIZATIONS = ['BAL', 'BACL', 'BATL', 'BAF'] as const
export type Organization = (typeof ORGANIZATIONS)[number]

/** Which setup steps the TD admin has signed off, either by accepting the defaults or by editing them. */
export interface Reviewed {
  framework: boolean
  scoring: boolean
}

export interface Config {
  reviewed: Reviewed
  organization: Organization | ''
  businessUnit: string
  structure: StructureKey
  ratedAt: NodeType
  labels: Record<NodeType, string>
  levels: Level[]
  scale: Scale
  evidence: 'never' | 'on-negative' | 'always'
  scoring: ScoringConfig
}

export interface Publication {
  version: number
  at: string
}

export interface AppState {
  config: Config
  nodes: SkillNode[]
  questions: Question[]
  publication: Publication | null
  dirtySincePublish: boolean
}

export type AdminSection = 'overview' | 'framework' | 'skills' | 'questions' | 'scoring' | 'publish'


export type CohortStatus = 'draft' | 'live' | 'completed'

export interface CohortSummary {
  id: string
  status: CohortStatus
  closedAt: string | null
  organization: string
  businessUnit: string
  version: number | null
  publishedAt: string | null
  dirty: boolean
  skills: number
  tasks: number
  questions: number
  updatedAt: string
}
