import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { publishedVersion } from '../lib/cohorts.js'
import { CYCLE, EMPLOYEES, percentToScore } from '../lib/demoEmployee.js'
import { isReal } from '../lib/realData.js'
import { DEMO_TEST_USER, buildSeedEmployeeDoc } from '../lib/demoSetup.js'
import { MAX_VIOLATIONS, PER_SKILL_QUESTIONS, VIOLATION_TYPES, blankDoc, buildSnapshot, getEmployeeFramework, loadDoc, publicAttempt, saveDoc } from '../lib/employeeData.js'

export const meRouter = Router()

const fail = (status, message) => Object.assign(new Error(message), { status, expose: true })

// Demo identity: the client sends the signed-in user's id. Real auth must replace this.
meRouter.use((req, _res, next) => {
  const id = req.get('x-user-id')
  if (!id || !(EMPLOYEES[id] || isReal(id))) return next(fail(404, 'No employee profile for this account.'))
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

/* ------------------------------ Objective test ------------------------------ */
// One test module per level, with a section for each skill that has questions. Each section is scored on its own,
// the same way the separate per-skill tests were, so the gap logic is unchanged.

meRouter.post('/tests/start', async (req, res) => {
  const fw = await getEmployeeFramework(req.userId)
  if (!fw) throw fail(409, 'The framework is not published yet.')
  const setup = fw.state
  const doc = await loadDoc(req.userId)
  const snap = await buildSnapshot(req.userId)
  if (snap.test.attemptsLeft === 0) throw fail(409, 'You have already taken this test this cycle.')

  let attempt = doc.attempts.find((a) => a.id === snap.test.inProgressId)
  if (!attempt) {
    // Sections follow the framework's skill order; questions are shuffled within a section, not across them.
    const picked = []
    for (const c of snap.clusters) {
      const pool = setup.questions.filter((q) => q.active && q.skillId === c.id && q.levelId === snap.currentLevelId)
      picked.push(...shuffle(pool).slice(0, PER_SKILL_QUESTIONS))
    }
    if (!picked.length) throw fail(409, 'No questions are available for this test yet.')
    attempt = {
      id: randomUUID(),
      levelId: snap.currentLevelId,
      cycleId: CYCLE.id,
      cohortId: fw.cohortId,
      version: fw.version,
      questionIds: picked.map((q) => q.id),
      startedAt: new Date().toISOString(),
      status: 'in-progress',
    }
    doc.attempts.push(attempt)
    await saveDoc(req.userId, doc)
  }
  const byId = new Map(setup.questions.map((q) => [q.id, q]))
  const questions = attempt.questionIds.filter((id) => byId.has(id)).map((id) => ({ id, skillId: byId.get(id).skillId, text: byId.get(id).text, options: byId.get(id).options }))
  const names = new Map(setup.nodes.filter((n) => n.type === 'skill').map((n) => [n.id, n.name]))
  const sections = []
  for (const q of questions) {
    const last = sections.at(-1)
    if (last && last.id === q.skillId) last.count++
    else sections.push({ id: q.skillId, name: names.get(q.skillId) ?? '', count: 1 })
  }
  res.json({
    attemptId: attempt.id,
    maxViolations: MAX_VIOLATIONS,
    violations: attempt.violations?.length ?? 0,
    sections,
    // Deliberately no answer key or explanation here.
    questions,
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
  const skillName = new Map(setup.nodes.filter((n) => n.type === 'skill').map((n) => [n.id, n.name]))
  return attempt.questionIds
    .filter((id) => byId.has(id))
    .map((id) => {
      const q = byId.get(id)
      const chosen = attempt.answers?.[id] ?? null
      return { id, skillId: q.skillId, skill: skillName.get(q.skillId) ?? '', text: q.text, options: q.options, difficulty: q.difficulty, chosen, correct: q.correct, isCorrect: chosen === q.correct, explanation: q.explanation }
    })
}

/** Result per skill, in the framework's order. Older per-skill attempts give a single entry. */
function breakdown(setup, attempt) {
  const skills = setup.nodes.filter((n) => n.type === 'skill')
  const name = (id) => skills.find((s) => s.id === id)?.name ?? id
  const rows = attempt.perSkill
    ? Object.entries(attempt.perSkill).map(([id, r]) => ({ skillId: id, name: name(id), pct: r.pct, score: r.score, correct: r.correct, total: r.total, earned: r.earned ?? null, possible: r.possible ?? null }))
    : attempt.skillId
      ? [{ skillId: attempt.skillId, name: name(attempt.skillId), pct: attempt.pct, score: attempt.score, correct: attempt.correct, total: attempt.questionIds.length, earned: null, possible: null }]
      : []
  return rows.sort((a, b) => skills.findIndex((s) => s.id === a.skillId) - skills.findIndex((s) => s.id === b.skillId))
}

// The page reports each time the person leaves the test. The server keeps the count so a reload can't reset it.
meRouter.post('/tests/attempts/:attemptId/violation', async (req, res) => {
  const type = req.body?.type
  if (!VIOLATION_TYPES.includes(type)) throw fail(400, 'Unknown violation type.')
  const doc = await loadDoc(req.userId)
  const attempt = doc.attempts.find((a) => a.id === req.params.attemptId)
  if (!attempt) throw fail(404, 'Attempt not found.')
  if (attempt.status === 'submitted') throw fail(409, 'This attempt was already submitted.')
  attempt.violations = [...(attempt.violations ?? []), { type, at: new Date().toISOString() }]
  await saveDoc(req.userId, doc)
  const count = attempt.violations.length
  res.json({ count, max: MAX_VIOLATIONS, autoSubmit: count >= MAX_VIOLATIONS })
})

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

  // Weighted overall, and the same sum kept per skill so every skill still gets its own 1-3 result.
  let earned = 0
  let possible = 0
  let correct = 0
  const per = {}
  for (const q of qs) {
    const w = weights[q.difficulty] ?? 1
    const s = (per[q.skillId] ??= { earned: 0, possible: 0, correct: 0, total: 0 })
    s.possible += w
    s.total++
    possible += w
    if (clean[q.id] === q.correct) {
      earned += w
      correct++
      s.earned += w
      s.correct++
    }
  }
  const pct = possible ? (earned / possible) * 100 : 0
  const perSkill = Object.fromEntries(
    Object.entries(per).map(([id, s]) => {
      const p = s.possible ? (s.earned / s.possible) * 100 : 0
      return [id, { pct: p, score: percentToScore(p, bands), correct: s.correct, total: s.total, earned: s.earned, possible: s.possible }]
    }),
  )
  // Only believe "submitted because of violations" if the strikes were really recorded.
  const autoSubmitted = req.body?.reason === 'violations' && (attempt.violations?.length ?? 0) >= MAX_VIOLATIONS
  Object.assign(attempt, { answers: clean, status: 'submitted', submittedAt: new Date().toISOString(), pct, score: percentToScore(pct, bands), correct, earned, possible, perSkill, autoSubmitted })
  await saveDoc(req.userId, doc)
  res.json({ attempt: publicAttempt(attempt), review: review(setup, attempt), breakdown: breakdown(setup, attempt) })
})

meRouter.get('/tests/attempts/:attemptId', async (req, res) => {
  const doc = await loadDoc(req.userId)
  const attempt = doc.attempts.find((a) => a.id === req.params.attemptId && a.status === 'submitted')
  if (!attempt) throw fail(404, 'Result not found.')
  const setup = await frameworkOf(req.userId, attempt)
  res.json({ attempt: publicAttempt(attempt), review: review(setup, attempt), breakdown: breakdown(setup, attempt) })
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
  await saveDoc(req.userId, seedable ? buildSeedEmployeeDoc(fw.state, { cohortId: fw.cohortId, version: fw.version, withTest: req.userId !== DEMO_TEST_USER }) : blankDoc())
  res.json(await buildSnapshot(req.userId))
})
