import { useCallback, useState } from 'react'
import { ChevronRight, Pencil, Plus, Star, Trash2, Upload } from 'lucide-react'
import { useDerived, useDispatch, useStore } from '../../store'
import { Badge, Button, Card, ConfirmDialog, Dialog, Empty, Field, SetupGuide, Toggle } from '../../components/ui'
import { ImportDialog } from '../../components/ImportDialog'
import { downloadText, parseSkillRows, skillTemplate } from '../../lib/importers'
import { childTypeOf, uid } from '../../lib/defaults'
import type { SkillNode } from '../../types'

interface EditTarget {
  node: SkillNode
  isNew: boolean
}

export function Skills() {
  const { config, nodes, questions } = useStore()
  const dispatch = useDispatch()
  const { kids } = useDerived()
  const [open, setOpen] = useState<Set<string>>(() => new Set(nodes.filter((n) => n.type === 'skill').map((n) => n.id)))
  const [edit, setEdit] = useState<EditTarget | null>(null)
  const [del, setDel] = useState<SkillNode | null>(null)
  const [importing, setImporting] = useState(false)

  const roots = kids.get(null) ?? []
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })

  const add = (type: SkillNode['type'], parentId: string | null) => {
    if (parentId) setOpen((s) => new Set(s).add(parentId))
    setEdit({ isNew: true, node: { id: uid(), type, parentId, name: '', description: '', levelId: null, critical: false } })
  }

  const parse = useCallback((rows: Parameters<typeof parseSkillRows>[0]) => parseSkillRows(rows, config, nodes), [config, nodes])

  const counts = {
    skills: nodes.filter((n) => n.type === 'skill').length,
    subskills: nodes.filter((n) => n.type === 'subskill').length,
    tasks: nodes.filter((n) => n.type === 'task').length,
  }

  return (
    <div className="stack">
      <SetupGuide step="Step 2 of 5 · Load source data" title="Add the business unit's skill framework" icon="skills">
        Upload the approved skill matrix or build it manually. If the file contains tasks, the assessment rates tasks; if it ends at sub-skills, the assessment rates sub-skills.
      </SetupGuide>
      <Card
        title={`${config.labels.skill} library`}
        description={`${counts.skills} ${config.labels.skill.toLowerCase()}s${config.structure !== 'skill-task' ? `, ${counts.subskills} ${config.labels.subskill.toLowerCase()}s` : ''}${config.structure !== 'skill-subskill' ? `, ${counts.tasks} ${config.labels.task.toLowerCase()}s` : ''}`}
        action={
          <div className="btn-row">
            <Button size="sm" onClick={() => setImporting(true)}>
              <Upload size={14} /> Upload file
            </Button>
            <Button size="sm" variant="primary" onClick={() => add('skill', null)}>
              <Plus size={14} /> Add {config.labels.skill.toLowerCase()}
            </Button>
          </div>
        }
      >
        {roots.length === 0 ? (
          <Empty title={`No ${config.labels.skill.toLowerCase()}s yet`}>
            Upload a skill file to bring in your whole framework at once, or add them one by one.
            <div className="btn-row center">
              <Button variant="primary" onClick={() => setImporting(true)}>
                <Upload size={14} /> Upload file
              </Button>
              <Button onClick={() => add('skill', null)}>Add manually</Button>
            </div>
          </Empty>
        ) : (
          <ul className="tree" role="tree">
            {roots.map((n) => (
              <TreeNode key={n.id} node={n} depth={0} open={open} toggle={toggle} onAdd={add} onEdit={(node) => setEdit({ node, isNew: false })} onDelete={setDel} />
            ))}
          </ul>
        )}
      </Card>

      {edit && <NodeDialog key={edit.node.id} target={edit} onClose={() => setEdit(null)} />}

      <ConfirmDialog
        open={del !== null}
        danger
        title={`Delete "${del?.name}"?`}
        confirmLabel="Delete"
        message={
          del && (kids.get(del.id)?.length ?? 0) > 0
            ? `This also deletes everything beneath it. Questions mapped to deleted ${config.labels.skill.toLowerCase()}s become unmapped.`
            : questions.some((q) => q.skillId === del?.id)
              ? 'Questions mapped to this skill will become unmapped.'
              : 'This cannot be undone.'
        }
        onConfirm={() => del && dispatch({ type: 'node/delete', id: del.id })}
        onClose={() => setDel(null)}
      />

      <ImportDialog<SkillNode>
        open={importing}
        onClose={() => setImporting(false)}
        title="Upload skill file"
        intro={
          <>
            Upload either {config.labels.skill} → {config.labels.subskill} or {config.labels.skill} → {config.labels.subskill} → {config.labels.task}. The deepest populated column becomes the rating level automatically. Include Level, Description and Critical columns as needed. Blank {config.labels.skill.toLowerCase()} cells inherit from the row above.
          </>
        }
        onTemplate={() => downloadText('skill-framework-template.csv', skillTemplate(config))}
        parse={parse}
        preview={(items) => (
          <p className="summary">
            Ready to add <strong>{items.filter((i) => i.type === 'skill').length}</strong> {config.labels.skill.toLowerCase()}s,{' '}
            {items.some((i) => i.type === 'subskill') && (
              <>
                <strong>{items.filter((i) => i.type === 'subskill').length}</strong> {config.labels.subskill.toLowerCase()}s,{' '}
              </>
            )}
            <strong>{items.filter((i) => i.type === 'task').length}</strong> {config.labels.task.toLowerCase()}s.
          </p>
        )}
        commitLabel={(n) => `Add ${n} item${n === 1 ? '' : 's'}`}
        onCommit={(items) => {
          const hasTasks = items.some((i) => i.type === 'task')
          const hasSubskills = items.some((i) => i.type === 'subskill')
          const structure = hasTasks ? (hasSubskills ? 'skill-subskill-task' : 'skill-task') : 'skill-subskill'
          const ratedAt = hasTasks ? 'task' : 'subskill'
          dispatch({ type: 'structure', structure })
          dispatch({ type: 'config', update: (c) => ({ ...c, ratedAt }) })
          dispatch({ type: 'nodes/add', nodes: items })
          setOpen((s) => new Set([...s, ...items.filter((i) => i.type === 'skill').map((i) => i.id)]))
        }}
      />
    </div>
  )
}

