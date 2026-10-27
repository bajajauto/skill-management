import { readSheet } from 'read-excel-file/browser'
import type { Config, Difficulty, Question, SkillNode } from '../types'
import { uid } from './defaults'

type Row = (string | number | boolean | Date | null | undefined)[]

const str = (v: Row[number]) => (v == null ? '' : String(v).trim())
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). */
function parseCsv(text: string): Row[] {
  const rows: Row[] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export async function readTable(file: File): Promise<Row[]> {
  const name = file.name.toLowerCase()
  const rows = name.endsWith('.csv')
    ? parseCsv((await file.text()).replace(/^﻿/, ''))
    : ((await readSheet(file)) as Row[])
  return rows.filter((r) => r.some((c) => str(c) !== ''))
}

/** Finds the header row (first row with >= 2 recognised headers) and maps header aliases to column indexes. */
function mapColumns(rows: Row[], aliases: Record<string, string[]>) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const cols: Record<string, number> = {}
    rows[r].forEach((cell, idx) => {
      const key = norm(str(cell))
      for (const [field, names] of Object.entries(aliases)) {
        if (cols[field] === undefined && names.includes(key)) cols[field] = idx
      }
    })
    if (Object.keys(cols).length >= 2) return { headerRow: r, cols }
  }
  return null
}

export interface ImportResult<T> {
  items: T[]
  errors: string[]
  warnings: string[]
}

/* ---------------------------------- Skills ---------------------------------- */

export function parseSkillRows(rows: Row[], config: Config, existing: SkillNode[]): ImportResult<SkillNode> {
  const out: ImportResult<SkillNode> = { items: [], errors: [], warnings: [] }
  const map = mapColumns(rows, {
    skill: ['skill', 'skillcluster', 'cluster', config.labels.skill.toLowerCase().replace(/[^a-z0-9]/g, '')],
    subskill: ['subskill', 'subskills', norm(config.labels.subskill)],
    task: ['task', 'tasks', norm(config.labels.task)],
    level: ['level', 'proficiencylevel', 'proficiency'],
    description: ['description', 'expectedproficiencydescription', 'details'],
    critical: ['critical', 'criticalskill', 'iscritical'],
  })
  if (!map || map.cols.skill === undefined || (map.cols.subskill === undefined && map.cols.task === undefined)) {
    out.errors.push('Could not find the required "Skill" plus "Sub-skill" or "Task" column headers in the first rows of this file.')
    return out
  }
  const { cols, headerRow } = map
  const hasTasks = cols.task !== undefined && rows.slice(headerRow + 1).some((row) => str(row[cols.task]) !== '')
  const hasSub = cols.subskill !== undefined && rows.slice(headerRow + 1).some((row) => str(row[cols.subskill]) !== '')
  if (!hasSub && !hasTasks) {
    out.errors.push('The file has no sub-skill or task values to assess.')
    return out
  }
  const levelByName = new Map(config.levels.map((l) => [norm(l.name), l.id]))
  const index = new Map<string, SkillNode>()
  const key = (type: string, parent: string | null, name: string) => `${type}|${parent ?? ''}|${name.toLowerCase()}`
  for (const n of existing) index.set(key(n.type, n.parentId, n.name), n)

  const ensure = (type: SkillNode['type'], parent: string | null, name: string, extra: Partial<SkillNode> = {}) => {
    const k = key(type, parent, name)
    let node = index.get(k)
    if (!node) {
      node = { id: uid(), type, parentId: parent, name, description: '', levelId: null, critical: false, ...extra }
      index.set(k, node)
      out.items.push(node)
    }
    return node
  }

  let lastSkill = '',
    lastSub = ''
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r]
    const line = r + 1
    // Blank cells inherit from the row above, so merged-cell style sheets import correctly.
    const skillName = str(row[cols.skill]) || lastSkill
    const subName = hasSub && cols.subskill !== undefined ? str(row[cols.subskill]) || (str(row[cols.skill]) ? '' : lastSub) : ''
    const taskName = hasTasks && cols.task !== undefined ? str(row[cols.task]) : ''
    if (!skillName) {
      out.errors.push(`Row ${line}: missing ${config.labels.skill.toLowerCase()} name.`)
      continue
    }
    lastSkill = skillName
    lastSub = subName
    const skill = ensure('skill', null, skillName, {
      critical: cols.critical !== undefined && /^(y|yes|true|1)$/i.test(str(row[cols.critical])),
    })
    let parent = skill
    if (hasSub && subName) parent = ensure('subskill', skill.id, subName)
    const levelText = cols.level !== undefined ? str(row[cols.level]) : ''
    let levelId: string | null = null
    if (levelText) {
      levelId = levelByName.get(norm(levelText)) ?? null
      if (!levelId) out.warnings.push(`Row ${line}: level "${levelText}" is not one of your proficiency levels, so the assessment item was left unassigned.`)
    }
    if (!hasTasks) {
      if (parent.type === 'subskill' && levelId) {
        const pos = out.items.findIndex((n) => n.id === parent.id)
        if (pos >= 0) out.items[pos] = { ...parent, levelId, description: cols.description !== undefined ? str(row[cols.description]) : '' }
      }
      continue
    }
    if (!taskName) continue
    const k = key('task', parent.id, taskName)
    if (index.has(k)) {
      out.warnings.push(`Row ${line}: "${taskName}" already exists under "${parent.name}" and was skipped.`)
      continue
    }
    ensure('task', parent.id, taskName, {
      levelId,
      description: cols.description !== undefined ? str(row[cols.description]) : '',
    })
  }
  return out
}

