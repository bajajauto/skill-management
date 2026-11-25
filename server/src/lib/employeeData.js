import { readDoc, writeDoc } from '../storage.js'
import { publishedFor } from './cohorts.js'
import { normalizeEvidence } from './evidence.js'
import { CYCLE, EMPLOYEES, PREVIOUS_CYCLE, PEOPLE, demoManager, demoPrevious, percentToScore, profileOf, rand } from './demoEmployee.js'
import { REAL, realPerson } from './realData.js'

/**
 * The objective test is one module with a section per skill. Each section holds up to this many questions from
 * that skill and is scored on its own, exactly as the separate per-skill tests were.
 */
export const PER_SKILL_QUESTIONS = 10
/** One test has this many questions in all, shared across its skill sections, and this long to finish them. */
export const TEST_QUESTIONS = 20
export const TEST_MINUTES = 40

/**
 * How many questions each section gets: an even share of TEST_QUESTIONS, never more than the section has, with
 * whatever a short section can't fill handed to the others in turn. `available` is each section's question count.
 */
export function allocate(available, total = TEST_QUESTIONS) {
  const out = available.map(() => 0)
  let left = Math.min(total, available.reduce((n, a) => n + a, 0))
  while (left > 0) {
    let gave = false
    for (let i = 0; i < out.length && left > 0; i++) {
      if (out[i] < available[i]) {
        out[i]++
        left--
        gave = true
      }
    }
    if (!gave) break
  }
  return out
}
export const MAX_ATTEMPTS = 1 // per level per cycle; retake rules are still an open business decision
/** Strikes for leaving the test (tab switch, leaving full screen, screenshot or print keys) before it submits itself. */
export const MAX_VIOLATIONS = 3
export const VIOLATION_TYPES = ['tab-hidden', 'window-blur', 'fullscreen-exit', 'screenshot-key', 'print', 'copy']

export const blankDoc = () => ({
  currentLevelId: null,
  self: { ratings: {}, submittedAt: null },
  attempts: [],
  reflection: { proud: '', focus: '', support: '', savedAt: null },
})
const docName = (id) => `employees/${id}`
export const loadDoc = async (id) => ({ ...blankDoc(), ...((await readDoc(docName(id))) ?? {}) })
export const saveDoc = (id, doc) => writeDoc(docName(id), doc)

export const loadValidations = async (empId) => (await readDoc(`validations/${empId}`)) ?? {}
export const saveValidations = (empId, v) => writeDoc(`validations/${empId}`, v)

/** A fingerprint of the manager's answers on a skill's tasks, so a calibration knows what it was made against. */
export const calSignature = (taskIds, marks) => taskIds.map((id) => marks[id] ?? '').join(',')

/**
 * Skip-level calibration, one record per skill: { answers, reason, by, byName, at, basedOn }. `answers` is the skip
 * manager's Yes / No / N/A on each task. It only counts while the manager's answers are still the ones it was made
 * against (`basedOn`); if the manager revises their evaluation, their new answers flow through until it is calibrated again.
 */
export const loadCalibrations = async (empId) => (await readDoc(`calibrations/${empId}`)) ?? {}
export const saveCalibrations = (empId, v) => writeDoc(`calibrations/${empId}`, v)

/** An attempt as the browser sees it. The score is worked out again from the percentage on the bands in force. */
export const publicAttempt = (a, bands) => ({
  id: a.id,
  skillId: a.skillId,
  status: a.status,
  submittedAt: a.submittedAt ?? null,
  pct: a.pct ?? null,
  score: bands && a.pct != null ? percentToScore(a.pct, bands) : (a.score ?? null),
  correct: a.correct ?? null,
  earned: a.earned ?? null,
  possible: a.possible ?? null,
  total: a.questionIds.length,
  // Integrity record: how often the person left the test, and whether it was submitted for them because of that.
  violations: a.violations?.length ?? 0,
  autoSubmitted: a.autoSubmitted === true,
          timedOut: a.timedOut === true,
})

