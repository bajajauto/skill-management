import { BUHR_SCOPE, CYCLE, EMPLOYEES, profileOf, scopePeopleIds } from './demoEmployee.js'
import { buildSnapshot } from './employeeData.js'
import { publishedFor } from './cohorts.js'

/** Gap and progression use the calibrated manager score and the test score only. Self-rating never counts. */
export function clusterStatusOf(c, s) {
  const fill = (v) => v ?? (s.missingInput === 'treat-as-zero' ? 0 : null)
  const m = fill(c.manager.status === 'pending' ? null : c.manager.calibrated)
  const t = fill(c.test.latest?.score ?? null)
  if (m == null || t == null) return 'incomplete'
  // One bar: both scores reaching it clears the skill, and either one below it is a development gap.
  if (m >= s.progressionMin && t >= s.progressionMin) return 'cleared'
  return 'gap'
}

const PROFILE_FIELDS = ['employeeId', 'name', 'email', 'designation', 'jobProfile', 'function', 'businessUnit', 'location', 'manager', 'skipManager', 'joined', 'jobLevel', 'exception']
const norm = (s) => String(s ?? '').trim().toLowerCase()

/** The business units a BUHR looks after (within their own organization). */
export const unitsOf = (buhrId) => BUHR_SCOPE[buhrId] ?? [EMPLOYEES[buhrId].businessUnit]

/** One row per person, small enough to ship forty or four hundred of them to the browser. */
function compact(id, snap) {
  const employee = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, snap.employee[k] ?? null]))
  const clusters = snap.clusters.map((c) => ({
    id: c.id,
    status: clusterStatusOf(c, snap.scoring),
    self: c.self?.rating ?? null,
    manager: c.manager.status === 'pending' ? null : c.manager.calibrated,
    test: c.test.latest?.score ?? null,
    managerPct: c.manager.pct,
    testPct: c.test.latest?.pct ?? null,
    testable: c.test.questionCount > 0,
  }))
  const testable = clusters.filter((c) => c.testable).length || clusters.length
  return {
    id,
    employee,
    level: snap.levels.find((l) => l.id === snap.currentLevelId)?.name ?? '',
    self: snap.self.submittedAt ? 'submitted' : clusters.some((c) => c.self != null) ? 'draft' : 'none',
    selfCount: clusters.filter((c) => c.self != null).length,
    tests: { taken: clusters.filter((c) => c.test != null).length, total: testable },
    validation: { done: clusters.filter((c) => c.manager != null).length, total: clusters.length },
    clusters,
  }
}

/** Everything the BUHR view needs about the business units the viewer looks after. */
export async function buildTracking(buhrId, reminders) {
  const viewer = EMPLOYEES[buhrId]
  const units = unitsOf(buhrId)
  const scope = { organization: viewer.organization, businessUnits: units }
  const base = { scope, cycle: CYCLE, reminders }

  // Each business unit has its own published framework. A unit without one can't be tracked yet.
  const frameworks = new Map()
  const unpublished = []
  for (const unit of units) {
    const fw = await publishedFor({ organization: viewer.organization, businessUnit: unit })
    if (fw) frameworks.set(norm(unit), { unit, fw })
    else unpublished.push(unit)
  }
  if (!frameworks.size) return { ...base, published: false, unpublished }

  const ids = scopePeopleIds(viewer.organization, units).filter((id) => frameworks.has(norm(profileOf(id).businessUnit)))
  const snaps = await Promise.all(ids.map((id) => buildSnapshot(id, { fw: frameworks.get(norm(profileOf(id).businessUnit)).fw })))
  const people = snaps.map((s, i) => compact(ids[i], s))

  // Skills are the same wherever the same skill is used; take the union in first-seen order.
  const seen = new Map()
  snaps.forEach((s) => s.clusters.forEach((c) => !seen.has(c.id) && seen.set(c.id, { id: c.id, name: c.name, critical: c.critical })))

  const first = snaps[0]
  return {
    ...base,
    published: true,
    unpublished,
    versions: [...frameworks.values()].map(({ unit, fw }) => ({ unit, version: fw.version })),
    labels: first.labels,
    levels: first.levels,
    skills: [...seen.values()],
    people,
  }
}

/** Whether a person belongs to one of the business units this BUHR looks after. */
export const personInBu = (buhrId, empId) => {
  const v = EMPLOYEES[buhrId]
  const p = profileOf(empId)
  const units = new Set(unitsOf(buhrId).map(norm))
  return Boolean(v && p && p.organization === v.organization && units.has(norm(p.businessUnit)))
}
