import { Router } from 'express'
import { EMPLOYEES, skipReportIds } from '../lib/demoEmployee.js'
import { buildSnapshot, loadCalibrations, saveCalibrations } from '../lib/employeeData.js'

export const skipRouter = Router()

const fail = (status, message) => Object.assign(new Error(message), { status, expose: true })

// Demo identity: the client sends the signed-in user's id. Real auth must replace this.
// A skip-level manager is the person named as "skip manager" on other people's profiles.
skipRouter.use((req, _res, next) => {
  const id = req.get('x-user-id')
  const me = id ? EMPLOYEES[id] : null
  const reports = me ? skipReportIds(me.name).filter((r) => r !== id) : []
  if (!reports.length) return next(fail(403, 'You are not a skip-level manager.'))
  req.userId = id
  req.me = me
  req.reports = reports
  next()
})

const reportOf = (req, empId) => {
  if (!req.reports.includes(empId)) throw fail(404, 'That person is not in your skip-level group.')
  return empId
}

// Everyone one level down, with the manager's evaluation and any calibration already made.
skipRouter.get('/', async (req, res) => {
  const members = await Promise.all(req.reports.map(async (id) => ({ id, snapshot: await buildSnapshot(id) })))
  res.json({ members })
})

skipRouter.get('/:empId', async (req, res) => {
  const id = reportOf(req, req.params.empId)
  res.json({ id, snapshot: await buildSnapshot(id) })
})

// Per skill the skip manager either agrees with the manager's score or gives a different one with a reason.
// Skills left alone keep the manager's score. Body: { agreeAll?: true, skills?: { [skillId]: { score: 1-3 | null, reason } } }
skipRouter.put('/:empId/calibration', async (req, res) => {
  const empId = reportOf(req, req.params.empId)
  const snap = await buildSnapshot(empId)
  if (!snap.published) throw fail(409, 'The framework is not published yet.')
  // The deadline is the one set in this person's cohort.
  if (!snap.calibration.open) throw fail(409, `Calibration closed on ${snap.calibration.deadline}. The manager's scores now stand.`)
  const cals = await loadCalibrations(empId)
  const at = new Date().toISOString()
  const record = (c, score, reason) => {
    cals[c.id] = { score, reason: score === c.manager.original ? '' : reason, by: req.userId, byName: req.me.name, at, basedOn: c.manager.original }
  }
  const evaluated = snap.clusters.filter((c) => c.manager.status === 'calibrated')

  if (req.body?.agreeAll === true) {
    for (const c of evaluated) if (cals[c.id]?.basedOn !== c.manager.original) record(c, c.manager.original, '')
  }
  for (const [skillId, entry] of Object.entries(req.body?.skills ?? {})) {
    const c = snap.clusters.find((x) => x.id === skillId)
    if (!c) throw fail(400, 'Unknown skill.')
    if (c.manager.status !== 'calibrated') throw fail(400, `${c.name}: the manager has not evaluated this skill yet.`)
    // No score means "take my change back": the manager's score flows through again.
    if (entry?.score == null) {
      delete cals[c.id]
      continue
    }
    if (!Number.isInteger(entry.score) || entry.score < 1 || entry.score > 4) throw fail(400, 'Scores are whole numbers from 1 to 4.')
    const reason = String(entry.reason ?? '').trim().slice(0, 1000)
    if (entry.score !== c.manager.original && !reason) throw fail(400, `${c.name}: say why you are changing the manager's score.`)
    record(c, entry.score, reason)
  }
  await saveCalibrations(empId, cals)
  res.json({ snapshot: await buildSnapshot(empId) })
})
