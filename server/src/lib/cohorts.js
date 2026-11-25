// A cohort is one organization + business unit with its own skill framework.
// It keeps a working draft and an append-only list of published versions, so a published
// version never changes underneath employees until the next version is published.
import { deleteDoc, listDocs, readDoc, writeDoc } from '../storage.js'

export const ORGANIZATIONS = ['BAL', 'BACL', 'BATL', 'BAF']

export const LEVELS = [
  { id: 'lvl-basic', name: 'Basic' },
  { id: 'lvl-intermediate', name: 'Intermediate' },
  { id: 'lvl-advanced', name: 'Advanced' },
]

export const defaultConfig = (organization, businessUnit) => ({
  organization,
  businessUnit,
  structure: 'skill-subskill-task',
  ratedAt: 'task',
  labels: { skill: 'Skill', subskill: 'Sub-skill', task: 'Task' },
  levels: LEVELS,
  scale: { type: 'binary', yesLabel: 'Yes', noLabel: 'No', allowNA: true },
  evidence: { always: false, lowest: true, highest: false },
  // Last day (YYYY-MM-DD) the skip-level manager can calibrate. Until then employees can't see their manager's scores.
  calibrationDeadline: '',
  scoring: {
    // Four scores: 1 and 2 are Basic, 3 Intermediate, 4 Advanced. Each score runs up to its maximum percentage.
    manager: { s1Max: 25, s2Max: 50, s3Max: 75 },
    test: { s1Max: 40, s2Max: 60, s3Max: 80 },
    // A skill is cleared at 4 (Advanced): both scores must reach it, otherwise it is a development gap.
    courseTriggerBelow: 4,
    progressionMin: 4,
    // A different target for a proficiency level, by level id. Levels not listed use progressionMin.
    levelTargets: {},
    weights: { easy: 1, medium: 1.5, hard: 2 },
    missingInput: 'incomplete',
  },
})

const fail = (status, message) => Object.assign(new Error(message), { status, expose: true })
const docName = (id) => `cohorts/${id}`
const clone = (x) => JSON.parse(JSON.stringify(x))
const norm = (s) => String(s ?? '').trim().toLowerCase()

/** JSON with sorted keys so two equal drafts compare equal regardless of key order. */
const stable = (v) =>
  JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val))

/**
 * Cohorts saved before the four-score scale only have three bands. Bring them up to date as they are read, so older
 * drafts and published versions work with the same rules as new ones. Nothing here is written back.
 */
export function normalizeScoring(scoring) {
  if (!scoring) return scoring
  if (scoring.manager?.s3Max == null || scoring.test?.s3Max == null) {
    scoring.manager = { s1Max: 25, s2Max: 50, s3Max: 75 }
    scoring.test = { s1Max: 40, s2Max: 60, s3Max: 80 }
    // The bar used to be the top score, 3. On four scores the top is 4.
    scoring.progressionMin = 4
    scoring.courseTriggerBelow = 4
  }
  scoring.levelTargets ??= {}
  return scoring
}
function normalizeCohort(c) {
  if (!c) return c
  if (c.draft?.config) normalizeScoring(c.draft.config.scoring)
  for (const v of c.versions ?? []) normalizeScoring(v.state?.config?.scoring)
  // A cohort that is already published without a calibration deadline gets the cycle's, so it isn't left without one.
  if (c.versions?.length) {
    const fallback = process.env.CALIBRATION_DEADLINE || '2026-11-30'
    for (const cfg of [c.draft?.config, ...c.versions.map((v) => v.state?.config)]) if (cfg && !cfg.calibrationDeadline) cfg.calibrationDeadline = fallback
  }
  return c
}
export const loadCohort = async (id) => normalizeCohort(await readDoc(docName(id)))
export async function saveCohort(c) {
  c.updatedAt = new Date().toISOString()
  await writeDoc(docName(c.id), c)
}

