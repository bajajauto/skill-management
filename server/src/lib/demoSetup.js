// Demo-only seed: a published framework, question bank and some starting progress for the demo employee.
import { CYCLE, EMPLOYEES, percentToScore } from './demoEmployee.js'
import { readDoc, writeDoc } from '../storage.js'
import { LEVELS, defaultConfig, listCohorts, loadCohort, publishedFor, saveCohort } from './cohorts.js'

const [B, I, A] = LEVELS.map((l) => l.id)

// skill -> { name, critical, description, groups: [ [subskill, [[level, task], ...]], ... ] }
const SKILLS = {
  cnc: {
    name: 'CNC Machining',
    critical: true,
    description: 'Set up, program and run CNC machines to drawing and cycle-time targets.',
    groups: [
      ['Setup & programming', [[B, 'Load and verify a work offset'], [B, 'Mount fixtures and check runout'], [B, 'Run a program in single-block mode'], [I, 'Optimise a toolpath for cycle time'], [A, 'Develop a multi-setup process plan']]],
      ['Tooling', [[B, 'Select tools from the process sheet'], [B, 'Measure tool length and enter offsets'], [I, 'Diagnose chatter and tune parameters']]],
    ],
  },
  quality: {
    name: 'Quality & Metrology',
    critical: false,
    description: 'Measure parts accurately and use data to keep processes in control.',
    groups: [
      ['Measurement', [[B, 'Measure with vernier and micrometer'], [B, 'Record results on the check sheet'], [I, 'Run a gauge R&R study']]],
      ['GD&T and SPC', [[B, 'Read a basic dimensional drawing'], [I, 'Interpret a GD&T callout'], [I, 'Plot and read an X-bar chart'], [A, 'Calculate and act on Cpk']]],
    ],
  },
  lean: {
    name: 'Lean & Continuous Improvement',
    critical: false,
    description: 'Remove waste and solve problems at the source.',
    groups: [
      ['Workplace organisation', [[B, 'Sort and label the workstation (5S)'], [B, 'Follow standard work instructions']]],
      ['Problem solving', [[B, 'Raise an abnormality with the right person'], [B, 'Complete a 5 Whys analysis'], [I, 'Lead a kaizen mini-project']]],
    ],
  },
  tpm: {
    name: 'Maintenance & TPM',
    critical: false,
    description: 'Keep equipment reliable through daily care and early fault detection.',
    groups: [
      ['Daily care', [[B, 'Perform daily machine checks'], [B, 'Lubricate to schedule'], [B, 'Apply lockout/tagout']]],
      ['Reliability', [[I, 'Log downtime and calculate OEE'], [A, 'Run a root-cause analysis on a repeat failure']]],
    ],
  },
  safety: {
    name: 'Safety & Compliance',
    critical: true,
    description: 'Work safely and help keep everyone around you safe.',
    groups: [
      ['Personal safety', [[B, 'Wear and inspect PPE'], [B, 'Follow machine guarding rules'], [B, 'Lift and move loads safely']]],
      ['Reporting and response', [[B, 'Report a near-miss'], [B, 'Respond to a spill or fire alarm'], [I, 'Conduct a job safety analysis']]],
    ],
  },
  comm: {
    name: 'Stakeholder Communication',
    critical: false,
    description: 'Share the right information with the right people at the right time.',
    groups: [
      ['Day-to-day updates', [[B, 'Write a concise status update'], [B, 'Raise a blocker with the right owner'], [I, 'Run a short shift hand-over briefing']]],
      ['Collaboration', [[B, 'Give a clear verbal hand-off'], [I, 'Resolve conflicting priorities'], [A, 'Present findings to leadership']]],
    ],
  },
}

