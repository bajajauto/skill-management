import { Router } from 'express'
import { readDoc, writeDoc } from '../storage.js'
import { BUHRS } from '../lib/demoEmployee.js'
import { buildSnapshot } from '../lib/employeeData.js'
import { buildTracking, personInBu } from '../lib/buTracking.js'

export const buhrRouter = Router()

const fail = (status, message) => Object.assign(new Error(message), { status, expose: true })

// Demo identity: the client sends the signed-in user's id. Real auth must replace this.
buhrRouter.use((req, _res, next) => {
  const id = req.get('x-user-id')
  if (!id || !BUHRS.includes(id)) return next(fail(403, 'You do not have the BUHR view.'))
  req.userId = id
  next()
})

const reminderDoc = (id) => `reminders/${id}`

// Whole-business-unit tracking, one compact row per person.
buhrRouter.get('/tracking', async (req, res) => {
  res.json(await buildTracking(req.userId, (await readDoc(reminderDoc(req.userId))) ?? {}))
})

// Full detail for one person in the business unit (read-only).
buhrRouter.get('/people/:empId', async (req, res) => {
  if (!personInBu(req.userId, req.params.empId)) throw fail(404, 'That person is not in your business unit.')
  res.json({ snapshot: await buildSnapshot(req.params.empId) })
})

// Demo: records that a reminder was sent to people and/or to managers about their team's pending validations.
// Delivery (email / in-app) is part of the notifications work.
buhrRouter.post('/remind', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : []
  const managers = Array.isArray(req.body?.managers) ? req.body.managers.filter((x) => typeof x === 'string') : []
  if (!ids.length && !managers.length) throw fail(400, 'Choose who to remind.')
  for (const id of ids) if (!personInBu(req.userId, id)) throw fail(404, 'That person is not in your business unit.')
  const reminders = (await readDoc(reminderDoc(req.userId))) ?? {}
  const at = new Date().toISOString()
  for (const id of ids) reminders[id] = at
  for (const m of managers) reminders[`mgr:${m}`] = at
  await writeDoc(reminderDoc(req.userId), reminders)
  res.json({ remindedAt: at, count: ids.length + managers.length })
})
