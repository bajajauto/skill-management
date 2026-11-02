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

export const publicAttempt = (a) => ({
  id: a.id,
  skillId: a.skillId,
  status: a.status,
  submittedAt: a.submittedAt ?? null,
  pct: a.pct ?? null,
  score: a.score ?? null,
  correct: a.correct ?? null,
  earned: a.earned ?? null,
  possible: a.possible ?? null,
  total: a.questionIds.length,
  // Integrity record: how often the person left the test, and whether it was submitted for them because of that.
  violations: a.violations?.length ?? 0,
  autoSubmitted: a.autoSubmitted === true,
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

/** Everything the employee and manager screens need about one person, for the current cycle. */
export async function buildSnapshot(empId, opts = {}) {
  const employee = profileOf(empId)
  const base = { employee: { ...employee, validated: undefined }, cycle: CYCLE, previousCycle: PREVIOUS_CYCLE }
  const fw = opts.fw ?? (await getEmployeeFramework(empId))
  if (!fw) return { ...base, published: false }
  const setup = fw.state

  const src = await loadSource(empId, setup)
  const { doc, validated } = src
  const validations = await loadValidations(empId)
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
          score: from.score ?? null,
          correct: from.correct ?? null,
          earned: r ? (r.earned ?? null) : null,
          possible: r ? (r.possible ?? null) : null,
          total: r ? r.total : a.questionIds.length,
          violations: a.violations?.length ?? 0,
          autoSubmitted: a.autoSubmitted === true,
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

    const latest = skillResult(skill.id)
    const questionCount = questions.filter((q) => q.active && q.skillId === skill.id && q.levelId === currentLevelId).length
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      critical: skill.critical,
      tasks: tasks.map((t) => ({ ...t, managerAnswer: marks[t.id] ?? null })),
      self: doc.self.ratings[skill.id] ?? null,
      manager,
      validation,
      // This skill's slice of the combined objective test.
      test: { questionCount, latest },
      // No history was imported, so an imported person has nothing to compare against.
      previous: real ? { managerPct: null, testPct: null } : demoPrevious(empId, skill.id, { managerPct: manager.pct, testPct: latest?.pct ?? null }),
    }
  })

  const combinedDone = done.filter((a) => !a.skillId)
  const inProgress = inLevel.find((a) => !a.skillId && a.status === 'in-progress')
  const inTest = clusters.filter((c) => c.test.questionCount > 0).map((c) => ({ id: c.id, name: c.name, count: Math.min(PER_SKILL_QUESTIONS, c.test.questionCount) }))
  const test = {
    questionCount: clusters.reduce((n, c) => n + c.test.questionCount, 0),
    testLength: inTest.reduce((n, s) => n + s.count, 0),
    skills: inTest,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - combinedDone.length),
    latest: combinedDone.length ? publicAttempt(combinedDone.at(-1)) : null,
    inProgressId: inProgress?.id ?? null,
  }

  return {
    ...base,
    published: true,
    version: fw.version,
    labels: config.labels,
    levels,
    currentLevelId,
    evidence: normalizeEvidence(config.evidence),
    scale: config.scale,
    scoring: {
      manager: scoring.manager,
      test: scoring.test,
      courseTriggerBelow: scoring.courseTriggerBelow,
      progressionMin: scoring.progressionMin,
      missingInput: scoring.missingInput,
    },
    self: { submittedAt: doc.self.submittedAt },
    clusters,
    test,
    reflection: doc.reflection,
  }
}