let pos = 0
// Each question: [skill, level, difficulty, text, correct, [3 wrong], explanation]. The correct option rotates through A-D.
const QUESTIONS = [
  ['cnc', B, 'easy', 'What does a work offset (such as G54) define on a CNC machine?', 'The position of part zero relative to machine zero', ['The tool length', 'The spindle speed limit', 'The coolant pressure'], 'A work offset stores where part zero sits relative to machine zero.'],
  ['cnc', B, 'easy', 'Which M-code normally starts the spindle clockwise?', 'M03', ['M05', 'M08', 'M30'], 'M03 starts the spindle clockwise; M05 stops it.'],
  ['cnc', B, 'easy', 'Before running a new program for the first time you should:', 'Dry run or single-block it at reduced feed', ['Run it at 100% feed to save time', 'Skip the tool check', 'Disable the door interlock'], 'A first run at reduced feed lets you catch errors before they become crashes.'],
  ['cnc', B, 'medium', 'A tool length offset is used to:', 'Make the tool tip reach the correct Z position', ['Change the spindle direction', 'Set the feed rate', 'Select the coolant type'], 'Different tools stick out different amounts; the offset compensates.'],
  ['cnc', B, 'medium', 'Excess runout on a clamped workpiece most likely causes:', 'Faster tool wear and a poor surface finish', ['Lower spindle load', 'Better accuracy', 'A shorter cycle time'], 'Runout makes the cutting load uneven, wearing the tool and marking the finish.'],
  ['cnc', B, 'medium', 'Which action best reduces chatter in a boring operation?', 'Reduce tool overhang or use a stiffer holder', ['Increase the overhang', 'Increase the depth of cut', 'Use a duller insert'], 'Stiffness is the main defence against chatter.'],
  ['cnc', B, 'hard', 'A stable process leaves every part 0.05 mm oversize. The best first correction is to:', 'Adjust the tool wear offset by the error', ['Rewrite the whole program', 'Increase the feed rate', 'Replace the machine'], 'A steady, systematic error is corrected with the wear offset.'],
  ['cnc', I, 'medium', 'Which roughing strategy cuts cycle time without raising tool load?', 'A constant-engagement (trochoidal) toolpath', ['A single deep full-width pass', 'A lower spindle speed', 'More tool changes'], 'Constant engagement keeps the load steady so you can run faster.'],
  ['cnc', I, 'hard', 'Why use high-pressure through-spindle coolant when drilling deep holes?', 'To clear chips and cool the cutting edge', ['To increase spindle speed', 'To reduce tool cost', 'It is cosmetic only'], 'Chip evacuation is the main limit in deep-hole drilling.'],

  ['quality', B, 'easy', 'Which instrument suits measuring an outside diameter to 0.01 mm?', 'A micrometer', ['A steel rule', 'A tape measure', 'A protractor'], 'A micrometer resolves 0.01 mm; a rule does not.'],
  ['quality', B, 'easy', 'Before measuring, a micrometer should be:', 'Zeroed and checked against a standard', ['Oiled heavily', 'Warmed in your hand for five minutes', 'Locked closed overnight'], 'Always verify zero before relying on a reading.'],
  ['quality', B, 'easy', 'A calibration sticker on a gauge shows:', 'The date the next calibration is due', ['The purchase price', 'The operator name', 'The supplier'], 'Out-of-date gauges must not be used.'],
  ['quality', B, 'medium', 'A GD&T flatness callout of 0.05 means the surface must lie between:', 'Two parallel planes 0.05 apart', ['Two circles 0.05 apart', 'A cylinder 0.05 in diameter', 'Datum A and datum B'], 'Flatness is a zone between two parallel planes.'],
  ['quality', B, 'medium', 'A gauge R&R study shows 35% variation. This means the measurement system is:', 'Not acceptable for this tolerance', ['Excellent', 'Acceptable', 'Irrelevant to part quality'], 'Above about 30% is generally unacceptable.'],
  ['quality', B, 'medium', 'Cpk is noticeably lower than Cp. This suggests the process is:', 'Off-centre', ['Perfectly centred', 'Free of variation', 'Measured with too large a sample'], 'Cp ignores centring; Cpk penalises it.'],
  ['quality', B, 'hard', 'A feature has a tolerance of ±0.02 mm. A sensible gauge resolution is about:', '0.002 mm', ['0.02 mm', '0.1 mm', '0.01 mm'], 'Rule of ten: resolution about one tenth of the 0.04 band, so 0.004 or finer.'],
  ['quality', I, 'medium', 'Which datum should usually be called out first on a drawing?', 'The most functional locating surface', ['The roughest surface', 'The smallest feature', 'Any surface at random'], 'The primary datum should reflect how the part locates in use.'],

  ['lean', B, 'easy', 'What does the first S of 5S stand for?', 'Sort', ['Shine', 'Standardise', 'Sustain'], 'Sort: remove what is not needed.'],
  ['lean', B, 'easy', 'Which of these is one of the seven wastes?', 'Overproduction', ['Training', 'Safety checks', 'Cleaning'], 'Overproduction is making more than the next step needs.'],
  ['lean', B, 'easy', 'Takt time is:', 'Available time divided by customer demand', ['The time to set up a machine', 'The cycle time of the slowest machine', 'Operator break time'], 'Takt sets the pace the customer needs.'],
  ['lean', B, 'medium', 'Which method finds a root cause by repeatedly asking why?', '5 Whys', ['Gantt chart', 'SWOT analysis', 'Pareto chart'], 'Keep asking why until you reach something you can fix.'],
  ['lean', B, 'medium', 'A Pareto chart is used to:', 'Rank causes by frequency so you focus on the vital few', ['Show a trend over time', 'Map process steps', 'Schedule tasks'], 'It shows where the biggest share of the problem is.'],
  ['lean', B, 'medium', 'Kaizen means:', 'Continuous small improvements', ['A one-time overhaul', 'Cost cutting', 'Final inspection'], 'Small, steady changes by everyone.'],
  ['lean', B, 'hard', 'Cycle time is 50 s and takt is 60 s, yet the line misses its output. The likeliest cause is:', 'Unplanned stops or changeovers reducing availability', ['Takt time is too high', 'The cycle time is too low', 'There are too many operators'], 'The cycle looks fine on paper, so lost time is the usual culprit.'],

  ['tpm', B, 'easy', 'Autonomous maintenance means operators:', 'Do basic cleaning, inspection and lubrication', ['Repair major faults', 'Replace machines', 'Skip routine checks'], 'Operators look after the basics so specialists can focus on bigger work.'],
  ['tpm', B, 'easy', 'A lockout/tagout procedure is used to:', 'Prevent accidental energisation during servicing', ['Speed up maintenance', 'Reduce spares cost', 'Record machine output'], 'It protects people working on equipment.'],
  ['tpm', B, 'easy', 'Which is an example of preventive maintenance?', 'Scheduled lubrication every shift', ['Fixing after a breakdown', 'Waiting for a noise', 'Replacing a part only when it fails'], 'Preventive work happens before failure.'],
  ['tpm', B, 'medium', 'OEE is the product of:', 'Availability, performance and quality', ['Cost, time and scope', 'Speed and price', 'Safety and 5S'], 'OEE = availability x performance x quality.'],
  ['tpm', B, 'medium', 'MTBF measures:', 'The average time between failures', ['The average time to repair', 'Maintenance cost', 'Machine age'], 'Mean time between failures: higher is better.'],
  ['tpm', B, 'medium', 'A rising vibration trend on a spindle most likely indicates:', 'Bearing wear', ['Better lubrication', 'A cooler workshop', 'A sharper tool'], 'Increasing vibration is a classic early sign of bearing wear.'],
  ['tpm', B, 'hard', 'Availability is 90%, performance 95%, quality 98%. OEE is about:', '84%', ['92%', '78%', '95%'], '0.90 x 0.95 x 0.98 is roughly 0.84.'],

  ['safety', B, 'easy', 'Which PPE is mandatory when operating a CNC machine?', 'Safety glasses', ['Loose gloves', 'Open sandals', 'Headphones'], 'Eye protection is required; loose gloves can be caught by rotating parts.'],
  ['safety', B, 'easy', 'A machine guard interlock may be bypassed:', 'Never, without formal authorisation', ['When you are running late', 'During a tool change', 'When the supervisor is away'], 'Interlocks exist to stop the machine when the guard opens.'],
  ['safety', B, 'easy', 'You see a coolant spill on the walkway. You should:', 'Barricade or clean it and report it straight away', ['Walk around it', 'Wait until end of shift', 'Assume someone else will'], 'Slip hazards are dealt with immediately.'],
  ['safety', B, 'medium', 'Near-miss reporting matters because it:', 'Identifies hazards before someone is hurt', ['Assigns blame', 'Only applies to injuries', 'Replaces training'], 'Near misses are free lessons.'],
  ['safety', B, 'medium', 'For a 25 kg fixture, safe handling means:', 'Using a lifting aid or a team lift with a straight back', ['Bending at the waist', 'Twisting while lifting', 'Lifting quickly to finish sooner'], 'Use equipment or help, and keep your back straight.'],
  ['safety', B, 'medium', 'Which extinguisher is suitable for an electrical fire?', 'CO2', ['Water', 'Foam', 'Wet chemical'], 'CO2 does not conduct electricity.'],
  ['safety', B, 'hard', 'The hierarchy of controls, most effective first, is:', 'Elimination, substitution, engineering, administrative, PPE', ['PPE, administrative, engineering, substitution, elimination', 'Administrative, PPE, elimination, engineering, substitution', 'Engineering, PPE, substitution, elimination, administrative'], 'Remove the hazard if you can; PPE is the last line of defence.'],

  ['comm', B, 'easy', 'A good status update is:', 'Concise: facts, impact and the next step', ['As long and detailed as possible', 'Verbal only', 'Sent only when asked'], 'Readers should grasp it in seconds.'],
  ['comm', B, 'easy', 'You hit a blocker you cannot resolve. You should:', 'Escalate to the right owner with context', ['Wait and hope', 'Work around it quietly', 'Tell the team who is to blame'], 'Early escalation with facts saves time.'],
  ['comm', B, 'easy', 'Active listening includes:', 'Paraphrasing to confirm you understood', ['Interrupting to save time', 'Multitasking', 'Planning your reply while they talk'], 'Playing it back catches misunderstandings.'],
  ['comm', B, 'medium', 'For a urgent line-stop issue, the best first channel is:', 'A direct call or in-person, followed by a written note', ['Email only', 'The monthly newsletter', 'A social media post'], 'Urgent issues need real-time contact, then a record.'],
  ['comm', B, 'medium', 'In SBAR, the letters stand for:', 'Situation, Background, Assessment, Recommendation', ['Summary, Brief, Action, Result', 'Scope, Budget, Approval, Review', 'Status, Blocker, Action, Risk'], 'SBAR is a short structure for handing over critical information.'],
  ['comm', B, 'medium', 'Two stakeholders give conflicting priorities. You should:', 'Surface the conflict and agree the priority with both', ['Quietly choose one', 'Ignore both', 'Do half of each'], 'Make the trade-off visible and get a decision.'],
  ['comm', B, 'hard', 'Constructive feedback is best given as:', 'Specific behaviour, its impact and a suggested change', ['A general impression', 'A public comment', 'Only when things go wrong'], 'Specific and actionable beats general.'],
]

