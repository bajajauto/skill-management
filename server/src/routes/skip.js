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

/**
 * The skip manager sees a person's scores once the manager has evaluated every skill, or once the evaluation deadline
 * has passed, so a manager who ran out of time doesn't leave the person out of calibration. Skills the manager never
 * evaluated simply have nothing to calibrate.
 */
const progressOf = (snap) => {
  const clusters = snap.published ? snap.clusters : []
  const done = clusters.filter((c) => c.manager.status === 'calibrated').length
  const complete = clusters.length > 0 && done === clusters.length
  return { managerDone: done, managerTotal: clusters.length, ready: complete || (clusters.length > 0 && !snap.evaluation.open) }
}

/** The same snapshot with the manager's answers and scores taken out, for a person the manager hasn't finished. */
const withheld = (snap) => ({
  ...snap,
  evaluationLocked: false,
  clusters: snap.clusters.map((c) => ({
    ...c,
    tasks: c.tasks.map((t) => ({ ...t, managerAnswer: null, managerOriginal: null })),
    manager: { pct: null, yes: 0, applicable: 0, original: 0, calibrated: 0, reason: null, status: 'pending', comment: '', calibration: null },
    validation: { status: 'none', answers: {}, comment: '', at: null },
  })),
})

const forSkip = async (id) => {
  const snap = await buildSnapshot(id)
  const p = progressOf(snap)
  // Only whether they are ready goes out, not how far the manager has got.
  return { id, snapshot: p.ready || !snap.published ? snap : withheld(snap), ready: p.ready }
}

// Everyone one level down. A person's scores appear here only once their manager has evaluated all their skills.
skipRouter.get('/', async (req, res) => {
  res.json({ members: await Promise.all(req.reports.map(forSkip)) })
})

skipRouter.get('/:empId', async (req, res) => {
  res.json(await forSkip(reportOf(req, req.params.empId)))
})

// The skip manager rates the same tasks as the manager, Yes / No / N/A, and the skill score follows from those answers.
// Where they agree they can say so; tasks they leave alone keep the manager's answer.
// Body: { agreeAll?: true, skills?: { [skillId]: { answers: { [taskId]: 'yes' | 'no' | 'na' }, taskReasons: { [taskId]: reason }, reason } | null } }
// Every task answer changed from the manager's needs its own reason (`taskReasons`). `reason` is a comment on a skill the manager left out.
// null takes a calibration back, so the manager's own answers flow through again.
skipRouter.put('/:empId/calibration', async (req, res) => {
  const empId = reportOf(req, req.params.empId)
  const snap = await buildSnapshot(empId)
  if (!snap.published) throw fail(409, 'The framework is not published yet.')
  const progress = progressOf(snap)
  if (!progress.ready) throw fail(409, 'Awaiting manager evaluation.')
  // The deadline is the one set in this person's cohort.
  if (!snap.calibration.open) throw fail(409, `Calibration closed on ${snap.calibration.deadline}. The manager's scores now stand.`)
  const cals = await loadCalibrations(empId)
  const at = new Date().toISOString()
  const taskIdsOf = (c) => c.tasks.map((t) => t.id)
  const managersOf = (c) => Object.fromEntries(c.tasks.map((t) => [t.id, t.managerOriginal]))
  const record = (c, answers, reason, taskReasons = {}) => {
    const managers = managersOf(c)
    const same = taskIdsOf(c).every((id) => answers[id] === managers[id])
    cals[c.id] = { answers, reason: same ? '' : reason, taskReasons: same ? {} : taskReasons, by: req.userId, byName: req.me.name, at, basedOn: calSignature(taskIdsOf(c), managers) }
  }
  const evaluated = snap.clusters.filter((c) => c.manager.status === 'calibrated')

  if (req.body?.agreeAll === true) {
    for (const c of evaluated) if (cals[c.id]?.basedOn !== calSignature(taskIdsOf(c), managersOf(c))) record(c, managersOf(c), '')
  }
  for (const [skillId, entry] of Object.entries(req.body?.skills ?? {})) {
    const c = snap.clusters.find((x) => x.id === skillId)
    if (!c) throw fail(400, 'Unknown skill.')
    // A skill the manager never evaluated can be rated by the skip manager once evaluations have closed.
    const unrated = c.tasks.every((t) => t.managerOriginal == null)
    if (c.manager.status !== 'calibrated' && !(unrated && !snap.evaluation.open)) throw fail(400, `${c.name}: the manager has not evaluated this skill yet.`)
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
    let reason = String(entry.reason ?? '').trim().slice(0, 1000)
    const changedIds = taskIdsOf(c).filter((id) => answers[id] !== managers[id])
    const taskReasons = {}
    if (!unrated) {
      // Changing a manager's answer needs a reason on that task.
      for (const id of changedIds) {
        const why = String(entry.taskReasons?.[id] ?? '').trim().slice(0, 1000)
        if (!why) throw fail(400, `${c.name}: say why you are changing "${c.tasks.find((t) => t.id === id).name}".`)
        taskReasons[id] = why
      }
      // A short summary of those reasons for the manager to read.
      reason = changedIds.map((id) => `${c.tasks.find((t) => t.id === id).name}: ${taskReasons[id]}`).join('; ')
    }
    record(c, answers, reason, taskReasons)
  }
  await saveCalibrations(empId, cals)
  res.json({ snapshot: await buildSnapshot(empId) })
})
