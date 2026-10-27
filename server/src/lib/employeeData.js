import { readDoc, writeDoc } from '../storage.js'
import { publishedFor } from './cohorts.js'
import { CYCLE, EMPLOYEES, PREVIOUS_CYCLE, PEOPLE, demoManager, demoPrevious, percentToScore, profileOf, rand } from './demoEmployee.js'

export const TEST_LENGTH = 10
export const MAX_ATTEMPTS = 1 // per cluster per cycle; retake rules are still an open business decision

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
  total: a.questionIds.length,
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

/** Tasks and clusters that apply at a given level. */
export function clustersFor(setup, levelId) {
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
    .filter((n) => n.type === 'skill' && (tasksBySkill.has(n.id) || n.levelId === levelId))
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
  const attempts = Object.entries(r.tests).map(([key, pct], i) => ({
    id: `mock-${id}-${key}`,
    skillId: `sk-${key}`,
    levelId,
    cycleId: CYCLE.id,
    questionIds: Array(7).fill('-'),
    status: 'submitted',
    submittedAt: daysAgo(2 + i),
    pct,
    score: percentToScore(pct, bands),
    correct: Math.round((pct / 100) * 7),
  }))
  return { ...blankDoc(), currentLevelId: levelId, self: { ratings, submittedAt: r.self === 'submitted' ? daysAgo(6) : null }, attempts }
}

/** The employee's own stored data, or the generated equivalent for demo reports. */
async function loadSource(id, setup) {
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

  const clusters = clustersFor(setup, currentLevelId).map(({ skill, tasks }) => {
    const taskIds = tasks.map((t) => t.id)
    const key = skill.id.replace(/^sk-/, '')
    const stored = validations[skill.id]
    let manager
    let marks // taskId -> 'yes' | 'no' | 'na'
    let validation
    if (stored?.status === 'submitted') {
      manager = { ...managerFromAnswers(taskIds, stored.answers, scoring.manager), comment: stored.comment ?? '' }
      marks = stored.answers
      validation = { status: 'submitted', answers: stored.answers, comment: stored.comment ?? '', at: stored.at }
    } else if (validated === undefined || validated.includes(key)) {
      // Demo-generated validation, including the occasional skip-manager adjustment.
      const g = demoManager(empId, skill.id, taskIds, scoring.manager)
      manager = { pct: g.pct, yes: g.yes, applicable: g.applicable, original: g.original, calibrated: g.calibrated, reason: g.reason, status: g.status, comment: '' }
      marks = Object.fromEntries(g.answers.map((a) => [a.taskId, a.answer]))
      validation = { status: 'submitted', answers: marks, comment: '', at: null }
    } else {
      manager = { pct: null, yes: 0, applicable: 0, original: 0, calibrated: 0, reason: null, status: 'pending', comment: '' }
      marks = {}
      validation = { status: stored?.status === 'draft' ? 'draft' : 'none', answers: stored?.answers ?? {}, comment: stored?.comment ?? '', at: stored?.at ?? null }
    }

    const mine = doc.attempts.filter((a) => a.skillId === skill.id && a.levelId === currentLevelId && a.cycleId === CYCLE.id)
    const submitted = mine.filter((a) => a.status === 'submitted')
    const latest = submitted.at(-1) ?? null
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
      test: {
        questionCount,
        testLength: Math.min(TEST_LENGTH, questionCount),
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - submitted.length),
        latest: latest ? publicAttempt(latest) : null,
        inProgressId: mine.find((a) => a.status === 'in-progress')?.id ?? null,
      },
      previous: demoPrevious(empId, skill.id, { managerPct: manager.pct, testPct: latest?.pct ?? null }),
    }
  })

  return {
    ...base,
    published: true,
    version: fw.version,
    labels: config.labels,
    levels,
    currentLevelId,
    evidence: config.evidence,
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
    reflection: doc.reflection,
  }
}
