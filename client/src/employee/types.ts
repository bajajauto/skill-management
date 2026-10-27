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
  total: number
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
  test: {
    questionCount: number
    testLength: number
    attemptsLeft: number
    latest: TestAttempt | null
    inProgressId: string | null
  }
  previous: { managerPct: number | null; testPct: number }
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
      evidence: 'never' | 'on-negative' | 'always'
      scale: { type: string; yesLabel?: string; noLabel?: string; allowNA?: boolean }
      scoring: { manager: Bands; test: Bands; courseTriggerBelow: number; progressionMin: number; missingInput: 'incomplete' | 'treat-as-zero' }
      self: { submittedAt: string | null }
      clusters: Cluster[]
      reflection: Reflection
    }

export type PublishedMe = Extract<MeSnapshot, { published: true }>

export interface TestStart {
  attemptId: string
  skillId: string
  skillName: string
  questions: { id: string; text: string; options: string[] }[]
}

export interface ReviewItem {
  id: string
  text: string
  options: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  chosen: string | null
  correct: string
  isCorrect: boolean
  explanation: string
}

export interface TestResult {
  attempt: TestAttempt
  review: ReviewItem[]
}

export interface TeamMember {
  id: string
  remindedAt: string | null
  snapshot: MeSnapshot
}