function TreeNode({
  node,
  depth,
  open,
  toggle,
  onAdd,
  onEdit,
  onDelete,
}: {
  node: SkillNode
  depth: number
  open: Set<string>
  toggle: (id: string) => void
  onAdd: (type: SkillNode['type'], parentId: string) => void
  onEdit: (n: SkillNode) => void
  onDelete: (n: SkillNode) => void
}) {
  const { config } = useStore()
  const { kids, levelName } = useDerived()
  const children = kids.get(node.id) ?? []
  const childType = childTypeOf(node.type, config.structure)
  const isOpen = open.has(node.id)
  const rated = node.type === config.ratedAt
  const missingLevel = rated && !node.levelId

  return (
    <li role="treeitem" aria-expanded={childType ? isOpen : undefined}>
      <div className="tree-row" style={{ paddingInlineStart: depth * 20 + 8 }}>
        {childType ? (
          <button className="icon-btn tree-chevron" aria-label={isOpen ? 'Collapse' : 'Expand'} data-open={isOpen} onClick={() => toggle(node.id)}>
            <ChevronRight size={14} />
          </button>
        ) : (
          <span className="tree-spacer" />
        )}
        <span className="tree-type">{config.labels[node.type]}</span>
        <span className="tree-name" title={node.name}>
          {node.name}
        </span>
        {node.critical && (
          <span className="critical" title="Critical skill">
            <Star size={12} />
          </span>
        )}
        {node.levelId ? <Badge tone="accent">{levelName(node.levelId)}</Badge> : missingLevel ? <Badge tone="warn">No level</Badge> : null}
        {childType && children.length > 0 && <span className="tree-count">{children.length}</span>}
        <div className="row-actions tree-actions">
          {childType && (
            <button className="icon-btn" aria-label={`Add ${config.labels[childType].toLowerCase()}`} title={`Add ${config.labels[childType].toLowerCase()}`} onClick={() => onAdd(childType, node.id)}>
              <Plus size={14} />
            </button>
          )}
          <button className="icon-btn" aria-label="Edit" onClick={() => onEdit(node)}>
            <Pencil size={14} />
          </button>
          <button className="icon-btn" aria-label="Delete" onClick={() => onDelete(node)}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {childType && isOpen && children.length > 0 && (
        <ul role="group">
          {children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} open={open} toggle={toggle} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </li>
  )
}

function NodeDialog({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  const { config } = useStore()
  const dispatch = useDispatch()
  const [node, setNode] = useState(target.node)
  const rated = node.type === config.ratedAt
  const label = config.labels[node.type]
  const valid = node.name.trim().length > 0 && (!rated || node.levelId)

  const save = () => {
    dispatch({ type: 'node/save', node: { ...node, name: node.name.trim() } })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${target.isNew ? 'Add' : 'Edit'} ${label.toLowerCase()}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            {target.isNew ? `Add ${label.toLowerCase()}` : 'Save'}
          </Button>
        </>
      }
    >
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) save()
        }}
      >
        <Field label="Name" htmlFor="node-name">
          <input id="node-name" className="input" autoFocus value={node.name} onChange={(e) => setNode({ ...node, name: e.target.value })} />
        </Field>
        <Field label="Expected proficiency description" htmlFor="node-desc">
          <textarea id="node-desc" className="input" rows={3} value={node.description} onChange={(e) => setNode({ ...node, description: e.target.value })} />
        </Field>
        <Field label="Proficiency level" hint={rated ? 'Required: this is the level items are rated at.' : 'Optional at this tier.'} htmlFor="node-level">
          <select id="node-level" className="input" value={node.levelId ?? ''} onChange={(e) => setNode({ ...node, levelId: e.target.value || null })}>
            <option value="">{rated ? 'Select a level' : 'None'}</option>
            {config.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        {node.type === 'skill' && (
          <div className="row-between">
            <div>
              <p className="strong">Critical skill</p>
              <p className="field-hint">Flagged in gap dashboards.</p>
            </div>
            <Toggle label="Critical skill" checked={node.critical} onChange={(critical) => setNode({ ...node, critical })} />
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

