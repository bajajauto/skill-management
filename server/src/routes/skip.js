import { Router } from 'express'
import { EMPLOYEES, skipReportIds } from '../lib/demoEmployee.js'
import { buildSnapshot, calSignature, loadCalibrations, saveCalibrations } from '../lib/employeeData.js'

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

// The skip manager rates the same tasks as the manager, Yes / No / N/A, and the skill score follows from those answers.
// Where they agree they can say so; tasks they leave alone keep the manager's answer.
// Body: { agreeAll?: true, skills?: { [skillId]: { answers: { [taskId]: 'yes' | 'no' | 'na' }, reason } | null } }
// null takes a calibration back, so the manager's own answers flow through again.
skipRouter.put('/:empId/calibration', async (req, res) => {
  const empId = reportOf(req, req.params.empId)
  const snap = await buildSnapshot(empId)
  if (!snap.published) throw fail(409, 'The framework is not published yet.')
  // The deadline is the one set in this person's cohort.
  if (!snap.calibration.open) throw fail(409, `Calibration closed on ${snap.calibration.deadline}. The manager's scores now stand.`)
  const cals = await loadCalibrations(empId)
  const at = new Date().toISOString()
  const taskIdsOf = (c) => c.tasks.map((t) => t.id)
  const managersOf = (c) => Object.fromEntries(c.tasks.map((t) => [t.id, t.managerOriginal]))
  const record = (c, answers, reason) => {
    const managers = managersOf(c)
    const same = taskIdsOf(c).every((id) => answers[id] === managers[id])
    cals[c.id] = { answers, reason: same ? '' : reason, by: req.userId, byName: req.me.name, at, basedOn: calSignature(taskIdsOf(c), managers) }
  }
  const evaluated = snap.clusters.filter((c) => c.manager.status === 'calibrated')

  if (req.body?.agreeAll === true) {
    for (const c of evaluated) if (cals[c.id]?.basedOn !== calSignature(taskIdsOf(c), managersOf(c))) record(c, managersOf(c), '')
  }
  for (const [skillId, entry] of Object.entries(req.body?.skills ?? {})) {
    const c = snap.clusters.find((x) => x.id === skillId)
    if (!c) throw fail(400, 'Unknown skill.')
    if (c.manager.status !== 'calibrated') throw fail(400, `${c.name}: the manager has not evaluated this skill yet.`)
    if (entry == null) {
      delete cals[c.id]
      continue
    }
    const managers = managersOf(c)
    const answers = {}
    for (const id of taskIdsOf(c)) {
      const a = entry.answers?.[id] ?? managers[id]
      if (!['yes', 'no', 'na'].includes(a)) throw fail(400, `${c.name}: each task must be Yes, No or Not applicable.`)
      answers[id] = a
    }
    for (const id of Object.keys(entry.answers ?? {})) if (!(id in answers)) throw fail(400, `${c.name}: unknown task.`)
    if (!Object.values(answers).some((a) => a === 'yes' || a === 'no')) throw fail(400, `${c.name}: at least one task must apply.`)
    const reason = String(entry.reason ?? '').trim().slice(0, 1000)
    const changed = taskIdsOf(c).some((id) => answers[id] !== managers[id])
    if (changed && !reason) throw fail(400, `${c.name}: say why you are changing the manager's answers.`)
    record(c, answers, reason)
  }
  await saveCalibrations(empId, cals)
  res.json({ snapshot: await buildSnapshot(empId) })
})
