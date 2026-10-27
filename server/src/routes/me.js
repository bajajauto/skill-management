import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { publishedVersion } from '../lib/cohorts.js'
import { CYCLE, EMPLOYEES, percentToScore } from '../lib/demoEmployee.js'
import { buildSeedEmployeeDoc } from '../lib/demoSetup.js'
import { TEST_LENGTH, blankDoc, buildSnapshot, getEmployeeFramework, loadDoc, publicAttempt, saveDoc } from '../lib/employeeData.js'

export const meRouter = Router()

const fail = (status, message) => Object.assign(new Error(message), { status, expose: true })

// Demo identity: the client sends the signed-in user's id. Real auth must replace this.
meRouter.use((req, _res, next) => {
  const id = req.get('x-user-id')
  if (!id || !EMPLOYEES[id]) return next(fail(404, 'No employee profile for this account.'))
  req.userId = id
  next()
})

function shuffle(a) {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

meRouter.get('/', async (req, res) => res.json(await buildSnapshot(req.userId)))

/* --------------------------- Self assessment --------------------------- */

meRouter.put('/self-assessment', async (req, res) => {
  const doc = await loadDoc(req.userId)
  if (doc.self.submittedAt) throw fail(409, 'Your self assessment is already submitted.')
  const snap = await buildSnapshot(req.userId)
  if (!snap.published) throw fail(409, 'The framework is not published yet.')
  const incoming = req.body?.ratings ?? {}
  const ratings = {}
  for (const c of snap.clusters) {
    const r = incoming[c.id]
    if (!r || r.rating == null) continue
    if (!Number.isInteger(r.rating) || r.rating < 0 || r.rating > 3) throw fail(400, 'Ratings must be whole numbers from 0 to 3.')
    ratings[c.id] = { rating: r.rating, comment: String(r.comment ?? '').slice(0, 1000) }
  }
  const submit = req.body?.submit === true
  if (submit && snap.clusters.some((c) => !ratings[c.id])) throw fail(400, 'Rate every skill before submitting.')
  doc.self = { ratings, submittedAt: submit ? new Date().toISOString() : null }
  await saveDoc(req.userId, doc)
  res.json(await buildSnapshot(req.userId))
})

/* ------------------------------ Objective tests ------------------------------ */

meRouter.post('/tests/:skillId/start', async (req, res) => {
  const fw = await getEmployeeFramework(req.userId)
  if (!fw) throw fail(409, 'The framework is not published yet.')
  const setup = fw.state
  const doc = await loadDoc(req.userId)
  const snap = await buildSnapshot(req.userId)
  const cluster = snap.clusters.find((c) => c.id === req.params.skillId)
  if (!cluster) throw fail(404, 'That skill is not part of your current level.')
  if (cluster.test.attemptsLeft === 0) throw fail(409, 'You have already taken this test this cycle.')

  const pool = setup.questions.filter((q) => q.active && q.skillId === cluster.id && q.levelId === snap.currentLevelId)
  if (!pool.length) throw fail(409, 'No questions are available for this test yet.')

  let attempt = doc.attempts.find((a) => a.id === cluster.test.inProgressId)
  if (!attempt) {
    attempt = {
      id: randomUUID(),
      skillId: cluster.id,
      levelId: snap.currentLevelId,
      cycleId: CYCLE.id,
      cohortId: fw.cohortId,
      version: fw.version,
      questionIds: shuffle(pool).slice(0, TEST_LENGTH).map((q) => q.id),
      startedAt: new Date().toISOString(),
      status: 'in-progress',
    }
    doc.attempts.push(attempt)
    await saveDoc(req.userId, doc)
  }
  const byId = new Map(pool.map((q) => [q.id, q]))
  res.json({
    attemptId: attempt.id,
    skillId: cluster.id,
    skillName: cluster.name,
    // Deliberately no answer key or explanation here.
    questions: attempt.questionIds.filter((id) => byId.has(id)).map((id) => ({ id, text: byId.get(id).text, options: byId.get(id).options })),
  })
})

/** The framework version an attempt was taken against, falling back to the person's current one. */
async function frameworkOf(userId, attempt) {
  const fw = (await publishedVersion(attempt.cohortId, attempt.version)) ?? (await getEmployeeFramework(userId))
  if (!fw) throw fail(409, 'The framework is not published yet.')
  return fw.state
}

function review(setup, attempt) {
  const byId = new Map(setup.questions.map((q) => [q.id, q]))
  return attempt.questionIds
    .filter((id) => byId.has(id))
    .map((id) => {
      const q = byId.get(id)
      const chosen = attempt.answers?.[id] ?? null
      return { id, text: q.text, options: q.options, difficulty: q.difficulty, chosen, correct: q.correct, isCorrect: chosen === q.correct, explanation: q.explanation }
    })
}

meRouter.post('/tests/attempts/:attemptId/submit', async (req, res) => {
  const doc = await loadDoc(req.userId)
  const attempt = doc.attempts.find((a) => a.id === req.params.attemptId)
  if (!attempt) throw fail(404, 'Attempt not found.')
  if (attempt.status === 'submitted') throw fail(409, 'This attempt was already submitted.')
  const setup = await frameworkOf(req.userId, attempt)

  const answers = req.body?.answers ?? {}
  const { weights, test: bands } = setup.config.scoring
  const qs = review(setup, { ...attempt, answers })
  const clean = {}
  for (const q of qs) if (['A', 'B', 'C', 'D'].includes(answers[q.id])) clean[q.id] = answers[q.id]
  let earned = 0
  let possible = 0
  let correct = 0
  for (const q of qs) {
    const w = weights[q.difficulty] ?? 1
    possible += w
    if (clean[q.id] === q.correct) {
      earned += w
      correct++
    }
  }
  const pct = possible ? (earned / possible) * 100 : 0
  Object.assign(attempt, { answers: clean, status: 'submitted', submittedAt: new Date().toISOString(), pct, score: percentToScore(pct, bands), correct })
  await saveDoc(req.userId, doc)
  res.json({ attempt: publicAttempt(attempt), review: review(setup, attempt) })
})

meRouter.get('/tests/attempts/:attemptId', async (req, res) => {
  const doc = await loadDoc(req.userId)
  const attempt = doc.attempts.find((a) => a.id === req.params.attemptId && a.status === 'submitted')
  if (!attempt) throw fail(404, 'Result not found.')
  res.json({ attempt: publicAttempt(attempt), review: review(await frameworkOf(req.userId, attempt), attempt) })
})

/* -------------------------------- Reflection -------------------------------- */

meRouter.put('/reflection', async (req, res) => {
  const doc = await loadDoc(req.userId)
  const text = (k) => String(req.body?.[k] ?? '').slice(0, 2000)
  doc.reflection = { proud: text('proud'), focus: text('focus'), support: text('support'), savedAt: new Date().toISOString() }
  await saveDoc(req.userId, doc)
  res.json(doc.reflection)
})

/** Demo helper: put this employee's self ratings, test attempts and reflection back to the starting demo state. */
meRouter.post('/reset', async (req, res) => {
  const fw = await getEmployeeFramework(req.userId)
  const seedable = fw?.state.nodes?.some((n) => n.id === 'sk-cnc')
  await saveDoc(req.userId, seedable ? buildSeedEmployeeDoc(fw.state, { cohortId: fw.cohortId, version: fw.version }) : blankDoc())
  res.json(await buildSnapshot(req.userId))
})
