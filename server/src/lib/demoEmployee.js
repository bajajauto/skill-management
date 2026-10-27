// Demo-only employee data. Replace with HRMS sync (profile) and the manager / calibration workflow (scores).

export const EMPLOYEES = {
  u1: {
    organization: 'BAL',
    employeeId: 'BA-20418',
    name: 'Asha Rao',
    email: 'asha.rao@bajajauto.co.in',
    jobLevel: 'EX',
    buHead: 'Meera Kulkarni',
    buhr: 'Priya Nair',
    designation: 'Senior Engineer, Manufacturing',
    jobProfile: 'CNC Manufacturing Engineer',
    businessUnit: 'Powertrain',
    function: 'Manufacturing Engineering',
    location: 'Chakan, Pune',
    joined: '2021-06-14',
    manager: 'Vikram Shah',
    skipManager: 'Rohan Iyer',
    // Clusters whose manager validation is already done. Any other cluster is waiting on the manager.
    validated: ['cnc', 'quality', 'lean', 'safety'],
  },
  u2: {
    organization: 'BAL',
    employeeId: 'BA-11873',
    name: 'Vikram Shah',
    email: 'vikram.shah@bajajauto.co.in',
    jobLevel: 'M2',
    buHead: 'Meera Kulkarni',
    buhr: 'Priya Nair',
    designation: 'Section Manager, Manufacturing',
    jobProfile: 'Manufacturing Section Manager',
    businessUnit: 'Powertrain',
    function: 'Manufacturing Engineering',
    location: 'Chakan, Pune',
    joined: '2016-02-01',
    manager: 'Anita Deshmukh',
    skipManager: 'Suresh Rao',
  },
  u3: {
    organization: 'BAL',
    employeeId: 'BA-12044',
    name: 'Priya Nair',
    email: 'priya.nair@bajajauto.co.in',
    jobLevel: 'M2',
    buHead: 'Meera Kulkarni',
    buhr: 'Priya Nair',
    designation: 'Business HR Head, Powertrain',
    jobProfile: 'Business HR Partner',
    businessUnit: 'Powertrain',
    function: 'Human Resources',
    location: 'Chakan, Pune',
    joined: '2015-09-14',
    manager: 'Meera Kulkarni',
    skipManager: 'Suresh Rao',
  },
}

/** Direct reports per manager (user id -> employee ids). u1 is a real login; the rest are demo-only people. */
export const TEAMS = { u2: ['u1', 'e2', 'e3', 'e4', 'e5', 'e6'], u3: ['e7', 'e8', 'e9'] }

/** Users who can switch to the BUHR view: they see the whole business unit they belong to. */
export const BUHRS = ['u3']

const mockProfile = (p) => ({
  organization: 'BAL',
  jobLevel: 'EX',
  buHead: 'Meera Kulkarni',
  buhr: 'Priya Nair',
  businessUnit: 'Powertrain',
  function: 'Manufacturing Engineering',
  location: 'Chakan, Pune',
  manager: 'Vikram Shah',
  skipManager: 'Rohan Iyer',
  ...p,
})

// Demo people without a login. `tests` is skill key -> test %, `self` is 'submitted' | 'draft' | 'none',
// `validated` is the clusters the manager has already validated.
export const ROSTER = {
  e2: {
    profile: mockProfile({ employeeId: 'BA-20977', name: 'Rahul Menon', email: 'rahul.menon@bajajauto.co.in', designation: 'Engineer, Manufacturing', jobProfile: 'CNC Manufacturing Engineer', joined: '2022-08-08' }),
    self: 'submitted',
    tests: { cnc: 86, quality: 71, lean: 64, tpm: 90, safety: 100, comm: 55 },
    validated: ['cnc', 'quality', 'lean', 'tpm', 'safety', 'comm'],
  },
  e3: {
    profile: mockProfile({ employeeId: 'BA-21340', name: 'Sneha Kulkarni', email: 'sneha.kulkarni@bajajauto.co.in', designation: 'Engineer, Quality', jobProfile: 'Quality Engineer', function: 'Quality Assurance', joined: '2023-01-16' }),
    self: 'submitted',
    tests: { cnc: 72, quality: 93, lean: 80, safety: 86 },
    validated: ['cnc', 'quality', 'safety'],
  },
  e4: {
    profile: mockProfile({ employeeId: 'BA-22105', name: 'Arjun Patil', email: 'arjun.patil@bajajauto.co.in', designation: 'Graduate Engineer Trainee', jobProfile: 'CNC Manufacturing Engineer', joined: '2026-07-01' }),
    self: 'draft',
    tests: { safety: 57 },
    validated: [],
  },
  e5: {
    profile: mockProfile({ employeeId: 'BA-20288', name: 'Divya Pillai', email: 'divya.pillai@bajajauto.co.in', designation: 'Senior Technician', jobProfile: 'CNC Machine Operator', joined: '2019-11-04' }),
    self: 'none',
    tests: {},
    validated: ['cnc', 'safety'],
  },
  e6: {
    profile: mockProfile({ employeeId: 'BA-19764', name: 'Imran Shaikh', email: 'imran.shaikh@bajajauto.co.in', designation: 'Lead Engineer, Maintenance', jobProfile: 'Maintenance Engineer', function: 'Plant Maintenance', joined: '2018-03-19' }),
    self: 'submitted',
    tests: { cnc: 66, quality: 74, lean: 90, tpm: 96, safety: 93, comm: 81 },
    validated: ['cnc', 'quality', 'lean', 'tpm', 'safety'],
  },
  // Priya Nair's (BUHR) direct reports.
  e7: {
    profile: mockProfile({ employeeId: 'BA-18820', name: 'Rekha Sawant', email: 'rekha.sawant@bajajauto.co.in', designation: 'HR Business Partner', jobProfile: 'HR Business Partner', function: 'Human Resources', manager: 'Priya Nair', skipManager: 'Meera Kulkarni', joined: '2017-05-22' }),
    self: 'submitted',
    tests: { lean: 70, safety: 88, comm: 94 },
    validated: ['lean', 'safety', 'comm'],
  },
  e8: {
    profile: mockProfile({ employeeId: 'BA-21702', name: 'Manoj Bhosale', email: 'manoj.bhosale@bajajauto.co.in', designation: 'Talent Development Executive', jobProfile: 'Talent Development Executive', function: 'Human Resources', manager: 'Priya Nair', skipManager: 'Meera Kulkarni', joined: '2023-09-04' }),
    self: 'draft',
    tests: { safety: 61 },
    validated: [],
  },
  e9: {
    profile: mockProfile({ employeeId: 'BA-20155', name: 'Fatima Sheikh', email: 'fatima.sheikh@bajajauto.co.in', designation: 'Senior HR Executive', jobProfile: 'HR Executive', function: 'Human Resources', manager: 'Priya Nair', skipManager: 'Meera Kulkarni', joined: '2020-02-17' }),
    self: 'submitted',
    tests: { lean: 58, tpm: 66, safety: 91, comm: 85 },
    validated: ['lean', 'safety'],
  },
}