/** Derive a manager result from task answers ({ taskId: 'yes' | 'no' | 'na' }). */
export function managerFromAnswers(taskIds, answers, bands) {
  const given = taskIds.map((id) => answers[id])
  const applicable = given.filter((a) => a === 'yes' || a === 'no').length
  const yes = given.filter((a) => a === 'yes').length
  const pct = applicable ? (yes / applicable) * 100 : null
  const original = pct == null ? 0 : percentToScore(pct, bands)
  return { pct, yes, applicable, original, calibrated: original, reason: null, status: original ? 'calibrated' : 'pending' }
}

/**
 * Tasks and clusters that apply at a given level. A skill can be limited to one job profile (`jobProfile` on the
 * skill); skills with none apply to everyone.
 */
export function clustersFor(setup, levelId, jobProfile = null) {
  const { nodes } = setup
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const rootOf = (n) => {
    let cur = n
    while (cur.parentId && byId.get(cur.parentId)) cur = byId.get(cur.parentId)
    return cur
  }
  const tasksBySkill = new Map()
  for (const n of nodes) {
    if (n.type !== 'task' || n.levelId !== levelId) continue
    const root = rootOf(n)
    const parent = n.parentId ? byId.get(n.parentId) : null
    const list = tasksBySkill.get(root.id) ?? []
    list.push({ id: n.id, name: n.name, description: n.description, group: parent && parent.type === 'subskill' ? parent.name : null })
    tasksBySkill.set(root.id, list)
  }
  return nodes
    .filter((n) => n.type === 'skill' && (!n.jobProfile || n.jobProfile === jobProfile) && (tasksBySkill.has(n.id) || n.levelId === levelId))
    .map((s) => ({ skill: s, tasks: tasksBySkill.get(s.id) ?? [] }))
}

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString()

/** A stored-document equivalent for a demo person who has no login. */
function mockDoc(id, setup) {
  const r = PEOPLE[id]
  const bands = setup.config.scoring.test
  const skills = setup.nodes.filter((n) => n.type === 'skill')
  const levelId = setup.config.levels[0]?.id ?? null
  const ratings = {}
  const rated = r.self === 'submitted' ? skills : r.self === 'draft' ? skills.slice(0, 2) : []
  for (const s of rated) ratings[s.id] = { rating: 1 + Math.floor(rand(`${id}|${s.id}|self`) * 3), comment: '' }
  // The objective test is one combined test. A person either has taken it or hasn't; any skill not listed in
  // their spec gets a generated score, so a taken test always covers every skill that has questions.
  const attempts = []
  if (Object.keys(r.tests).length > 0) {
    const perSkill = {}
    let total = 0
    let correctSum = 0
    let pctSum = 0
    let earnedAll = 0
    let possibleAll = 0
    for (const s of skills.filter((sk) => setup.questions.some((q) => q.active && q.skillId === sk.id && q.levelId === levelId))) {
      const pct = r.tests[s.id.replace(/^sk-/, '')] ?? Math.round(62 + rand(`${id}|${s.id}|tp`) * 38)
      const correct = Math.round((pct / 100) * PER_SKILL_QUESTIONS)
      // Demo people have no real questions, so give them a believable weighted total (about 1.5 points a question).
      const possible = PER_SKILL_QUESTIONS * 1.5
      const earned = Math.round(((pct / 100) * possible) * 2) / 2
      perSkill[s.id] = { pct, score: percentToScore(pct, bands), correct, total: PER_SKILL_QUESTIONS, earned, possible }
      earnedAll += earned
      possibleAll += possible
      total += PER_SKILL_QUESTIONS
      correctSum += correct
      pctSum += pct
    }
    const count = Object.keys(perSkill).length
    const overall = count ? pctSum / count : 0
    attempts.push({ id: `mock-${id}-test`, levelId, cycleId: CYCLE.id, questionIds: Array(total).fill('-'), status: 'submitted', submittedAt: daysAgo(3), pct: overall, score: percentToScore(overall, bands), correct: correctSum, earned: earnedAll, possible: possibleAll, perSkill })
  }
  return { ...blankDoc(), currentLevelId: levelId, self: { ratings, submittedAt: r.self === 'submitted' ? daysAgo(6) : null }, attempts }
}