export function buildSeedSetup() {
  const nodes = []
  Object.entries(SKILLS).forEach(([key, s]) => {
    nodes.push({ id: `sk-${key}`, type: 'skill', parentId: null, name: s.name, description: s.description, levelId: null, critical: s.critical })
    s.groups.forEach(([group, tasks], gi) => {
      const subId = `sb-${key}-${gi + 1}`
      nodes.push({ id: subId, type: 'subskill', parentId: `sk-${key}`, name: group, description: '', levelId: null, critical: false })
      tasks.forEach(([level, name], ti) => nodes.push({ id: `tk-${key}-${gi + 1}-${ti + 1}`, type: 'task', parentId: subId, name, description: '', levelId: level, critical: false }))
    })
  })

  pos = 0
  const counters = {}
  const questions = QUESTIONS.map(([skill, level, difficulty, text, correct, wrong, explanation]) => {
    const at = pos++ % 4
    const options = [...wrong]
    options.splice(at, 0, correct)
    counters[skill] = (counters[skill] ?? 0) + 1
    return { id: `q-${skill}-${counters[skill]}`, text, options, correct: 'ABCD'[at], explanation, difficulty, topic: SKILLS[skill].name, skillId: `sk-${skill}`, levelId: level, active: true }
  })

  return { config: defaultConfig('BAL', 'Powertrain'), nodes, questions }
}

