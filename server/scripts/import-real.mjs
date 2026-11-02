// Imports real people and results from an HRMS / results export (.xlsx) as separate profiles. The demo data is not touched.
//   node scripts/import-real.mjs "path/to/export.xlsx"
// Writes data/real/people.json and publishes one cohort (organization + business unit) with the skills per job profile.
// Anything the export doesn't have is left blank. Both data/real and data/cohorts are git-ignored: never commit them.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { writeDoc } from '../src/storage.js'
import { defaultConfig, saveCohort } from '../src/lib/cohorts.js'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/import-real.mjs <export.xlsx>')
  process.exit(1)
}

/* ------------------------------ read the workbook ------------------------------ */

function unzip(buf) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('Not a valid .xlsx file')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = {}
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = buf.subarray(start, start + size)
    files[name] = method === 0 ? data : inflateRawSync(data)
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const colIndex = (ref) => ref.replace(/\d+/g, '').split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1

function sheetRows(files) {
  const shared = [...(files['xl/sharedStrings.xml']?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')))
  const xml = files['xl/worksheets/sheet1.xml'].toString('utf8')
  const rows = []
  for (const r of xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const row = []
    for (const c of r[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = /t="(\w+)"/.exec(c[2])?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1]
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] ?? '')?.[1]
      row[colIndex(c[1])] = t === 's' ? shared[Number(v)] : inline != null ? dec(inline) : v == null ? null : t === 'str' ? dec(v) : Number.isNaN(Number(v)) ? v : Number(v)
    }
    rows.push(row)
  }
  return rows
}

const [header, ...body] = sheetRows(unzip(readFileSync(file)))
const at = Object.fromEntries(header.map((h, i) => [String(h).trim(), i]))
const need = ['EmployeeId', 'Employee Name', 'SkillName', 'ManagerRating', 'IMochaValidation']
for (const n of need) if (at[n] == null) throw new Error(`Column "${n}" is missing from the export`)
// Export footers (e.g. "Applied filters: ...") have no employee name; skip them.
const data = body.filter((r) => r[at['Employee Name']] != null && r[at.EmployeeId] != null)
const get = (r, name) => (at[name] == null ? null : r[at[name]] ?? null)
const text = (v) => (v == null ? '' : String(v).trim())

/* --------------------------------- build people --------------------------------- */

const titleCase = (s) => (/[a-z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_m, a, b) => a + b.toUpperCase()))
const key = (s) => text(s).toUpperCase().replace(/[^A-Z]+/g, ' ').trim()
const slug = (s) => key(s).toLowerCase().replace(/ /g, '-')
/** "Excel Reporting_CSM" -> "Excel Reporting"; the raw name is kept as sourceName. */
const cleanSkill = (s) => text(s).replace(/_(?:CSM|ASM|Credit Sales Manager \(CSM\))$/i, '').replace(/\s*\(CSM\)$/i, '')
/** Export ratings run 0-3 where 0 means nothing recorded yet: blank, never a score. */
const rating = (v) => (typeof v === 'number' && v >= 1 && v <= 3 ? v : null)

const levelOf = (data) => ({ id: 'lvl-basic', name: 'Basic' })
const organization = (() => {
  const m = /\((BA[A-Z]*)\)/.exec(text(get(data[0], 'RO')))
  return m?.[1] ?? 'BACL'
})()
const businessUnit = text(get(data[0], 'Business_Unit'))

const people = {}
const skills = new Map() // skill node id -> node
const byEmployee = new Map()

