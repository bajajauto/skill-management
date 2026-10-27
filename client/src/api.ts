import type { AppState, CohortSummary } from './types'
import type { BuPersonDetail, BuTracking } from './buhr/types'

import type { MeSnapshot, Reflection, TaskAnswer, TeamMember, TestResult, TestStart } from './employee/types'

// Demo identity header; real authentication must replace this.
let apiUser: string | null = null
export const setApiUser = (id: string | null) => {
  apiUser = id
}

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json', ...(apiUser ? { 'x-user-id': apiUser } : {}) }, ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return res
}

export interface User {
  id: string
  name: string
  initials: string
  role: 'employee' | 'manager' | 'buhr' | 'td-admin'
  roleLabel: string
  email: string
}
export type DemoUser = User & { password: string }

const json = async <T>(p: Promise<Response>) => (await p).json() as Promise<T>
const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

export const meApi = {
  get: () => json<MeSnapshot>(request('/me')),
  saveSelf: (ratings: Record<string, { rating: number; comment: string }>, submit: boolean) => json<MeSnapshot>(request('/me/self-assessment', send('PUT', { ratings, submit }))),
  startTest: (skillId: string) => json<TestStart>(request(`/me/tests/${skillId}/start`, send('POST'))),
  submitTest: (attemptId: string, answers: Record<string, string>) => json<TestResult>(request(`/me/tests/attempts/${attemptId}/submit`, send('POST', { answers }))),
  getAttempt: (attemptId: string) => json<TestResult>(request(`/me/tests/attempts/${attemptId}`)),
  saveReflection: (r: Omit<Reflection, 'savedAt'>) => json<Reflection>(request('/me/reflection', send('PUT', r))),
  reset: () => json<MeSnapshot>(request('/me/reset', send('POST'))),
}

export const teamApi = {
  list: () => json<{ members: TeamMember[] }>(request('/team')),
  saveValidation: (empId: string, skillId: string, answers: Record<string, TaskAnswer>, comment: string, submit: boolean) =>
    json<{ snapshot: MeSnapshot; score: number | null }>(request(`/team/${empId}/validation/${skillId}`, send('PUT', { answers, comment, submit }))),
  remind: (empId: string) => json<{ remindedAt: string }>(request(`/team/${empId}/remind`, send('POST'))),
}

export const buhrApi = {
  tracking: () => json<BuTracking>(request('/buhr/tracking')),
  person: (id: string) => json<BuPersonDetail>(request(`/buhr/people/${id}`)),
  remind: (ids: string[], managers: string[]) => json<{ remindedAt: string; count: number }>(request('/buhr/remind', send('POST', { ids, managers }))),
}

export const cohortApi = {
  list: () => json<{ cohorts: CohortSummary[] }>(request('/cohorts')).then((r) => r.cohorts),
  create: (organization: string, businessUnit: string) => json<{ cohort: CohortSummary }>(request('/cohorts', send('POST', { organization, businessUnit }))).then((r) => r.cohort),
  get: (id: string) => json<{ state: AppState }>(request(`/cohorts/${id}`)).then((r) => r.state),
  save: async (id: string, state: AppState) => {
    await request(`/cohorts/${id}`, send('PUT', { config: state.config, nodes: state.nodes, questions: state.questions }))
  },
  publish: (id: string) => json<{ state: AppState; cohort: CohortSummary }>(request(`/cohorts/${id}/publish`, send('POST'))),
  complete: (id: string) => json<{ cohort: CohortSummary }>(request(`/cohorts/${id}/complete`, send('POST'))).then((r) => r.cohort),
  reopen: (id: string) => json<{ cohort: CohortSummary }>(request(`/cohorts/${id}/reopen`, send('POST'))).then((r) => r.cohort),
  remove: async (id: string) => {
    await request(`/cohorts/${id}`, send('DELETE'))
  },
}

export const api = {
  async login(email: string, password: string): Promise<User> {
    return ((await (await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).json()) as { user: User }).user
  },
  async demoUsers(): Promise<DemoUser[]> {
    return (await request('/auth/demo')).json()
  },
}
