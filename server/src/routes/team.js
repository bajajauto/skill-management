import { Router } from 'express'
import { readDoc, writeDoc } from '../storage.js'
import { TEAMS } from '../lib/demoEmployee.js'
import { realTeam } from '../lib/realData.js'
import { buildSnapshot, clustersFor, getEmployeeFramework, managerFromAnswers, saveValidations } from '../lib/employeeData.js'
import { commentRequired, describeEvidence, normalizeEvidence } from '../lib/evidence.js'

export const teamRouter = Router()

const fail = (status, message) => Object.assign(new Error(message), { status, expose: true })

// Demo identity: the client sends the signed-in user's id. Real auth must replace this.
teamRouter.use((req, _res, next) => {
  const id = req.get('x-user-id')
  const team = id ? (TEAMS[id] ?? realTeam(id)) : null
  if (!team) return next(fail(403, 'You do not manage a team.'))
  req.userId = id
  req.team = team
  next()
})

const reminderDoc = (managerId) => `reminders/${managerId}`

async function member(req, empId) {
  if (!req.team.includes(empId)) throw fail(404, 'That person is not in your team.')
  return empId
}

// Team roster with everything needed for tracking. Answer keys are never part of a snapshot.
teamRouter.get('/', async (req, res) => {
  const reminders = (await readDoc(reminderDoc(req.userId))) ?? {}
  const members = await Promise.all(req.team.map(async (id) => ({ id, remindedAt: reminders[id] ?? null, snapshot: await buildSnapshot(id) })))
  res.json({ members })
})

teamRouter.get('/:empId', async (req, res) => {
  const id = await member(req, req.params.empId)
  const reminders = (await readDoc(reminderDoc(req.userId))) ?? {}
  res.json({ id, remindedAt: reminders[id] ?? null, snapshot: await buildSnapshot(id) })
})

/* ------------------------- Manager evaluation ------------------------- */

// One evaluation per employee. It holds a section for every skill at their level, each with its own tasks, and each
// section is scored on its own, exactly as the separate per-skill evaluations were. Submitting needs every section
// complete; a draft can be saved at any point.
teamRouter.put('/:empId/evaluation', async (req, res) => {
  const empId = await member(req, req.params.empId)
  const fw = await getEmployeeFramework(empId)
  if (!fw) throw fail(409, 'The framework is not published yet.')
  const setup = fw.state
  const snap = await buildSnapshot(empId)
  if (!snap.clusters.length) throw fail(409, 'There are no skills to evaluate at this person\'s level.')

  const sections = clustersFor(setup, snap.currentLevelId, snap.employee.jobProfile).map(({ skill, tasks }) => ({ id: skill.id, name: skill.name, taskIds: tasks.map((t) => t.id) }))
  const incoming = req.body?.answers ?? {}
  const comments = req.body?.comments ?? {}
  const submit = req.body?.submit === true
  const rule = normalizeEvidence(setup.config.evidence)
  const at = new Date().toISOString()

  const records = {}
  for (const sec of sections) {
    const answers = {}
    for (const id of sec.taskIds) {
      const a = incoming[id]
      if (a == null) continue
      if (!['yes', 'no', 'na'].includes(a)) throw fail(400, 'Each task must be Yes, No or Not applicable.')
      answers[id] = a
    }
    const comment = String(comments[sec.id] ?? '').slice(0, 2000).trim()

    if (submit) {
      if (sec.taskIds.some((id) => !answers[id])) throw fail(400, `${sec.name}: answer every task before submitting.`)
      const result = managerFromAnswers(sec.taskIds, answers, setup.config.scoring.manager)
      if (!result.applicable) throw fail(400, `${sec.name}: at least one task must apply.`)
      if (commentRequired(rule, result.original) && !comment) {
        throw fail(400, `${sec.name}: ${rule.always ? 'a comment is required.' : `a comment is ${describeEvidence(rule)}.`}`)
      }
    }
    if (submit || Object.keys(answers).length || comment) records[sec.id] = { status: submit ? 'submitted' : 'draft', answers, comment, at, by: req.userId }
  }

  // Replace this person's evaluation as a whole, so a draft can't leave stale sections behind.
  await saveValidations(empId, records)
  res.json({ snapshot: await buildSnapshot(empId) })
})
/* ------------------------------- Reminders ------------------------------- */

// Demo: records that a reminder was sent. Delivery (email / in-app) is part of the notifications work.
teamRouter.post('/:empId/remind', async (req, res) => {
  const empId = await member(req, req.params.empId)
  const reminders = (await readDoc(reminderDoc(req.userId))) ?? {}
  reminders[empId] = new Date().toISOString()
  await writeDoc(reminderDoc(req.userId), reminders)
  res.json({ remindedAt: reminders[empId] })
})
