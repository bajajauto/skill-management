import type { Cycle, MeSnapshot } from '../employee/types'
import type { ClusterStatus } from '../employee/logic'

export interface BuCluster {
  id: string
  status: ClusterStatus
  self: number | null
  manager: number | null
  test: number | null
  managerPct: number | null
  testPct: number | null
  testable: boolean
}

export interface BuPerson {
  id: string
  employee: {
    employeeId: string
    name: string
    email: string
    designation: string
    jobProfile: string
    function: string
    location: string
    manager: string
    skipManager: string
    joined: string
    jobLevel: string
    exception: string | null
  }
  level: string
  self: 'submitted' | 'draft' | 'none'
  selfCount: number
  tests: { taken: number; total: number }
  validation: { done: number; total: number }
  clusters: BuCluster[]
}

export type BuTracking =
  | { published: false; scope: { organization: string; businessUnit: string }; cycle: Cycle; reminders: Record<string, string> }
  | {
      published: true
      scope: { organization: string; businessUnit: string }
      cycle: Cycle
      reminders: Record<string, string>
      version: number
      labels: { skill: string; subskill: string; task: string }
      levels: { id: string; name: string }[]
      skills: { id: string; name: string; critical: boolean }[]
      people: BuPerson[]
    }

export type PublishedBu = Extract<BuTracking, { published: true }>

export interface BuPersonDetail {
  snapshot: MeSnapshot
}