export async function listCohorts() {
  const all = await Promise.all((await listDocs('cohorts')).map(loadCohort))
  return all.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export const latestVersion = (c) => c.versions.at(-1) ?? null
export const isDirty = (c) => {
  const l = latestVersion(c)
  return !l || stable(c.draft) !== stable(l.state)
}

/** draft: never published. live: published and in use. completed: closed by a TD admin; history kept. */
export const statusOf = (c) => (!latestVersion(c) ? 'draft' : c.closedAt ? 'completed' : 'live')

export function summarize(c) {
  const l = latestVersion(c)
  const nodes = c.draft.nodes ?? []
  return {
    id: c.id,
    status: statusOf(c),
    closedAt: c.closedAt ?? null,
    organization: c.draft.config.organization ?? '',
    businessUnit: c.draft.config.businessUnit ?? '',
    version: l?.version ?? null,
    publishedAt: l?.at ?? null,
    dirty: l ? isDirty(c) : false,
    skills: nodes.filter((n) => n.type === 'skill').length,
    tasks: nodes.filter((n) => n.type === 'task').length,
    questions: (c.draft.questions ?? []).length,
    updatedAt: c.updatedAt,
  }
}

/** What the TD admin editor works on: the draft plus where it stands against the published version. */
export function editorState(c) {
  const l = latestVersion(c)
  return { ...c.draft, publication: l ? { version: l.version, at: l.at } : null, dirtySincePublish: l ? isDirty(c) : false }
}

export function validateDraft(b) {
  if (!b || typeof b !== 'object') throw fail(400, 'Body must be a JSON object')
  if (!b.config || typeof b.config !== 'object') throw fail(400, 'config is required')
  if (!Array.isArray(b.config.levels)) throw fail(400, 'config.levels must be an array')
  if (!Array.isArray(b.nodes)) throw fail(400, 'nodes must be an array')
  if (!Array.isArray(b.questions)) throw fail(400, 'questions must be an array')
}

export async function createCohort({ organization, businessUnit }) {
  // Both may be left blank: the draft is created first and the TD admin fills them in on the Framework step.
  // Publishing is blocked (client-side validation) until both are set.
  organization = organization ?? ''
  if (organization && !ORGANIZATIONS.includes(organization)) throw fail(400, 'Select a valid organization.')
  const bu = String(businessUnit ?? '').trim()
  const base = `${organization}-${bu}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'new-cohort'
  const taken = new Set(await listDocs('cohorts'))
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  const now = new Date().toISOString()
  const cohort = { id, createdAt: now, updatedAt: now, draft: { config: defaultConfig(organization, bu), nodes: [], questions: [] }, versions: [] }
  await saveCohort(cohort)
  return cohort
}

export async function publishCohort(id) {
  const c = await loadCohort(id)
  if (!c) throw fail(404, 'Cohort not found.')
  const version = (latestVersion(c)?.version ?? 0) + 1
  c.versions.push({ version, at: new Date().toISOString(), state: clone(c.draft) })
  c.closedAt = null // publishing a new version puts a completed cohort back in use
  await saveCohort(c)
  return c
}

export async function completeCohort(id) {
  const c = await loadCohort(id)
  if (!c) throw fail(404, 'Cohort not found.')
  if (statusOf(c) !== 'live') throw fail(409, 'Only a live cohort can be marked completed.')
  c.closedAt = new Date().toISOString()
  await saveCohort(c)
  return c
}

export async function reopenCohort(id) {
  const c = await loadCohort(id)
  if (!c) throw fail(404, 'Cohort not found.')
  if (statusOf(c) !== 'completed') throw fail(409, 'Only a completed cohort can be reopened.')
  c.closedAt = null
  await saveCohort(c)
  return c
}

export async function deleteCohort(id) {
  const c = await loadCohort(id)
  if (!c) throw fail(404, 'Cohort not found.')
  if (statusOf(c) === 'live') throw fail(409, 'Mark a live cohort completed before deleting it.')
  await deleteDoc(docName(id))
}

/** The published framework that applies to a person, matched on organization and business unit. */
export async function publishedFor(profile) {
  if (!profile) return null
  for (const c of await listCohorts()) {
    const l = latestVersion(c)
    if (l && !c.closedAt && norm(l.state.config.organization) === norm(profile.organization) && norm(l.state.config.businessUnit) === norm(profile.businessUnit)) {
      return { cohortId: c.id, version: l.version, at: l.at, state: l.state }
    }
  }
  return null
}

/** A specific published version, so older test attempts can still be reviewed after a newer publish. */
export async function publishedVersion(cohortId, version) {
  const c = cohortId ? await loadCohort(cohortId) : null
  const v = c?.versions.find((x) => x.version === version)
  return v ? { cohortId, version, at: v.at, state: v.state } : null
}
