import { CYCLE, EMPLOYEES, buPeopleIds, profileOf } from './demoEmployee.js'
import { buildSnapshot } from './employeeData.js'
import { publishedFor } from './cohorts.js'

/** Gap and progression use the calibrated manager score and the test score only. Self-rating never counts. */
export function clusterStatusOf(c, s) {
  const fill = (v) => v ?? (s.missingInput === 'treat-as-zero' ? 0 : null)
  const m = fill(c.manager.status === 'pending' ? null : c.manager.calibrated)
  const t = fill(c.test.latest?.score ?? null)
  if (m == null || t == null) return 'incomplete'
  if (m < s.courseTriggerBelow || t < s.courseTriggerBelow) return 'gap'
  if (m >= s.progressionMin && t >= s.progressionMin) return 'cleared'
  return 'open'
}

const PROFILE_FIELDS = ['employeeId', 'name', 'email', 'designation', 'jobProfile', 'function', 'location', 'manager', 'skipManager', 'joined', 'jobLevel', 'exception']

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

/** Everything the BUHR view needs about the business unit the viewer belongs to. */
export async function buildTracking(buhrId, reminders) {
  const viewer = EMPLOYEES[buhrId]
  const scope = { organization: viewer.organization, businessUnit: viewer.businessUnit }
  const base = { scope, cycle: CYCLE, reminders }
  const fw = await publishedFor(viewer)
  if (!fw) return { ...base, published: false }

  const ids = buPeopleIds(viewer.organization, viewer.businessUnit)
  const snaps = await Promise.all(ids.map((id) => buildSnapshot(id, { fw })))
  const people = snaps.map((s, i) => compact(ids[i], s)).filter((p) => p.clusters.length > 0 || true)

  // Skills are the same for everyone at the same level; take the union in first-seen order.
  const seen = new Map()
  snaps.forEach((s) => s.clusters.forEach((c) => !seen.has(c.id) && seen.set(c.id, { id: c.id, name: c.name, critical: c.critical })))

  const first = snaps[0]
  return {
    ...base,
    published: true,
    version: fw.version,
    labels: first.labels,
    levels: first.levels,
    skills: [...seen.values()],
    people,
  }
}

export const personInBu = (buhrId, empId) => {
  const v = EMPLOYEES[buhrId]
  const p = profileOf(empId)
  return Boolean(v && p && p.organization === v.organization && String(p.businessUnit).toLowerCase() === String(v.businessUnit).toLowerCase())
}
