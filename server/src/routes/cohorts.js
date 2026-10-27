import { Router } from 'express'
import { completeCohort, createCohort, deleteCohort, editorState, listCohorts, loadCohort, publishCohort, reopenCohort, saveCohort, summarize, validateDraft } from '../lib/cohorts.js'

export const cohortsRouter = Router()

const fail = (status, message) => Object.assign(new Error(message), { status, expose: true })

// Demo identity: only TD admins manage cohorts. Real authorisation must replace this.
cohortsRouter.use((req, _res, next) => {
  if (req.get('x-user-id') !== 'u4') return next(fail(403, 'Only TD admins can manage cohorts.'))
  next()
})

const load = async (id) => {
  const c = await loadCohort(id)
  if (!c) throw fail(404, 'Cohort not found.')
  return c
}

cohortsRouter.get('/', async (_req, res) => res.json({ cohorts: (await listCohorts()).map(summarize) }))

cohortsRouter.post('/', async (req, res) => {
  const c = await createCohort(req.body ?? {})
  res.status(201).json({ cohort: summarize(c) })
})

cohortsRouter.get('/:id', async (req, res) => res.json({ state: editorState(await load(req.params.id)) }))

cohortsRouter.put('/:id', async (req, res) => {
  const c = await load(req.params.id)
  validateDraft(req.body)
  c.draft = { config: req.body.config, nodes: req.body.nodes, questions: req.body.questions }
  await saveCohort(c)
  res.json({ ok: true, savedAt: c.updatedAt })
})

cohortsRouter.post('/:id/publish', async (req, res) => {
  await load(req.params.id)
  const c = await publishCohort(req.params.id)
  res.json({ state: editorState(c), cohort: summarize(c) })
})

cohortsRouter.post('/:id/complete', async (req, res) => res.json({ cohort: summarize(await completeCohort(req.params.id)) }))

cohortsRouter.post('/:id/reopen', async (req, res) => res.json({ cohort: summarize(await reopenCohort(req.params.id)) }))

cohortsRouter.delete('/:id', async (req, res) => {
  await deleteCohort(req.params.id)
  res.json({ ok: true })
})
