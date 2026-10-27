import { useCallback, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useDispatch, useStore } from '../../store'
import { Badge, Button, Card, ConfirmDialog, Dialog, Empty, Field, Segmented, SetupGuide, useToast } from '../../components/ui'
import { ImportDialog } from '../../components/ImportDialog'
import { downloadText, parseQuestionRows, questionTemplate } from '../../lib/importers'
import { uid } from '../../lib/defaults'
import type { Difficulty, Question } from '../../types'

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export function Questions() {
  const { config, nodes, questions } = useStore()
  const dispatch = useDispatch()
  const toast = useToast()
  const skills = useMemo(() => nodes.filter((n) => n.type === 'skill'), [nodes])
  const skillName = (id: string | null) => skills.find((s) => s.id === id)?.name
  const levelName = (id: string | null) => config.levels.find((l) => l.id === id)?.name

  const [filter, setFilter] = useState({ q: '', skill: '', level: '', diff: '', mapping: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [edit, setEdit] = useState<Question | null>(null)
  const [importing, setImporting] = useState(false)
  const [delIds, setDelIds] = useState<string[] | null>(null)
  const [bulk, setBulk] = useState<{ skillId: string; levelId: string } | null>(null)
  const [target, setTarget] = useState({ skillId: '', levelId: '' })

  const shown = useMemo(() => {
    const q = filter.q.trim().toLowerCase()
    return questions.filter(
      (x) =>
        (!q || x.text.toLowerCase().includes(q) || x.topic.toLowerCase().includes(q)) &&
        (!filter.skill || x.skillId === filter.skill) &&
        (!filter.level || x.levelId === filter.level) &&
        (!filter.diff || x.difficulty === filter.diff) &&
        (!filter.mapping || (filter.mapping === 'unmapped' ? !x.skillId || !x.levelId : x.skillId && x.levelId)),
    )
  }, [questions, filter])

  const unmapped = questions.filter((q) => !q.skillId || !q.levelId).length
  const allShownSelected = shown.length > 0 && shown.every((q) => selected.has(q.id))
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((q) => q.id)))
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })

  const newQuestion = (): Question => ({
    id: uid(),
    text: '',
    options: ['', '', '', ''],
    correct: '',
    explanation: '',
    difficulty: 'medium',
    topic: '',
    skillId: filter.skill || null,
    levelId: filter.level || null,
    active: true,
  })

  return (
    <div className="stack">
      <SetupGuide step="Step 3 of 5 · Build the question bank" title="Map knowledge questions to the framework" icon="questions">
        Upload or create objective questions, then map every active question to the correct skill and proficiency level. Resolve unmapped questions before publishing.
      </SetupGuide>
      <Card
        title="Question bank"
        description={`${questions.length} question${questions.length === 1 ? '' : 's'}${unmapped ? ` · ${unmapped} not yet mapped to a skill and level` : ''}`}
        action={
          <div className="btn-row">
            <Button size="sm" onClick={() => setImporting(true)}>
              <Upload size={14} /> Upload file
            </Button>
            <Button size="sm" variant="primary" onClick={() => setEdit(newQuestion())}>
              <Plus size={14} /> Add question
            </Button>
          </div>
        }
      >
        {questions.length === 0 ? (
          <Empty title="No questions yet">
            Upload your question bank using the template (difficulty, correct answer, question, options A–D, explanation, topic).
            <div className="btn-row center">
              <Button variant="primary" onClick={() => setImporting(true)}>
                <Upload size={14} /> Upload file
              </Button>
              <Button onClick={() => setEdit(newQuestion())}>Add manually</Button>
            </div>
          </Empty>
        ) : (
          <>
            <div className="filters">
              <input className="input" type="search" placeholder="Search questions or topics" aria-label="Search" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
              <select className="input" aria-label="Skill" value={filter.skill} onChange={(e) => setFilter({ ...filter, skill: e.target.value })}>
                <option value="">All {config.labels.skill.toLowerCase()}s</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select className="input" aria-label="Level" value={filter.level} onChange={(e) => setFilter({ ...filter, level: e.target.value })}>
                <option value="">All levels</option>
                {config.levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <select className="input" aria-label="Difficulty" value={filter.diff} onChange={(e) => setFilter({ ...filter, diff: e.target.value })}>
                <option value="">Any difficulty</option>
                {DIFFS.map((d) => (
                  <option key={d} value={d}>
                    {cap(d)}
                  </option>
                ))}
              </select>
              <select className="input" aria-label="Mapping" value={filter.mapping} onChange={(e) => setFilter({ ...filter, mapping: e.target.value })}>
                <option value="">Mapped &amp; unmapped</option>
                <option value="unmapped">Unmapped only</option>
                <option value="mapped">Mapped only</option>
              </select>
            </div>

            {selected.size > 0 && (
              <div className="bulkbar" role="region" aria-label="Bulk actions">
                <strong>{selected.size} selected</strong>
                <Button size="sm" onClick={() => (setTarget({ skillId: '', levelId: '' }), setBulk({ skillId: '', levelId: '' }))}>
                  Map to skill &amp; level
                </Button>
                <Button size="sm" onClick={() => (dispatch({ type: 'questions/active', ids: [...selected], active: false }), toast('Deactivated'))}>
                  Deactivate
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDelIds([...selected])}>
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            )}

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input type="checkbox" aria-label="Select all shown" checked={allShownSelected} onChange={toggleAll} />
                    </th>
                    <th>Question</th>
                    <th>{config.labels.skill}</th>
                    <th>Level</th>
                    <th>Difficulty</th>
                    <th className="col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((q) => (
                    <tr key={q.id} data-inactive={!q.active}>
                      <td className="col-check">
                        <input type="checkbox" aria-label="Select question" checked={selected.has(q.id)} onChange={() => toggleOne(q.id)} />
                      </td>
                      <td className="cell-text">
                        <span className="clamp" title={q.text}>
                          {q.text}
                        </span>
                        {!q.active && <Badge>Inactive</Badge>}
                        {!q.correct && <Badge tone="bad">No answer key</Badge>}
                      </td>
                      <td>{skillName(q.skillId) ?? <Badge tone="warn">Unmapped</Badge>}</td>
                      <td>{levelName(q.levelId) ?? <Badge tone="warn">Unmapped</Badge>}</td>
                      <td>
                        <Badge tone={q.difficulty === 'hard' ? 'bad' : q.difficulty === 'medium' ? 'warn' : 'good'}>{cap(q.difficulty)}</Badge>
                      </td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <button className="icon-btn" aria-label="Edit question" onClick={() => setEdit(q)}>
                            <Pencil size={14} />
                          </button>
                          <button className="icon-btn" aria-label="Delete question" onClick={() => setDelIds([q.id])}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        No questions match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {edit && <QuestionDialog key={edit.id} initial={edit} onClose={() => setEdit(null)} />}

      <ConfirmDialog
        open={delIds !== null}
        danger
        title={`Delete ${delIds?.length === 1 ? 'this question' : `${delIds?.length} questions`}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!delIds) return
          dispatch({ type: 'questions/delete', ids: delIds })
          setSelected((s) => new Set([...s].filter((id) => !delIds.includes(id))))
        }}
        onClose={() => setDelIds(null)}
      />

      <Dialog
        open={bulk !== null}
        onClose={() => setBulk(null)}
        title={`Map ${selected.size} question${selected.size === 1 ? '' : 's'}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulk(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!target.skillId && !target.levelId}
              onClick={() => {
                dispatch({
                  type: 'questions/assign',
                  ids: [...selected],
                  // A blank field is left untouched rather than cleared.
                  skillId: target.skillId || undefined,
                  levelId: target.levelId || undefined,
                })
                setBulk(null)
                setSelected(new Set())
                toast('Questions mapped')
              }}
            >
              Apply
            </Button>
          </>
        }
      >
        <div className="stack-sm">
          <SkillLevelPicker value={target} onChange={setTarget} />
        </div>
      </Dialog>

      <QuestionImport open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}

function SkillLevelPicker({ value, onChange }: { value: { skillId: string; levelId: string }; onChange: (v: { skillId: string; levelId: string }) => void }) {
  const { config, nodes } = useStore()
  return (
    <div className="grid-2">
      <Field label={config.labels.skill} htmlFor="pick-skill">
        <select id="pick-skill" className="input" value={value.skillId} onChange={(e) => onChange({ ...value, skillId: e.target.value })}>
          <option value="">Not set</option>
          {nodes
            .filter((n) => n.type === 'skill')
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Level" htmlFor="pick-level">
        <select id="pick-level" className="input" value={value.levelId} onChange={(e) => onChange({ ...value, levelId: e.target.value })}>
          <option value="">Not set</option>
          {config.levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}

function QuestionImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, nodes } = useStore()
  const dispatch = useDispatch()
  const [def, setDef] = useState({ skillId: '', levelId: '' })
  const skills = nodes.filter((n) => n.type === 'skill')
  const parse = useCallback(
    (rows: Parameters<typeof parseQuestionRows>[0]) =>
      parseQuestionRows(rows, { skills, config, defaultSkillId: def.skillId || null, defaultLevelId: def.levelId || null }),
    // `skills` is derived from `nodes`, so depend on that instead of the fresh array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, config, def],
  )
  return (
    <ImportDialog<Question>
      open={open}
      onClose={onClose}
      title="Upload question bank"
      intro={
        <>
          Uses the question bank template. A row's <strong>Topic</strong> (or an optional <strong>Skill</strong> column) is matched to your {config.labels.skill.toLowerCase()}s by name. Anything unmatched falls back to the defaults below, and you can
          remap later.
        </>
      }
      onTemplate={() => downloadText('question-bank-template.csv', questionTemplate())}
      extra={
        <div className="import-defaults">
          <p className="field-label">Default mapping for unmatched rows</p>
          <SkillLevelPicker value={def} onChange={setDef} />
        </div>
      }
      parse={parse}
      preview={(items) => {
        const mapped = items.filter((i) => i.skillId && i.levelId).length
        return (
          <p className="summary">
            Ready to add <strong>{items.length}</strong> questions. <strong>{mapped}</strong> mapped
            {items.length - mapped > 0 && (
              <>
                , <strong>{items.length - mapped}</strong> unmapped
              </>
            )}
            .
          </p>
        )
      }}
      commitLabel={(n) => `Add ${n} question${n === 1 ? '' : 's'}`}
      onCommit={(qs) => dispatch({ type: 'questions/add', questions: qs })}
    />
  )
}

function QuestionDialog({ initial, onClose }: { initial: Question; onClose: () => void }) {
  const { config } = useStore()
  const dispatch = useDispatch()
  const toast = useToast()
  const [q, setQ] = useState(initial)
  const isNew = initial.text === ''
  const valid = q.text.trim() && q.correct && q.options[['A', 'B', 'C', 'D'].indexOf(q.correct)]?.trim()

  const setOption = (i: number, v: string) => setQ({ ...q, options: q.options.map((o, j) => (j === i ? v : o)) as Question['options'] })

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={isNew ? 'Add question' : 'Edit question'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              dispatch({ type: 'question/save', question: { ...q, text: q.text.trim() } })
              toast(isNew ? 'Question added' : 'Question saved')
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="stack-sm">
        <Field label="Question text" htmlFor="q-text">
          <textarea id="q-text" className="input" rows={3} autoFocus value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} />
        </Field>
        <Field label="Options" hint="Select the radio next to the correct answer.">
          <div className="stack-xs">
            {(['A', 'B', 'C', 'D'] as const).map((letter, i) => (
              <div className="option-row" key={letter}>
                <input type="radio" name="correct" aria-label={`Option ${letter} is correct`} checked={q.correct === letter} onChange={() => setQ({ ...q, correct: letter })} />
                <span className="label-num">{letter}</span>
                <input className="input" aria-label={`Option ${letter}`} value={q.options[i]} onChange={(e) => setOption(i, e.target.value)} />
              </div>
            ))}
          </div>
        </Field>
        <Field label="Answer explanation" htmlFor="q-exp">
          <textarea id="q-exp" className="input" rows={2} value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} />
        </Field>
        <Field label="Difficulty">
          <Segmented
            label="Difficulty"
            value={q.difficulty}
            onChange={(difficulty) => setQ({ ...q, difficulty })}
            options={DIFFS.map((d) => ({ value: d, label: `${cap(d)} (${config.scoring.weights[d]} pt)` }))}
          />
        </Field>
        <SkillLevelPicker value={{ skillId: q.skillId ?? '', levelId: q.levelId ?? '' }} onChange={(v) => setQ({ ...q, skillId: v.skillId || null, levelId: v.levelId || null })} />
      </div>
    </Dialog>
  )
}

