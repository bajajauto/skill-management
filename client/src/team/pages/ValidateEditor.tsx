import { useMemo, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { teamApi } from '../../api'
import { Button, useToast } from '../../components/ui'
import { SCORE_NAME, pctOf } from '../../employee/logic'
import { ScoreChip } from '../../employee/shared'
import type { TaskAnswer } from '../../employee/types'
import { percentToScore } from '../../lib/scale'
import { useTeam } from '../TeamContext'
import { isPublished } from '../logic'

export function ValidateEditor({ empId, skillId }: { empId: string; skillId: string }) {
  const { members, patch } = useTeam()
  const toast = useToast()
  const member = members?.find((m) => m.id === empId)
  const snap = member && isPublished(member) ? member.snapshot : null
  const cluster = snap?.clusters.find((c) => c.id === skillId)

  const [answers, setAnswers] = useState<Record<string, TaskAnswer>>(() => ({ ...(cluster?.validation.answers ?? {}) }))
  const [comment, setComment] = useState(cluster?.validation.comment ?? '')
  const [busy, setBusy] = useState(false)

  const live = useMemo(() => {
    if (!cluster) return null
    const given = cluster.tasks.map((t) => answers[t.id])
    const applicable = given.filter((a) => a === 'yes' || a === 'no').length
    const yes = given.filter((a) => a === 'yes').length
    const pct = applicable ? (yes / applicable) * 100 : null
    return { answered: given.filter(Boolean).length, applicable, yes, pct }
  }, [cluster, answers])

  if (!snap || !cluster || !live) {
    return (
      <div className="test-shell">
        <a className="back-link" href="#/team/validations">
          <ArrowLeft size={14} /> Back to validations
        </a>
        <p className="muted">That skill isn't part of this person's current level.</p>
      </div>
    )
  }

  const emp = snap.employee
  const score = live.pct == null ? null : percentToScore(live.pct, snap.scoring.manager)
  const yesLabel = snap.scale.type === 'binary' && snap.scale.yesLabel ? snap.scale.yesLabel : 'Yes'
  const noLabel = snap.scale.type === 'binary' && snap.scale.noLabel ? snap.scale.noLabel : 'No'
  const allowNA = snap.scale.type !== 'binary' || snap.scale.allowNA !== false
  const needsComment = snap.evidence === 'always' || (snap.evidence === 'on-negative' && score === 1)
  const complete = live.answered === cluster.tasks.length && live.applicable > 0
  const canSubmit = complete && (!needsComment || comment.trim().length > 0)
  const revising = cluster.manager.status === 'calibrated'

  const save = async (submit: boolean) => {
    setBusy(true)
    try {
      const r = await teamApi.saveValidation(empId, skillId, answers, comment, submit)
      patch(empId, r.snapshot)
      if (submit) {
        toast(`Validation submitted for ${emp.name.split(' ')[0]}`)
        location.hash = '/team/validations'
      } else toast('Draft saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  const groups = [...new Set(cluster.tasks.map((t) => t.group))]

  return (
    <div className="test-shell">
      <a className="back-link" href="#/team/validations">
        <ArrowLeft size={14} /> All validations
      </a>
      <header>
        <p className="hero-eyebrow">{emp.name}</p>
        <h1 className="test-title">{cluster.name}</h1>
        <p className="muted">
          Mark whether {emp.name.split(' ')[0]} can perform each task independently at {snap.levels.find((l) => l.id === snap.currentLevelId)?.name}.
        </p>
      </header>

      {revising && <p className="callout callout-warn">You've already validated this skill. Submitting again replaces the earlier result.</p>}

      <section className="card stack-sm">
        {groups.map((g) => (
          <div key={g ?? 'none'} className="stack-xs">
            {g && <p className="field-label">{g}</p>}
            <ul className="vtasks">
              {cluster.tasks
                .filter((t) => t.group === g)
                .map((t) => {
                  const a = answers[t.id]
                  const opts: { v: TaskAnswer; label: string }[] = [
                    { v: 'yes', label: yesLabel },
                    { v: 'no', label: noLabel },
                    ...(allowNA ? [{ v: 'na' as TaskAnswer, label: 'N/A' }] : []),
                  ]
                  return (
                    <li key={t.id} className="vtask">
                      <span>{t.name}</span>
                      <div className="vopts" role="radiogroup" aria-label={t.name}>
                        {opts.map((o) => (
                          <button key={o.v} type="button" role="radio" aria-checked={a === o.v} data-v={o.v} className="vopt" onClick={() => setAnswers({ ...answers, [t.id]: o.v })}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </section>

      <section className="card stack-sm">
        <div className="row-between">
          <div>
            <p className="field-label">Result</p>
            <p className="muted">
              {live.applicable ? `${live.yes} of ${live.applicable} applicable tasks · ${pctOf(live.pct)}` : 'Answer the tasks to see the result.'}
            </p>
          </div>
          <div className="big-score big-score-inline">
            <ScoreChip score={score} />
            <span>{score ? SCORE_NAME[score] : ''}</span>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="v-comment">
            Comments / evidence {needsComment ? <span className="req">required</span> : '(optional)'}
          </label>
          <textarea id="v-comment" className="input" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What have you seen that supports this rating?" />
          {needsComment && !comment.trim() && (
            <p className="field-hint">{snap.evidence === 'always' ? 'Your organisation requires a comment on every validation.' : 'A comment is required when the rating is in the lowest band.'}</p>
          )}
        </div>
      </section>

      <div className="sticky-bar">
        <span className="muted">
          {live.answered} of {cluster.tasks.length} answered
        </span>
        <div className="btn-row">
          <Button disabled={busy || live.answered === 0} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button variant="primary" disabled={busy || !canSubmit} onClick={() => save(true)}>
            <Check size={14} /> Submit validation
          </Button>
        </div>
      </div>
    </div>
  )
}