/** The employee's own stored data, or the generated equivalent for demo reports. */
/**
 * Imported people: the results come straight from the export. A score of 0 there means nothing recorded, so it is
 * left blank rather than shown as a score. Nothing is invented for what the export doesn't have.
 */
async function realSource(id, real, setup, levelId) {
  const perSkill = {}
  for (const [skillId, r] of Object.entries(real.results)) {
    if (r.test != null) perSkill[skillId] = { pct: null, score: r.test, correct: null, total: 3, earned: r.test, possible: 3 }
  }
  const doc = await loadDoc(id)
  const attempts = Object.keys(perSkill).length
    ? [{ id: `real-${id}-test`, levelId, cycleId: CYCLE.id, questionIds: [], status: 'submitted', submittedAt: REAL_AT, pct: null, score: Math.round(Object.values(perSkill).reduce((n, r) => n + r.score, 0) / Object.keys(perSkill).length), correct: null, earned: null, possible: null, perSkill }]
    : []
  return { doc: { ...doc, currentLevelId: levelId, attempts: [...doc.attempts, ...attempts] }, validated: [] }
}
const REAL_AT = new Date(REAL.importedAt ?? Date.now()).toISOString()

async function loadSource(id, setup) {
  const real = realPerson(id)
  if (real) return realSource(id, real, setup, setup.config.levels[0]?.id ?? null)
  if (EMPLOYEES[id]) return { doc: await loadDoc(id), validated: EMPLOYEES[id].validated }
  if (PEOPLE[id]) return { doc: mockDoc(id, setup), validated: PEOPLE[id].validated }
  return null
}

/** The published framework version that applies to this person, matched on organization and business unit. */
export const getEmployeeFramework = (id) => publishedFor(profileOf(id))

/**
 * Skip-level calibration runs until a deadline (the end of that day, India time). Until then the employee does not see
 * their manager's scores, since they may still change. From then on every score is shown, calibrated or not.
 */
export function calibrationWindow(configured, now = Date.now()) {
  // The date the TD admin set in the cohort's setup. The cycle default only covers cohorts that have none.
  const deadline = configured || process.env.CALIBRATION_DEADLINE || CYCLE.calibrationDeadline
  return { deadline, open: now <= new Date(`${deadline}T23:59:59+05:30`).getTime() }
}

/** Managers evaluate their team until a deadline (the end of that day, India time). After it evaluations are closed. */
export function evaluationWindow(configured, now = Date.now()) {
  const deadline = configured || process.env.EVALUATION_DEADLINE || '2026-11-28'
  return { deadline, open: now <= new Date(`${deadline}T23:59:59+05:30`).getTime() }
}

/** What an employee sees in place of the manager's result while calibration is still open. */
const HIDDEN_MANAGER = { pct: null, yes: 0, applicable: 0, original: 0, calibrated: 0, reason: null, status: 'pending', comment: '', calibration: null }

/**
 * Everything the employee and manager screens need about one person. Pass `hideManager` for the employee's own view:
 * it holds the manager's results back while calibration is open, and it never shows that a skip manager changed a score.
 */