/* ------------------------- Generated business-unit population ------------------------- */

const SKILL_KEYS = ['cnc', 'quality', 'lean', 'tpm', 'safety', 'comm']
const FIRST = ['Aarav', 'Ananya', 'Bhavesh', 'Chitra', 'Dhruv', 'Esha', 'Farhan', 'Gauri', 'Harsh', 'Isha', 'Jayant', 'Kiran', 'Lata', 'Mihir', 'Nisha', 'Omkar', 'Pallavi', 'Qasim', 'Rohit', 'Sakshi', 'Tanmay', 'Uma', 'Vivek', 'Yash', 'Zoya', 'Akash', 'Bela', 'Chetan', 'Disha', 'Eshan']
const LAST = ['Patil', 'Kulkarni', 'Deshpande', 'Joshi', 'Shinde', 'More', 'Gaikwad', 'Jadhav', 'Pawar', 'Bhide', 'Kale', 'Sharma', 'Iyer', 'Naik', 'Chavan']
const DESIGNATIONS = ['Engineer', 'Senior Engineer', 'Technician', 'Lead Engineer', 'Executive']
const PROFILES = {
  'Manufacturing Engineering': 'CNC Manufacturing Engineer',
  'Quality Assurance': 'Quality Engineer',
  'Plant Maintenance': 'Maintenance Engineer',
  'Supply Chain': 'Materials Planner',
  Assembly: 'Assembly Line Engineer',
  'R&D Powertrain': 'Powertrain Design Engineer',
}
// `diligence` is how reliably the manager completes validations, so some teams are visibly behind.
const GEN_MANAGERS = [
  { name: 'Suresh Kamat', function: 'Manufacturing Engineering', location: 'Chakan, Pune', skip: 'Anita Deshmukh', diligence: 0.85, size: 6 },
  { name: 'Neha Joshi', function: 'Quality Assurance', location: 'Chakan, Pune', skip: 'Anita Deshmukh', diligence: 0.6, size: 5 },
  { name: 'Rajesh Pawar', function: 'Plant Maintenance', location: 'Waluj, Aurangabad', skip: 'Mohan Bhide', diligence: 0.3, size: 5 },
  { name: 'Kavita Rao', function: 'Supply Chain', location: 'Waluj, Aurangabad', skip: 'Mohan Bhide', diligence: 0.9, size: 4 },
  { name: 'Sanjay Gupta', function: 'Assembly', location: 'Pantnagar', skip: 'Deepak Sinha', diligence: 0.5, size: 6 },
  { name: 'Pooja Mehta', function: 'R&D Powertrain', location: 'Akurdi, Pune', skip: 'Deepak Sinha', diligence: 0.75, size: 4 },
]
// A few people the campaign can't process normally (governance exceptions).
const EXCEPTIONS = { g07: 'Missing skip manager', g15: 'No job profile mapped', g23: 'On long leave, workflow paused' }

const clamp01 = (v) => Math.max(0.05, Math.min(1, v))