/** Starting progress for the demo employee: a few tests done and a self assessment in draft. */
export function buildSeedEmployeeDoc(setup, meta = { cohortId: 'bal-powertrain', version: 1 }) {
  const { weights, test: bands } = setup.config.scoring
  // skill key -> indexes (within its basic questions) that were answered wrongly
  const takes = { cnc: [6], safety: [], tpm: [3, 5, 6] }
  const attempts = Object.entries(takes).flatMap(([key, wrongIdx], n) => {
    const pool = setup.questions.filter((q) => q.skillId === `sk-${key}` && q.levelId === B)
    if (!pool.length) return [] // the framework was edited, nothing to seed
    const answers = {}
    let earned = 0
    let possible = 0
    let correct = 0
    pool.forEach((q, i) => {
      const w = weights[q.difficulty]
      possible += w
      const right = !wrongIdx.includes(i)
      answers[q.id] = right ? q.correct : 'ABCD'.replace(q.correct, '')[0]
      if (right) {
        earned += w
        correct++
      }
    })
    const pct = (earned / possible) * 100
    return [{
      id: `seed-attempt-${key}`,
      skillId: `sk-${key}`,
      levelId: B,
      cycleId: CYCLE.id,
      cohortId: meta.cohortId,
      version: meta.version,
      questionIds: pool.map((q) => q.id),
      startedAt: new Date(Date.now() - (n + 2) * 86_400_000).toISOString(),
      status: 'submitted',
      submittedAt: new Date(Date.now() - (n + 2) * 86_400_000 + 900_000).toISOString(),
      answers,
      pct,
      score: percentToScore(pct, bands),
      correct,
    }]
  })
  return {
    currentLevelId: B,
    self: {
      ratings: {
        'sk-cnc': { rating: 2, comment: 'Comfortable on setups, still learning offsets on the new 5-axis.' },
        'sk-quality': { rating: 3, comment: '' },
        'sk-lean': { rating: 1, comment: '' },
      },
      submittedAt: null,
    },
    attempts,
    reflection: { proud: '', focus: '', support: '', savedAt: null },
  }
}

