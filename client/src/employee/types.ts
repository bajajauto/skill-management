import type { EvidenceRule } from '../types'
export interface Bands {
  s1Max: number
  s2Max: number
}

export interface MeEmployee {
  employeeId: string
  name: string
  email: string
  jobLevel: string
  buHead: string
  buhr: string
  designation: string
  jobProfile: string
  businessUnit: string
  function: string
  location: string
  joined: string
  manager: string
  skipManager: string
}

export interface Cycle {
  id: string
  name: string
  opens?: string
  due?: string
  closed?: string
}

export type TaskAnswer = 'yes' | 'no' | 'na'

export interface ClusterTask {
  id: string
  name: string
  description: string
  group: string | null
  managerAnswer: 'yes' | 'no' | 'na' | null
}

export interface TestAttempt {
  id: string
  skillId: string
  status: 'in-progress' | 'submitted'
  submittedAt: string | null
  pct: number | null
  score: 1 | 2 | 3 | null
  correct: number | null
  /** Weighted points earned and available, when known. */
  earned: number | null
  possible: number | null
  total: number
  /** Times the person left the test or tried to capture it. */
  violations: number
  autoSubmitted: boolean
}

export interface Cluster {
  id: string
  name: string
  description: string
  critical: boolean
  tasks: ClusterTask[]
  self: { rating: number; comment: string } | null
  manager: {
    pct: number | null
    yes: number
    applicable: number
    original: number
    calibrated: number
    reason: string | null
    status: 'pending' | 'calibrated'
    comment: string
  }
  validation: { status: 'none' | 'draft' | 'submitted'; answers: Record<string, TaskAnswer>; comment: string; at: string | null }
  /** This skill's section of the objective test. */
  test: {
    questionCount: number
    latest: TestAttempt | null
  }
  previous: { managerPct: number | null; testPct: number | null }
}

export interface Reflection {
  proud: string
  focus: string
  support: string
  savedAt: string | null
}

export type MeSnapshot =
  | { published: false; employee: MeEmployee; cycle: Cycle; previousCycle: Cycle }
  | {
      published: true
      employee: MeEmployee
      cycle: Cycle
      previousCycle: Cycle
      version: number
      labels: { skill: string; subskill: string; task: string }
      levels: { id: string; name: string }[]
      currentLevelId: string
      evidence: EvidenceRule
      scale: { type: string; yesLabel?: string; noLabel?: string; allowNA?: boolean }
      scoring: { manager: Bands; test: Bands; courseTriggerBelow: number; progressionMin: number; missingInput: 'incomplete' | 'treat-as-zero' }
      self: { submittedAt: string | null }
      clusters: Cluster[]
      test: ObjectiveTest
      reflection: Reflection
    }

export type PublishedMe = Extract<MeSnapshot, { published: true }>

/** The objective test as one module with a section per skill. */
export interface ObjectiveTest {
  questionCount: number
  /** Questions the test will have: up to ten from each skill that has any. */
  testLength: number
  skills: { id: string; name: string; count: number }[]
  attemptsLeft: number
  latest: TestAttempt | null
  inProgressId: string | null
}

export interface TestStart {
  attemptId: string
  maxViolations: number
  violations: number
  /** Sections in order, one per skill. Questions come grouped by section. */
  sections: { id: string; name: string; count: number }[]
  questions: { id: string; skillId: string; text: string; options: string[] }[]
}

export interface ReviewItem {
  id: string
  skillId: string
  skill: string
  text: string
  options: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  chosen: string | null
  correct: string
  isCorrect: boolean
  explanation: string
}

/** One section's result. */
export interface SectionResult {
  skillId: string
  name: string
  pct: number | null
  score: 1 | 2 | 3 | null
  correct: number | null
  earned: number | null
  possible: number | null
  total: number
}

export interface TestResult {
  attempt: TestAttempt
  review: ReviewItem[]
  breakdown: SectionResult[]
}

export interface TeamMember {
  id: string
  remindedAt: string | null
  snapshot: MeSnapshot
}
