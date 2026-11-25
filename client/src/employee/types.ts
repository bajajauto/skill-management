import type { EvidenceRule } from '../types'
export interface Bands {
  s1Max: number
  s2Max: number
  s3Max: number
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

/**
 * Skip-level calibration runs until the deadline (a date, inclusive). While it is open an employee does not see their
 * manager's scores (`managerHidden`); afterwards every score is shown, calibrated or not.
 */
export interface CalibrationWindow {
  deadline: string
  open: boolean
  managerHidden: boolean
}

/** A last day (YYYY-MM-DD, inclusive) and whether it has not passed yet. */
export interface Deadline {
  deadline: string
  open: boolean
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
  /** The final answer for the task: the manager's, or the skip manager's where they changed it. */
  managerAnswer: 'yes' | 'no' | 'na' | null
  /** The manager's own answer. Only managers see this; an employee's view leaves it out. */
  managerOriginal?: 'yes' | 'no' | 'na' | null
}

export interface TestAttempt {
  id: string
  skillId: string
  status: 'in-progress' | 'submitted'
  submittedAt: string | null
  pct: number | null
  score: 1 | 2 | 3 | 4 | null
  correct: number | null
  /** Weighted points earned and available, when known. */
  earned: number | null
  possible: number | null
  total: number
  /** Times the person left the test or tried to capture it. */
  violations: number
  autoSubmitted: boolean
  /** Submitted by the clock running out. */
  timedOut: boolean
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
    /** The skip-level manager's review of this score, once they have made one. */
    calibration: { by: string; at: string; agreed: boolean; reason: string | null; taskReasons: Record<string, string>; changedTasks: number; managerYes: number; managerApplicable: number; ratedBySkip: boolean } | null
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
  | { published: false; employee: MeEmployee; cycle: Cycle; previousCycle: Cycle; calibration: CalibrationWindow; evaluation: Deadline }
  | {
      published: true
      employee: MeEmployee
      cycle: Cycle
      previousCycle: Cycle
      calibration: CalibrationWindow
      evaluation: Deadline
      /** True once the skip manager has given input: the manager's evaluation can no longer be changed. Managers only. */
      evaluationLocked?: boolean
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
  /** Questions the test will have: 20 shared across the skills that have any. */
  testLength: number
  /** Minutes allowed once it is started. */
  testMinutes: number
  skills: { id: string; name: string; count: number }[]
  attemptsLeft: number
  latest: TestAttempt | null
  inProgressId: string | null
}

export interface TestStart {
  attemptId: string
  /** Minutes allowed, and when time is up and what the server's clock said, so the countdown matches the server's. */
  minutes: number
  deadline: string
  serverNow: string
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