const clone = (x) => JSON.parse(JSON.stringify(x))

/**
 * First run: turn a pre-cohort single framework (the old setup document) into the BAL Powertrain cohort,
 * or seed the demo cohorts when there is nothing yet. Never overwrites cohorts that already exist.
 */
export async function ensureSeed() {
  let seeded = false
  if (!(await listCohorts()).length) {
    const now = new Date().toISOString()
    const old = await readDoc('setup')
    const hasOld = old && (old.publication || old.nodes?.length || old.questions?.length)
    const draft = hasOld ? { config: { ...old.config, organization: old.config?.organization || 'BAL', businessUnit: old.config?.businessUnit || 'Powertrain' }, nodes: old.nodes, questions: old.questions } : buildSeedSetup()
    delete draft.config.department
    await saveCohort({
      id: 'bal-powertrain',
      createdAt: now,
      updatedAt: now,
      draft,
      versions: !hasOld || old.publication ? [{ version: old?.publication?.version ?? 1, at: old?.publication?.at ?? now, state: clone(draft) }] : [],
    })
    // A second cohort that is still being set up, so the cohort list shows both states.
    await saveCohort({ id: 'bacl-sales', createdAt: new Date(Date.now() + 1000).toISOString(), updatedAt: now, draft: { config: defaultConfig('BACL', 'Sales'), nodes: [], questions: [] }, versions: [] })
    seeded = true
  }
  // One-time: a finished cohort so the Completed state has something to show. Deleting it later keeps it deleted.
  if (!(await readDoc('meta/completed-demo'))) {
    if (!(await loadCohort('baf-finance'))) {
      const draft = buildSeedSetup()
      draft.config.organization = 'BAF'
      draft.config.businessUnit = 'Finance'
      const done = new Date(Date.now() - 20 * 86_400_000).toISOString()
      await saveCohort({ id: 'baf-finance', createdAt: new Date(Date.now() - 200 * 86_400_000).toISOString(), updatedAt: done, draft, versions: [{ version: 1, at: new Date(Date.now() - 120 * 86_400_000).toISOString(), state: clone(draft) }], closedAt: done })
    }
    await writeDoc('meta/completed-demo', { at: new Date().toISOString() })
  }
  // People added to the demo later (e.g. the manager) get starting progress without touching anyone else's.
  for (const [userId, profile] of Object.entries(EMPLOYEES)) {
    const fw = await publishedFor(profile)
    if (!fw?.state.nodes?.some((n) => n.id === 'sk-cnc')) continue
    if (seeded || !(await readDoc(`employees/${userId}`))) await writeDoc(`employees/${userId}`, buildSeedEmployeeDoc(fw.state, { cohortId: fw.cohortId, version: fw.version }))
  }
  return seeded
}