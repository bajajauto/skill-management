import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useDispatch, useStore } from '../../store'
import { Badge, Button, Card, ConfirmDialog, Field, Segmented, SetupGuide, Toggle } from '../../components/ui'
import { defaultLikertLabels, scaleOptions } from '../../lib/scale'
import { nodeTypesFor, uid } from '../../lib/defaults'
import { ReviewChoice } from './ReviewChoice'
import { ORGANIZATIONS, type NodeType, type Organization, type Scale, type StructureKey } from '../../types'

export function Framework() {
  const { config, nodes } = useStore()
  const dispatch = useDispatch()
  const [confirmStructure, setConfirmStructure] = useState<StructureKey | null>(null)
  const tiers = nodeTypesFor(config.structure)
  const hasSubs = nodes.some((n) => n.type === 'subskill')
  const hasTasks = nodes.some((n) => n.type === 'task')

  const setScale = (scale: Scale) => dispatch({ type: 'config', update: (c) => ({ ...c, scale }) })
  const scale = config.scale

  const changeStructure = (s: StructureKey) => {
    if (s === config.structure) return
    if ((s === 'skill-task' && hasSubs) || (s === 'skill-subskill' && hasTasks)) setConfirmStructure(s)
    else dispatch({ type: 'structure', structure: s })
  }

  const changeScaleType = (type: Scale['type']) => {
    if (type === scale.type) return
    if (type === 'binary') setScale({ type, yesLabel: 'Yes', noLabel: 'No', allowNA: true })
    else if (type === 'likert') setScale({ type, points: 5, labels: defaultLikertLabels(5), startAtZero: false })
    else setScale({ type, step: 10 })
  }

  return (
    <div className="stack">
      <SetupGuide step="Step 1 of 5 · Define rules" title="Decide what your business unit will assess" icon="framework">
        Select the organization and business unit, choose whether ratings happen at sub-skill or task level, define the rating scale managers will use, and confirm the proficiency levels expected in your skill matrix.
      </SetupGuide>
      <ReviewChoice area="framework" subject="framework settings" />
      <Card
        title="Organization & assessment hierarchy"
        description="Choose the organization and business unit, then the lowest level managers will assess. Excel uploads can also set this automatically."
      >
        <div className="grid-2">
          <Field label="Organization" hint="The company this setup belongs to." htmlFor="organization">
            <select
              id="organization"
              className="input"
              value={config.organization}
              onChange={(e) => dispatch({ type: 'config', update: (c) => ({ ...c, organization: e.target.value as Organization | '' }) })}
            >
              <option value="">Select an organization</option>
              {ORGANIZATIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Business unit" hint="Applies to employees in this business unit." htmlFor="business-unit">
            <input
              id="business-unit"
              className="input"
              placeholder="e.g. Powertrain, Quality, Sales"
              value={config.businessUnit}
              onChange={(e) => dispatch({ type: 'config', update: (c) => ({ ...c, businessUnit: e.target.value }) })}
            />
          </Field>
        </div>
        <Segmented
          label="Hierarchy depth"
          value={config.structure}
          onChange={changeStructure}
          options={[
            { value: 'skill-subskill', label: 'Skill → Sub-skill' },
            { value: 'skill-subskill-task', label: 'Skill → Sub-skill → Task' },
            { value: 'skill-task', label: 'Skill → Task' },
          ]}
        />
        <div className="chain" aria-hidden>
          {tiers.map((t, i) => (
            <span key={t} className="chain-item">
              {i > 0 && <ChevronRight size={14} />}
              <span className="chain-node">{config.labels[t]}</span>
            </span>
          ))}
        </div>

        <div className="grid-3">
          {(['skill', 'subskill', 'task'] as NodeType[])
            .filter((t) => tiers.includes(t))
            .map((t) => (
              <Field key={t} label={`Name for "${t === 'subskill' ? 'sub-skill' : t}" tier`} htmlFor={`label-${t}`}>
                <input
                  id={`label-${t}`}
                  className="input"
                  value={config.labels[t]}
                  onChange={(e) => dispatch({ type: 'config', update: (c) => ({ ...c, labels: { ...c.labels, [t]: e.target.value } }) })}
                />
              </Field>
            ))}
        </div>

        <div className="divider" />
        <Field
          label="Rate at"
          hint={
            config.ratedAt === 'task'
              ? 'Managers rate each task. Sub-skill and skill scores are rolled up from their tasks.'
              : `Managers rate each ${config.labels[config.ratedAt].toLowerCase()} directly. Tiers above it are rolled up; tiers below are shown as guidance only.`
          }
        >
          <Segmented
            label="Rating level"
            value={config.ratedAt}
            onChange={(v) => dispatch({ type: 'config', update: (c) => ({ ...c, ratedAt: v }) })}
            options={tiers.map((t) => ({ value: t, label: config.labels[t] }))}
          />
        </Field>
      </Card>

      <Card title="Rating scale" description="What a rater picks for each item. Every scale is converted to a 0–100% before scoring bands apply.">
        <Segmented
          label="Scale type"
          value={scale.type}
          onChange={changeScaleType}
          options={[
            { value: 'binary', label: 'Yes / No (1, 0)' },
            { value: 'likert', label: 'Likert' },
            { value: 'percentage', label: 'Percentage' },
          ]}
        />

        <div className="scale-grid">
          <div className="stack-sm">
            {scale.type === 'binary' && (
              <>
                <div className="grid-2">
                  <Field label="Positive label (1)" htmlFor="yes">
                    <input id="yes" className="input" value={scale.yesLabel} onChange={(e) => setScale({ ...scale, yesLabel: e.target.value })} />
                  </Field>
                  <Field label="Negative label (0)" htmlFor="no">
                    <input id="no" className="input" value={scale.noLabel} onChange={(e) => setScale({ ...scale, noLabel: e.target.value })} />
                  </Field>
                </div>
                <div className="row-between">
                  <div>
                    <p className="strong">Allow "Not applicable"</p>
                    <p className="field-hint">NA items are left out of the percentage, so 4 of 5 applicable is 80%.</p>
                  </div>
                  <Toggle label="Allow Not applicable" checked={scale.allowNA} onChange={(v) => setScale({ ...scale, allowNA: v })} />
                </div>
              </>
            )}

            {scale.type === 'likert' && (
              <>
                <Field label="Number of points">
                  <Segmented
                    label="Likert points"
                    value={scale.points}
                    onChange={(p) => setScale({ ...scale, points: p, labels: defaultLikertLabels(p) })}
                    options={[3, 4, 5, 6, 7].map((p) => ({ value: p, label: String(p) }))}
                  />
                </Field>
                <div className="row-between">
                  <p className="strong">Start numbering at 0</p>
                  <Toggle label="Start at zero" checked={scale.startAtZero} onChange={(v) => setScale({ ...scale, startAtZero: v })} />
                </div>
                <div className="stack-xs">
                  {scale.labels.map((label, i) => (
                    <div className="label-row" key={i}>
                      <span className="label-num">{(scale.startAtZero ? 0 : 1) + i}</span>
                      <input
                        className="input"
                        aria-label={`Label for point ${i + 1}`}
                        value={label}
                        onChange={(e) => setScale({ ...scale, labels: scale.labels.map((l, j) => (j === i ? e.target.value : l)) })}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {scale.type === 'percentage' && (
              <Field label="Step size" hint="Raters pick a value from 0% to 100% in these increments.">
                <Segmented
                  label="Percentage step"
                  value={scale.step}
                  onChange={(step) => setScale({ ...scale, step })}
                  options={[5, 10, 25].map((s) => ({ value: s, label: `${s}%` }))}
                />
              </Field>
            )}

            <Field label="Comments / evidence">
              <Segmented
                label="Evidence requirement"
                value={config.evidence}
                onChange={(v) => dispatch({ type: 'config', update: (c) => ({ ...c, evidence: v }) })}
                options={[
                  { value: 'never', label: 'Optional' },
                  { value: 'on-negative', label: 'Required on lowest rating' },
                  { value: 'always', label: 'Always required' },
                ]}
              />
            </Field>
          </div>

          <ScalePreview />
        </div>
      </Card>

      <Levels />

      <ConfirmDialog
        open={confirmStructure !== null}
        title={confirmStructure === 'skill-subskill' ? 'Remove the task tier?' : 'Remove the sub-skill tier?'}
        confirmLabel={confirmStructure === 'skill-subskill' ? 'Remove tasks' : 'Remove sub-skills'}
        danger
        message={confirmStructure === 'skill-subskill' ? "Existing tasks will be deleted and ratings will move to sub-skills. This can't be undone." : "Your sub-skills will be deleted and their tasks moved up under the parent skill. This can't be undone."}
        onConfirm={() => confirmStructure && dispatch({ type: 'structure', structure: confirmStructure })}
        onClose={() => setConfirmStructure(null)}
      />
    </div>
  )
}

function ScalePreview() {
  const { config } = useStore()
  const { scale } = config
  const [picked, setPicked] = useState<number | null>(null)
  const options = scaleOptions(scale)
  const sample = config.ratedAt === 'task' ? 'Load and verify a work offset' : `Sample ${config.labels[config.ratedAt].toLowerCase()}`
  const key = JSON.stringify(scale)
  return (
    <div className="preview" key={key}>
      <p className="preview-eyebrow">What the rater sees</p>
      <p className="strong">{sample}</p>
      {scale.type === 'percentage' ? (
        <div className="slider-wrap">
          <input
            type="range"
            min={0}
            max={100}
            step={scale.step}
            value={picked ?? 0}
            onChange={(e) => setPicked(Number(e.target.value))}
            aria-label="Percentage rating"
          />
          <output>{picked ?? 0}%</output>
        </div>
      ) : (
        <div className="choices" role="radiogroup" aria-label="Rating">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={picked === o.value}
              className="choice"
              onClick={() => setPicked(o.value)}
            >
              <span className="choice-value">{o.value}</span>
              {o.label}
            </button>
          ))}
          {scale.type === 'binary' && scale.allowNA && (
            <button type="button" role="radio" aria-checked={picked === -1} className="choice choice-na" onClick={() => setPicked(-1)}>
              N/A
            </button>
          )}
        </div>
      )}
      {config.evidence !== 'never' && <div className="evidence">Comment / evidence ({config.evidence === 'always' ? 'required' : 'required on lowest rating'})</div>}
    </div>
  )
}

function Levels() {
  const { config, nodes } = useStore()
  const dispatch = useDispatch()
  const { levels } = config
  const set = (next: typeof levels) => dispatch({ type: 'levels', levels: next })
  const usage = (id: string) => nodes.filter((n) => n.levelId === id).length

  const move = (i: number, d: -1 | 1) => {
    const next = [...levels]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    set(next)
  }

  return (
    <Card
      title="Proficiency levels"
      description="Ordered from first to highest. Employees unlock the next level only after clearing the current one."
      action={
        <Button size="sm" onClick={() => set([...levels, { id: uid(), name: '' }])}>
          <Plus size={14} /> Add level
        </Button>
      }
    >
      <ol className="level-list">
        {levels.map((l, i) => (
          <li key={l.id} className="level-row">
            <span className="label-num">{i + 1}</span>
            <input
              className="input"
              aria-label={`Level ${i + 1} name`}
              placeholder="Level name"
              value={l.name}
              onChange={(e) => set(levels.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))}
            />
            {usage(l.id) > 0 && <Badge>{usage(l.id)} mapped</Badge>}
            <div className="row-actions">
              <button className="icon-btn" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}>
                <ArrowUp size={14} />
              </button>
              <button className="icon-btn" disabled={i === levels.length - 1} aria-label="Move down" onClick={() => move(i, 1)}>
                <ArrowDown size={14} />
              </button>
              <button className="icon-btn" disabled={levels.length === 1} aria-label="Delete level" onClick={() => set(levels.filter((x) => x.id !== l.id))}>
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