for (const r of data) {
  const empId = text(r[at.EmployeeId])
  const id = `r${empId}`
  const jobProfile = text(get(r, 'JobProfileName'))
  if (!people[id]) {
    people[id] = {
      profile: {
        organization,
        employeeId: empId,
        name: titleCase(text(r[at['Employee Name']])),
        email: '',
        jobLevel: text(get(r, 'Position level')),
        buHead: '',
        buhr: '',
        designation: jobProfile,
        jobProfile,
        businessUnit: text(get(r, 'Business_Unit')),
        function: text(get(r, 'Function')),
        location: text(get(r, 'RO')),
        joined: '',
        manager: titleCase(text(get(r, 'Manager_Name'))),
        skipManager: titleCase(text(get(r, 'Skip'))),
        managerLevel: text(get(r, 'Manager Position level')),
      },
      results: {},
      reports: [],
    }
    byEmployee.set(key(r[at['Employee Name']]), id)
  }
  const raw = text(r[at.SkillName])
  const skillId = `sk-r-${slug(`${jobProfile} ${raw}`)}`
  if (!skills.has(skillId)) {
    skills.set(skillId, { id: skillId, type: 'skill', parentId: null, name: cleanSkill(raw), description: '', levelId: levelOf().id, critical: false, jobProfile, sourceName: raw })
  }
  const noTasks = text(get(r, "Tasks with Manager Validation Status 'No'")).split('|').map((t) => t.trim()).filter(Boolean)
  people[id].results[skillId] = {
    manager: rating(r[at.ManagerRating]),
    test: rating(r[at.IMochaValidation]),
    weighted: typeof get(r, 'Calculated_Weighted_Proficiency') === 'number' ? get(r, 'Calculated_Weighted_Proficiency') : null,
    noTasks,
  }
}

/* ---------------------------- reporting lines and teams ---------------------------- */

// A manager is another person in the export when the names match (the export sometimes cuts long names short).
const employeeKeys = [...byEmployee.keys()]
function findManager(name) {
  const k = key(name)
  if (!k) return null
  if (byEmployee.has(k)) return byEmployee.get(k)
  const near = employeeKeys.filter((e) => k.length >= 10 && (e.startsWith(k) || k.startsWith(e)))
  return near.length === 1 ? byEmployee.get(near[0]) : null
}

let nameOnly = 0
for (const id of Object.keys(people)) {
  const p = people[id]
  const name = p.profile.manager
  if (!name) continue
  let mgr = findManager(name)
  if (!mgr) {
    // Managers with no results of their own still get a profile, with their team and the rest left blank.
    mgr = `rm-${slug(name)}`
    if (!people[mgr]) {
      nameOnly++
      people[mgr] = {
        profile: { organization, employeeId: '', name, email: '', jobLevel: p.profile.managerLevel, buHead: '', buhr: '', designation: '', jobProfile: '', businessUnit, function: p.profile.function, location: '', joined: '', manager: '', skipManager: '' },
        results: {},
        reports: [],
      }
    }
  }
  p.managerId = mgr
  people[mgr].reports.push(id)
  // A manager's own manager is their skip's name for the people below them; keep it where it is known.
  if (!people[mgr].profile.manager && p.profile.skipManager) people[mgr].profile.manager = p.profile.skipManager
}

/* ------------------------------------ write it ------------------------------------ */

await writeDoc('real/people', { importedAt: new Date().toISOString(), source: path.basename(file), organization, businessUnit, people })

const id = `${organization}-${slug(businessUnit)}`.toLowerCase()
const draft = {
  config: { ...defaultConfig(organization, businessUnit), structure: 'skill-task', levels: [levelOf()] },
  nodes: [...skills.values()],
  questions: [],
}
const now = new Date().toISOString()
await saveCohort({ id, createdAt: now, updatedAt: now, draft, versions: [{ version: 1, at: now, state: JSON.parse(JSON.stringify(draft)) }] })

const real = Object.values(people)
const withResults = real.filter((p) => Object.keys(p.results).length)
const blank = (f) => withResults.reduce((n, p) => n + Object.values(p.results).filter((r) => f(r) == null).length, 0)
const cells = withResults.reduce((n, p) => n + Object.keys(p.results).length, 0)
console.log(`Cohort ${id}: ${organization} · ${businessUnit}, ${skills.size} skills across ${new Set([...skills.values()].map((s) => s.jobProfile)).size} job profiles`)
console.log(`${withResults.length} people with results, ${nameOnly} manager profiles without results, ${real.filter((p) => p.reports.length).length} managers with a team`)
console.log(`${cells} skill results: ${blank((r) => r.manager)} without a manager score, ${blank((r) => r.test)} without a test score`)
