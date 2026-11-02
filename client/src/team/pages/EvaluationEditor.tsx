import { useMemo, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { teamApi } from '../../api'
import { Button, Card, useToast } from '../../components/ui'
import { SCORE_NAME, outOf } from '../../employee/logic'
import { ScoreChip } from '../../employee/shared'
import type { TaskAnswer } from '../../employee/types'
import { commentRequired, describeEvidence } from '../../lib/evidence'
import { percentToScore } from '../../lib/scale'
import { useTeam } from '../TeamContext'
import { isPublished } from '../logic'

/**
 * One evaluation for one person. It has a section for every skill at their level, each with its own tasks, and each
 * section is scored on its own. Submitting needs every section complete; a draft can be saved at any point.
 */
export function EvaluationEditor({ empId }: { empId: string }) {
  const { members, patch } = useTeam()
  const toast = useToast()
  const member = members?.find((m) => m.id === empId)
  const snap = member && isPublished(member) ? member.snapshot : null

  const [answers, setAnswers] = useState<Record<string, TaskAnswer>>(() => Object.assign({}, ...(snap?.clusters.map((c) => c.validation.answers) ?? [])))
  const [comments, setComments] = useState<Record<string, string>>(() => Object.fromEntries((snap?.clusters ?? []).map((c) => [c.id, c.validation.comment ?? ''])))
  const [busy, setBusy] = useState(false)

  const sections = useMemo(() => {
    if (!snap) return []
    return snap.clusters.map((c) => {
      const given = c.tasks.map((t) => answers[t.id])
      const applicable = given.filter((a) => a === 'yes' || a === 'no').length
      const yes = given.filter((a) => a === 'yes').length
      const score = applicable ? percentToScore((yes / applicable) * 100, snap.scoring.manager) : null
      const answered = given.filter(Boolean).length
      const needsComment = commentRequired(snap.evidence, score)
      const commentOk = !needsComment || (comments[c.id] ?? '').trim().length > 0
      const complete = answered === c.tasks.length && applicable > 0 && commentOk
      return { c, applicable, yes, score, answered, needsComment, commentOk, complete }
    })
  }, [snap, answers, comments])

  if (!snap) {
    return (
      <div className="test-shell">
        <a className="back-link" href="#/team/validations">
          <ArrowLeft size={14} /> All evaluations
        </a>
        <p className="muted">That person isn't in your team.</p>
      </div>
    )
  }

  const e = snap.employee
  const first = e.name.split(' ')[0]
  const level = snap.levels.find((l) => l.id === snap.currentLevelId)?.name
  const yesLabel = snap.scale.type === 'binary' && snap.scale.yesLabel ? snap.scale.yesLabel : 'Yes'
  const noLabel = snap.scale.type === 'binary' && snap.scale.noLabel ? snap.scale.noLabel : 'No'
  const allowNA = snap.scale.type !== 'binary' || snap.scale.allowNA !== false
  const totalTasks = sections.reduce((n, s) => n + s.c.tasks.length, 0)
  const answeredTasks = sections.reduce((n, s) => n + s.answered, 0)
  const completeSections = sections.filter((s) => s.complete).length
  const allComplete = sections.length > 0 && completeSections === sections.length
  const revising = sections.length > 0 && sections.every((s) => s.c.manager.status === 'calibrated')

  const save = async (submit: boolean) => {
    setBusy(true)
    try {
      const r = await teamApi.saveEvaluation(empId, answers, comments, submit)
      patch(empId, r.snapshot)
      if (submit) {
        toast(`Evaluation submitted for ${first}`)
        location.hash = '/team/validations'
      } else toast('Draft saved')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  const jump = (id: string) => document.getElementById(`eval-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="eval-shell">
      <a className="back-link" href="#/team/validations">
        <ArrowLeft size={14} /> All evaluations
      </a>
      <header>
        <p className="hero-eyebrow">{e.name}</p>
        <h1 className="test-title">Evaluation</h1>
        <p className="muted">
          Mark whether {first} can perform each task independently at {level}. There is a section for each skill, and each section is scored on its own.
        </p>
      </header>

      {revising && <p className="callout callout-warn">You've already evaluated {first}. Submitting again replaces the earlier result.</p>}

      <nav className="section-tabs" aria-label="Evaluation sections">
        {sections.map((s) => (
          <button key={s.c.id} type="button" className="section-tab" data-done={s.complete} onClick={() => jump(s.c.id)} title={s.c.name}>
            <span className="section-tab-name">{s.c.name}</span>
            <span className="section-tab-count">
              {s.answered}/{s.c.tasks.length} tasks
            </span>
          </button>
        ))}
      </nav>

      {sections.map((s) => {
        const groups = [...new Set(s.c.tasks.map((t) => t.group))]
        return (
          <Card key={s.c.id} title={s.c.name} description={s.c.description || undefined}>
            <div id={`eval-${s.c.id}`} className="eval-section">
              {groups.map((g) => (
                <div key={g ?? 'none'} className="stack-xs">
                  {g && <p className="field-label">{g}</p>}
                  <ul className="vtasks">
                    {s.c.tasks
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

              <div className="row-between eval-result">
                <span className="muted">{s.applicable ? `${outOf(s.yes, s.applicable)} applicable tasks` : 'Answer the tasks to see this section’s result.'}</span>
                <span className="eval-score">
                  <ScoreChip score={s.score} />
                  {s.score ? SCORE_NAME[s.score] : ''}
                </span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor={`c-${s.c.id}`}>
                  Comments / evidence {s.needsComment ? <span className="req">required</span> : '(optional)'}
                </label>
                <textarea
                  id={`c-${s.c.id}`}
                  className="input"
                  rows={2}
                  maxLength={2000}
                  value={comments[s.c.id] ?? ''}
                  onChange={(ev) => setComments({ ...comments, [s.c.id]: ev.target.value })}
                  placeholder="What have you seen that supports this rating?"
                />
                {s.needsComment && !s.commentOk && (
                  <p className="field-hint">{snap.evidence.always ? 'Your organisation requires a comment on every section.' : `A comment is ${describeEvidence(snap.evidence)}.`}</p>
                )}
              </div>
            </div>
          </Card>
        )
      })}

      <div className="sticky-bar">
        <span className="muted">
          {outOf(answeredTasks, totalTasks)} tasks answered · {outOf(completeSections, sections.length)} sections complete
        </span>
        <div className="btn-row">
          <Button disabled={busy || answeredTasks === 0} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button variant="primary" disabled={busy || !allComplete} onClick={() => save(true)}>
            <Check size={14} /> Submit evaluation
          </Button>
        </div>
      </div>
    </div>
  )
}