/* --------------------------------- Questions -------------------------------- */

const DIFF: Record<string, Difficulty> = {
  easy: 'easy', e: 'easy', low: 'easy', '1': 'easy',
  medium: 'medium', m: 'medium', med: 'medium', moderate: 'medium', '2': 'medium',
  hard: 'hard', h: 'hard', high: 'hard', difficult: 'hard', '3': 'hard',
}

export interface QuestionImportOptions {
  skills: SkillNode[]
  config: Config
  defaultSkillId: string | null
  defaultLevelId: string | null
}

export function parseQuestionRows(rows: Row[], opts: QuestionImportOptions): ImportResult<Question> {
  const out: ImportResult<Question> = { items: [], errors: [], warnings: [] }
  const map = mapColumns(rows, {
    text: ['questiontext', 'question'],
    a: ['optiona', 'a'],
    b: ['optionb', 'b'],
    c: ['optionc', 'c'],
    d: ['optiond', 'd'],
    correct: ['correctanswer', 'answer', 'correct'],
    difficulty: ['difficultylevel', 'difficulty'],
    explanation: ['answerexplanation', 'explanation'],
    topic: ['topic'],
    skill: ['skill', 'skillcluster'],
    level: ['level', 'proficiencylevel'],
  })
  if (!map || map.cols.text === undefined) {
    out.errors.push('Could not find a "Question Text" column. Use the question bank template.')
    return out
  }
  const { cols, headerRow } = map
  const skillByName = new Map(opts.skills.filter((s) => s.type === 'skill').map((s) => [norm(s.name), s.id]))
  const levelByName = new Map(opts.config.levels.map((l) => [norm(l.name), l.id]))
  const seen = new Set<string>()
  const cell = (row: Row, f: string) => (cols[f] === undefined ? '' : str(row[cols[f]]))

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r]
    const line = r + 1
    const text = cell(row, 'text')
    if (!text) continue
    if (seen.has(text.toLowerCase())) {
      out.warnings.push(`Row ${line}: duplicate question text skipped.`)
      continue
    }
    seen.add(text.toLowerCase())
    const diffRaw = cell(row, 'difficulty').toLowerCase()
    const difficulty = DIFF[diffRaw]
    if (!difficulty) out.warnings.push(`Row ${line}: difficulty "${diffRaw || '(blank)'}" not recognised, defaulted to Medium.`)

    let correct = cell(row, 'correct').toUpperCase().replace(/[^ABCD]/g, '').slice(0, 1)
    const options: Question['options'] = [cell(row, 'a'), cell(row, 'b'), cell(row, 'c'), cell(row, 'd')]
    if (!correct) {
      // Some sheets put the full answer text instead of a letter.
      const ans = cell(row, 'correct').toLowerCase()
      const idx = ans ? options.findIndex((o) => o.toLowerCase() === ans) : -1
      if (idx >= 0) correct = 'ABCD'[idx]
    }
    if (!correct) out.warnings.push(`Row ${line}: no valid correct answer (A-D).`)

    const topic = cell(row, 'topic')
    const skillText = cell(row, 'skill') || topic
    const skillId = skillByName.get(norm(skillText)) ?? opts.defaultSkillId
    const levelText = cell(row, 'level')
    const levelId = (levelText && levelByName.get(norm(levelText))) || opts.defaultLevelId

    out.items.push({
      id: uid(),
      text,
      options,
      correct: correct as Question['correct'],
      explanation: cell(row, 'explanation'),
      difficulty: difficulty ?? 'medium',
      topic,
      skillId: skillId ?? null,
      levelId: levelId ?? null,
      active: true,
    })
  }
  if (!out.items.length && !out.errors.length) out.errors.push('No question rows found in this file.')
  return out
}

/* --------------------------------- Templates -------------------------------- */

export function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
export const toCsv = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n')

export function skillTemplate(config: Config): string {
  const sub = config.structure !== 'skill-task'
  const task = config.structure !== 'skill-subskill'
  const head = [config.labels.skill, ...(sub ? [config.labels.subskill] : []), ...(task ? [config.labels.task] : []), 'Level', 'Description', 'Critical']
  const [l1, l2] = config.levels.map((l) => l.name)
  const row = (s: string, sb: string, t: string, l: string, d: string, c: string) =>
    [s, ...(sub ? [sb] : []), ...(task ? [t] : []), l, d, c]
  return toCsv([
    head,
    row('Machining Operations', 'CNC Setup', 'Load and verify a work offset', l1 ?? 'Basic', 'Can set and confirm offsets unaided', 'Yes'),
    row('Machining Operations', 'CNC Setup', 'Optimise tool path for cycle time', l2 ?? l1 ?? 'Intermediate', '', ''),
  ])
}

export const questionTemplate = () =>
  toCsv([
    ['Difficulty Level', 'Correct Answer', 'Question Text', 'Option (A)', 'Option (B)', 'Option (C)', 'Option (D)', 'Answer Explanation', 'Topic'],
    ['Easy', 'B', 'What does a work offset define?', 'Tool length', 'Part zero position', 'Spindle speed', 'Coolant flow', 'Offsets locate part zero.', 'Machining Operations'],
  ])
