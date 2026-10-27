import { Router } from 'express'
import { readDoc, writeDoc } from '../storage.js'
import { TEAMS } from '../lib/demoEmployee.js'
import { buildSnapshot, clustersFor, getEmployeeFramework, loadValidations, managerFromAnswers, saveValidations } from '../lib/employeeData.js'
import { percentToScore } from '../lib/demoEmployee.js'

export const teamRouter = Router()

const fail = (status, message) => Object.assign(new Error(message), { status, expose: true })

// Demo identity: the client sends the signed-in user's id. Real auth must replace this.
teamRouter.use((req, _res, next) => {
  const id = req.get('x-user-id')
  if (!id || !TEAMS[id]) return next(fail(403, 'You do not manage a team.'))
  req.userId = id
  req.team = TEAMS[id]
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

/* ---------------------- Task-level manager validation ---------------------- */

teamRouter.put('/:empId/validation/:skillId', async (req, res) => {
  const empId = await member(req, req.params.empId)
  const fw = await getEmployeeFramework(empId)
  if (!fw) throw fail(409, 'The framework is not published yet.')
  const setup = fw.state
  const snap = await buildSnapshot(empId)
  const cluster = snap.clusters.find((c) => c.id === req.params.skillId)
  if (!cluster) throw fail(404, 'That skill is not part of this person\'s current level.')

  const taskIds = clustersFor(setup, snap.currentLevelId).find((c) => c.skill.id === cluster.id)?.tasks.map((t) => t.id) ?? []
  const incoming = req.body?.answers ?? {}
  const answers = {}
  for (const id of taskIds) {
    const a = incoming[id]
    if (a == null) continue
    if (!['yes', 'no', 'na'].includes(a)) throw fail(400, 'Each task must be Yes, No or Not applicable.')
    answers[id] = a
  }
  const comment = String(req.body?.comment ?? '').slice(0, 2000).trim()
  const submit = req.body?.submit === true

  if (submit) {
    if (taskIds.some((id) => !answers[id])) throw fail(400, 'Answer every task before submitting.')
    const result = managerFromAnswers(taskIds, answers, setup.config.scoring.manager)
    if (!result.applicable) throw fail(400, 'At least one task must apply.')
    const rule = setup.config.evidence
    if (rule === 'always' && !comment) throw fail(400, 'A comment is required.')
    if (rule === 'on-negative' && result.original === 1 && !comment) throw fail(400, 'A comment is required when the rating is in the lowest band.')
  }

  const all = await loadValidations(empId)
  all[cluster.id] = { status: submit ? 'submitted' : 'draft', answers, comment, at: new Date().toISOString(), by: req.userId }
  await saveValidations(empId, all)
  res.json({ snapshot: await buildSnapshot(empId), score: submit ? percentToScore(managerFromAnswers(taskIds, answers, setup.config.scoring.manager).pct ?? 0, setup.config.scoring.manager) : null })
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