export async function buildSnapshot(empId, opts = {}) {
  const employee = profileOf(empId)
  const fw = opts.fw ?? (await getEmployeeFramework(empId))
  const setup = fw?.state
  // Each cohort sets its own calibration deadline in the TD admin setup.
  const window = calibrationWindow(setup?.config.calibrationDeadline)
  const hide = opts.hideManager === true && window.open
  const base = { employee: { ...employee, validated: undefined }, cycle: CYCLE, previousCycle: PREVIOUS_CYCLE, calibration: { ...window, managerHidden: hide }, evaluation: evaluationWindow(setup?.config.evaluationDeadline) }
  if (!fw) return { ...base, published: false }

  const src = await loadSource(empId, setup)
  const { doc, validated } = src
  const validations = await loadValidations(empId)
  const calibrations = await loadCalibrations(empId)
  const employeeViewOnly = opts.hideManager === true
  const { config, questions } = setup
  const levels = config.levels
  const currentLevelId = levels.some((l) => l.id === doc.currentLevelId) ? doc.currentLevelId : levels[0]?.id
  const { scoring } = config

  // Test results for this level and cycle. One combined test covers every skill; older per-skill attempts still count
  // for the skill they were taken on, and for each skill the most recent attempt that covers it wins.
  const inLevel = doc.attempts.filter((a) => a.levelId === currentLevelId && a.cycleId === CYCLE.id)
  const done = inLevel.filter((a) => a.status === 'submitted').sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))
  const skillResult = (skillId) => {
    for (let i = done.length - 1; i >= 0; i--) {
      const a = done[i]
      const r = a.perSkill?.[skillId]
      const from = r ?? (a.skillId === skillId ? a : null)
      if (from) {
        return {
          id: a.id,
          skillId,
          status: 'submitted',
          submittedAt: a.submittedAt ?? null,
          pct: from.pct ?? null,
          score: from.pct != null ? percentToScore(from.pct, scoring.test) : (from.score ?? null),
          correct: from.correct ?? null,
          earned: r ? (r.earned ?? null) : null,
          possible: r ? (r.possible ?? null) : null,
          total: r ? r.total : a.questionIds.length,
          violations: a.violations?.length ?? 0,
          autoSubmitted: a.autoSubmitted === true,
          timedOut: a.timedOut === true,
        }
      }
    }
    return null
  }

  const real = realPerson(empId)
  const clusters = clustersFor(setup, currentLevelId, employee.jobProfile).map(({ skill, tasks: setupTasks }) => {
    // An imported person has no task-by-task answers, only the tasks their manager marked as not yet met.
    const given = real?.results[skill.id]
    const tasks = real ? (given?.noTasks ?? []).map((name, i) => ({ id: `rt-${skill.id}-${i}`, name, description: '', group: null })) : setupTasks
    const taskIds = tasks.map((t) => t.id)
    const key = skill.id.replace(/^sk-/, '')
    const stored = real ? undefined : validations[skill.id]
    let manager
    let marks // taskId -> 'yes' | 'no' | 'na'
    let validation
    if (real) {
      const score = given?.manager ?? 0
      manager = { pct: null, yes: 0, applicable: 0, original: score, calibrated: score, reason: null, status: score ? 'calibrated' : 'pending', comment: '' }
      marks = Object.fromEntries(taskIds.map((id) => [id, 'no']))
      validation = { status: score ? 'submitted' : 'none', answers: marks, comment: '', at: null }
    } else if (stored?.status === 'submitted') {
      manager = { ...managerFromAnswers(taskIds, stored.answers, scoring.manager), comment: stored.comment ?? '' }
      marks = stored.answers
      validation = { status: 'submitted', answers: stored.answers, comment: stored.comment ?? '', at: stored.at }
    } else if (validated === undefined || validated.includes(key)) {
      // Demo-generated validation, including the occasional skip-manager adjustment.
      const g = demoManager(empId, skill.id, taskIds, scoring.manager)
      manager = { pct: g.pct, yes: g.yes, applicable: g.applicable, original: g.original, calibrated: g.calibrated, reason: g.reason, status: g.status, comment: '' }
      marks = Object.fromEntries(g.answers.map((a) => [a.taskId, a.answer]))
      validation = stored?.status === 'draft' ? { status: 'draft', answers: stored.answers, comment: stored.comment ?? '', at: stored.at } : { status: 'submitted', answers: marks, comment: '', at: null }
    } else {
      manager = { pct: null, yes: 0, applicable: 0, original: 0, calibrated: 0, reason: null, status: 'pending', comment: '' }
      marks = {}
      validation = { status: stored?.status === 'draft' ? 'draft' : 'none', answers: stored?.answers ?? {}, comment: stored?.comment ?? '', at: stored?.at ?? null }
    }

    // The skip manager's calibration is their own Yes / No / N/A on the same tasks. The skill score is worked out from
    // those answers, so it moves with them. Without a calibration the manager's answers and score stand.
    const cal = calibrations[skill.id]
    const managerMarks = marks
    manager.calibration = null
    let finalMarks = managerMarks
    // Once evaluations have closed, a skill the manager never evaluated is rated by the skip manager instead.
    const ratedBySkip = manager.status === 'pending' && !base.evaluation.open
    if ((manager.status === 'calibrated' || ratedBySkip) && !real && cal && cal.basedOn === calSignature(taskIds, managerMarks)) {
      finalMarks = Object.fromEntries(taskIds.map((id) => [id, cal.answers?.[id] ?? managerMarks[id]]))
      const r = managerFromAnswers(taskIds, finalMarks, scoring.manager)
      const changedTasks = taskIds.filter((id) => finalMarks[id] !== managerMarks[id]).length
      manager.calibration = { by: cal.byName ?? '', at: cal.at, agreed: changedTasks === 0, reason: cal.reason || null, taskReasons: cal.taskReasons ?? {}, changedTasks, managerYes: manager.yes, managerApplicable: manager.applicable, ratedBySkip }
      Object.assign(manager, { pct: r.pct, yes: r.yes, applicable: r.applicable, calibrated: r.original, reason: changedTasks ? cal.reason || null : null, ...(ratedBySkip ? { status: r.original ? 'calibrated' : 'pending' } : {}) })
    }
    // The employee never learns that a skip manager changed anything: they get the final answers and score as the manager's.
    const employeeView = opts.hideManager === true

    const latest = skillResult(skill.id)
    const questionCount = questions.filter((q) => q.active && q.skillId === skill.id && q.levelId === currentLevelId).length
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      critical: skill.critical,
      // `managerAnswer` is the final answer. `managerOriginal` is the manager's own, shown to managers only.
      tasks: tasks.map((t) => ({ ...t, managerAnswer: hide ? null : (finalMarks[t.id] ?? null), ...(employeeView ? {} : { managerOriginal: managerMarks[t.id] ?? null }) })),
      self: doc.self.ratings[skill.id] ?? null,
      // The manager (and the skip manager) still see the original score, the new one and the reason.
      manager: hide ? HIDDEN_MANAGER : employeeView && manager.calibration ? { ...manager, original: manager.calibrated, reason: null, calibration: null } : manager,
      validation: hide ? { status: 'none', answers: {}, comment: '', at: null } : employeeView ? { ...validation, answers: {}, comment: '' } : validation,
      // This skill's slice of the combined objective test.
      test: { questionCount, latest },
      // No history was imported, so an imported person has nothing to compare against.
      previous: real ? { managerPct: null, testPct: null } : { ...demoPrevious(empId, skill.id, { managerPct: manager.pct, testPct: latest?.pct ?? null }), ...(hide ? { managerPct: null } : {}) },
    }
  })

  const combinedDone = done.filter((a) => !a.skillId)
  const inProgress = inLevel.find((a) => !a.skillId && a.status === 'in-progress')
  const testable = clusters.filter((c) => c.test.questionCount > 0)
  const share = allocate(testable.map((c) => c.test.questionCount))
  const inTest = testable.map((c, i) => ({ id: c.id, name: c.name, count: share[i] })).filter((s) => s.count > 0)
  const test = {
    questionCount: clusters.reduce((n, c) => n + c.test.questionCount, 0),
    testLength: inTest.reduce((n, s) => n + s.count, 0),
    testMinutes: TEST_MINUTES,
    skills: inTest,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - combinedDone.length),
    latest: combinedDone.length ? publicAttempt(combinedDone.at(-1), scoring.test) : null,
    inProgressId: inProgress?.id ?? null,
  }

  return {
    ...base,
    published: true,
    // Once the skip manager has given input the manager's evaluation is locked. The employee is not told.
    ...(employeeViewOnly ? {} : { evaluationLocked: Object.keys(calibrations).length > 0 }),
    version: fw.version,
    labels: config.labels,
    levels,
    currentLevelId,
    evidence: normalizeEvidence(config.evidence),
    scale: config.scale,
    scoring: {
      manager: scoring.manager,
      test: scoring.test,
      // The target can differ by proficiency level; the snapshot carries the one for this person's level.
      courseTriggerBelow: scoring.levelTargets?.[currentLevelId] ?? scoring.courseTriggerBelow,
      progressionMin: scoring.levelTargets?.[currentLevelId] ?? scoring.progressionMin,
      missingInput: scoring.missingInput,
    },
    self: { submittedAt: doc.self.submittedAt },
    clusters,
    test,
    reflection: doc.reflection,
  }
}
