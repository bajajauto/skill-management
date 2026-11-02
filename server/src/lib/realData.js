// Real people imported from an HRMS / results export (see scripts/import-real.mjs). Kept apart from the demo
// people on purpose: they live in their own document, with ids starting "r", and nothing here edits the mock data.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from '../storage.js'

function load() {
  try {
    return JSON.parse(readFileSync(path.join(DATA_DIR, 'real', 'people.json'), 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return { people: {} }
    throw e
  }
}

export const REAL = load()
const people = REAL.people ?? {}

export const isReal = (id) => Boolean(id) && Object.hasOwn(people, id)
export const realPerson = (id) => (isReal(id) ? people[id] : null)
export const realProfile = (id) => realPerson(id)?.profile ?? null
/** Direct reports of a real manager, or null when the person manages no one. */
export const realTeam = (id) => {
  const r = realPerson(id)?.reports
  return r?.length ? r : null
}

const initialsOf = (name) => String(name).split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export const realUser = (id) => {
  const p = realPerson(id)
  if (!p) return null
  const manager = Boolean(realTeam(id))
  return {
    id,
    name: p.profile.name,
    initials: initialsOf(p.profile.name),
    role: manager ? 'manager' : 'employee',
    roleLabel: manager ? 'Manager' : 'Employee',
    email: p.profile.email ?? '',
    detail: [p.profile.designation, p.profile.location].filter(Boolean).join(' · '),
  }
}

/** People matching a name or employee id, for the sign-in picker. */
export function searchReal(q, limit = 12) {
  const needle = String(q ?? '').trim().toLowerCase()
  if (!needle) return []
  return Object.keys(people)
    .filter((id) => `${people[id].profile.name} ${people[id].profile.employeeId}`.toLowerCase().includes(needle))
    .slice(0, limit)
    .map(realUser)
}