function buildGenerated() {
  const out = {}
  let n = 0
  for (const m of GEN_MANAGERS) {
    for (let i = 0; i < m.size; i++) {
      n++
      const id = `g${String(n).padStart(2, '0')}`
      const name = `${FIRST[(n * 7) % FIRST.length]} ${LAST[(n * 4 + 3) % LAST.length]}`
      const p = clamp01(m.diligence + (rand(`${id}|p`) - 0.5) * 0.5)
      const strength = rand(`${id}|str`)
      const r = rand(`${id}|self`)
      const tests = {}
      for (const k of SKILL_KEYS) {
        if (rand(`${id}|${k}|t`) < p * 0.95) tests[k] = Math.round(68 + 32 * (0.4 * rand(`${id}|${k}|pct`) + 0.6 * strength))
      }
      const validated = SKILL_KEYS.filter((k) => rand(`${id}|${k}|v`) < m.diligence)
      out[id] = {
        profile: mockProfile({
          employeeId: `BA-${30000 + n * 17}`,
          name,
          email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@bajajauto.co.in`,
          designation: DESIGNATIONS[(n * 3) % DESIGNATIONS.length],
          jobProfile: PROFILES[m.function],
          function: m.function,
          location: m.location,
          manager: m.name,
          skipManager: EXCEPTIONS[id] === 'Missing skip manager' ? '' : m.skip,
          joined: `20${19 + (n % 7)}-${String(1 + (n % 12)).padStart(2, '0')}-${String(1 + ((n * 5) % 27)).padStart(2, '0')}`,
          exception: EXCEPTIONS[id] ?? null,
        }),
        self: r < p ? 'submitted' : r < p + 0.15 ? 'draft' : 'none',
        tests,
        validated,
      }
    }
  }
  return out
}

export const GENERATED = buildGenerated()
/** Everyone who has no login but exists in the demo: hand-written reports plus the generated population. */
export const PEOPLE = { ...ROSTER, ...GENERATED }

export const profileOf = (id) => EMPLOYEES[id] ?? PEOPLE[id]?.profile ?? null

const norm = (s) => String(s ?? '').trim().toLowerCase()
/** Every person in an organization + business unit, logins and demo people alike. */
export const buPeopleIds = (organization, businessUnit) =>
  [...Object.keys(EMPLOYEES), ...Object.keys(PEOPLE)].filter((id) => {
    const p = profileOf(id)
    return p && norm(p.organization) === norm(organization) && norm(p.businessUnit) === norm(businessUnit)
  })

export const CYCLE = { id: 'c-h2-fy26', name: 'H2 FY26 Skills Cycle', opens: '2026-10-01', due: '2026-11-15' }
export const PREVIOUS_CYCLE = { id: 'c-h1-fy26', name: 'H1 FY26 Skills Cycle', closed: '2026-04-30' }

/** Stable pseudo-random number in [0, 1) from a string, so demo numbers don't change between requests. */
export function rand(key) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  h ^= h >>> 13
  return ((h >>> 0) % 10000) / 10000
}

export const percentToScore = (pct, bands) => {
  const p = Math.round(pct)
  return p <= bands.s1Max ? 1 : p <= bands.s2Max ? 2 : 3
}

/** Manager's task-level Yes/No answers for one cluster, plus the derived and (maybe) calibrated score. */
export function demoManager(userId, skillId, taskIds, bands) {
  const lean = 0.35 + rand(`${userId}|${skillId}|lean`) * 0.6
  const answers = taskIds.map((id) => {
    const r = rand(`${userId}|${id}`)
    return { taskId: id, answer: r > 0.94 ? 'na' : r < lean ? 'yes' : 'no' }
  })
  const applicable = answers.filter((a) => a.answer !== 'na')
  const yes = applicable.filter((a) => a.answer === 'yes').length
  const pct = applicable.length ? (yes / applicable.length) * 100 : null
  const original = pct == null ? 0 : percentToScore(pct, bands)
  // Roughly one cluster in five gets nudged by the skip manager.
  const shift = rand(`${userId}|${skillId}|cal`)
  let calibrated = original
  let reason = null
  if (original && shift > 0.8) {
    calibrated = Math.min(3, original + 1)
    reason = 'Observed on recent line-trial; skip manager raised the rating.'
  } else if (original && shift < 0.06) {
    calibrated = Math.max(1, original - 1)
    reason = 'Evidence not sufficient for the higher band; skip manager lowered the rating.'
  }
  return { answers, yes, applicable: applicable.length, pct, original, calibrated, reason, status: original ? 'calibrated' : 'pending' }
}

/** Last cycle's results for the growth comparison: usually a bit lower than today. */
export function demoPrevious(userId, skillId, now) {
  const dropM = 8 + rand(`${userId}|${skillId}|pm`) * 30
  const dropT = 5 + rand(`${userId}|${skillId}|pt`) * 28
  const sign = rand(`${userId}|${skillId}|sign`) > 0.88 ? -0.4 : 1 // occasionally slipped back
  const clamp = (v) => Math.max(5, Math.min(100, Math.round(v)))
  return {
    managerPct: now.managerPct == null ? null : clamp(now.managerPct - dropM * sign),
    testPct: clamp((now.testPct ?? 55 + rand(`${userId}|${skillId}|base`) * 30) - dropT * sign),
  }
}
