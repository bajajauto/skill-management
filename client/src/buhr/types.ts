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
    businessUnit: string
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

/** A BUHR can look after several business units within their organization. */
export interface BuScope {
  organization: string
  businessUnits: string[]
}

export type BuTracking =
  | { published: false; scope: BuScope; unpublished: string[]; cycle: Cycle; reminders: Record<string, string> }
  | {
      published: true
      scope: BuScope
      cycle: Cycle
      reminders: Record<string, string>
      /** Business units in scope that have no published framework yet, so their people can't be tracked. */
      unpublished: string[]
      /** The published framework version each business unit is on. */
      versions: { unit: string; version: number }[]
      labels: { skill: string; subskill: string; task: string }
      levels: { id: string; name: string }[]
      skills: { id: string; name: string; critical: boolean }[]
      people: BuPerson[]
    }

export type PublishedBu = Extract<BuTracking, { published: true }>

export interface BuPersonDetail {
  snapshot: MeSnapshot
}
