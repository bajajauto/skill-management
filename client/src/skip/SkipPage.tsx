import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { skipApi } from '../api'
import { Badge, Button, Card, Empty, useToast } from '../components/ui'
import { SCORE_NAME, fmtDate, outOf } from '../employee/logic'
import { NotPublished, PageHead, ScoreChip } from '../employee/shared'
import type { PublishedMe, TaskAnswer } from '../employee/types'
import { percentToScore } from '../lib/scale'
import { calibrationOf, useSkip } from './SkipContext'

export type SkipRoute = { view: 'list' } | { view: 'person'; empId: string }

const STATE = {
  none: { label: 'Waiting on manager', tone: 'neutral' as const, cta: 'Open' },
  todo: { label: 'To review', tone: 'warn' as const, cta: 'Review' },
  done: { label: 'Reviewed', tone: 'good' as const, cta: 'Open' },
}

export function SkipPage({ route }: { route: SkipRoute }) {
  const { members, error, refresh } = useSkip()
  if (error) {
    return (
      <div className="stack">
        <PageHead title="Calibration" />
        <p className="callout callout-bad">{error}</p>
        <div>
          <Button variant="primary" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }
  if (!members) return <p className="muted">Loading…</p>
  if (route.view === 'person') return <Calibrate empId={route.empId} />

  const rows = members.map((m) => ({ m, cal: calibrationOf(m.snapshot) }))
  const todo = rows.filter((r) => r.cal.state === 'todo').length
  const win = members[0]?.snapshot.calibration
  return (
    <div className="stack">
      <PageHead title="Calibration" sub={`${members.length} ${members.length === 1 ? 'person' : 'people'} in your skip-level group`} />
      {win && (
        <p className={`callout ${win.open ? '' : 'callout-warn'}`} role="status">
          {win.open
            ? `You can calibrate until ${fmtDate(win.deadline)}. Until then employees can't see their manager's scores. After that every score is shown, as the manager gave it unless you changed it.`
            : `Calibration closed on ${fmtDate(win.deadline)}. Scores are now visible to employees and can't be changed here.`}
        </p>
      )}
      <Card title="Review your managers' evaluations" description="Each manager scores their own team. Where you see a person differently you can change the manager's answers on their tasks and say why, and the skill score follows. Where you agree, or do nothing, the manager's answers and score stand.">
        {rows.length === 0 ? (
          <Empty title="Nobody here yet">People whose skip-level manager is you will show up here.</Empty>
        ) : (
          <ul className="eval-list">
            {rows.map(({ m, cal }) => {
              if (!m.snapshot.published) return null
              const e = m.snapshot.employee
              const s = STATE[cal.state]
              return (
                <li key={m.id}>
                  <span className="demo-avatar">{e.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                  <span className="eval-who">
                    <a className="strong" href={`#/calibration/${m.id}`}>
                      {e.name}
                    </a>
                    <small className="muted">Manager: {e.manager}</small>
                  </span>
                  <span className="muted">
                    {cal.evaluated ? `Manager evaluated ${outOf(cal.evaluated, m.snapshot.clusters.length)} skills · you reviewed ${cal.reviewed}` : 'Manager has not evaluated yet'}
                  </span>
                  <Badge tone={s.tone}>
                    {cal.state === 'done' && <Check size={11} strokeWidth={3} />}
                    {cal.state === 'done' && cal.changed > 0 ? `${s.label} · ${cal.changed} changed` : s.label}
                  </Badge>
                  <a className={`btn btn-sm ${cal.state === 'todo' ? 'btn-primary' : ''}`} href={`#/calibration/${m.id}`}>
                    {s.cta} <ArrowRight size={13} />
                  </a>
                </li>
              )
            })}
          </ul>
        )}
        {todo > 0 && (
          <p className="field-hint">
            {todo} {todo === 1 ? 'person is' : 'people are'} waiting for your review.
          </p>
        )}
      </Card>
    </div>
  )
}

function Calibrate({ empId }: { empId: string }) {
  const { members, patch } = useSkip()
  const toast = useToast()
  const member = members?.find((m) => m.id === empId)
  const snap = member?.snapshot.published ? (member.snapshot as PublishedMe) : null
  // The skip manager's answer for every task: the manager's own until they change it.
  const [answers, setAnswers] = useState<Record<string, TaskAnswer>>(() =>
    Object.fromEntries((snap?.clusters ?? []).flatMap((c) => c.tasks.filter((t) => t.managerAnswer).map((t) => [t.id, t.managerAnswer as TaskAnswer]))),
  )
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries((snap?.clusters ?? []).map((c) => [c.id, c.manager.calibration?.reason ?? ''])))
  const [busy, setBusy] = useState(false)

  if (!member) {
    return (
      <div className="stack">
        <a className="back-link" href="#/calibration">
          <ArrowLeft size={14} /> Calibration
        </a>
        <p className="muted">That person isn't in your skip-level group.</p>
      </div>
    )
  }
  if (!snap) return <NotPublished />

  const e = snap.employee
  const open = snap.calibration.open
  const yesLabel = snap.scale.type === 'binary' && snap.scale.yesLabel ? snap.scale.yesLabel : 'Yes'
  const noLabel = snap.scale.type === 'binary' && snap.scale.noLabel ? snap.scale.noLabel : 'No'
  const evaluated = snap.clusters.filter((c) => c.manager.status === 'calibrated')

  // Each skill with the score it would have on the skip manager's answers, next to the manager's own.
  const rows = evaluated.map((c) => {
    const given = c.tasks.map((t) => answers[t.id])
    const applicable = given.filter((a) => a === 'yes' || a === 'no').length
    const yes = given.filter((a) => a === 'yes').length
    const score = applicable ? percentToScore((yes / applicable) * 100, snap.scoring.manager) : null
    const changed = c.tasks.filter((t) => answers[t.id] !== t.managerOriginal).length
    const managerYes = c.manager.calibration ? c.manager.calibration.managerYes : c.manager.yes
    const managerApplicable = c.manager.calibration ? c.manager.calibration.managerApplicable : c.manager.applicable
    const managerScore = c.manager.original
    return { c, applicable, yes, score, changed, managerYes, managerApplicable, managerScore, needsReason: changed > 0 && !(reasons[c.id] ?? '').trim() }
  })
  const changedSkills = rows.filter((r) => r.changed > 0).length
  const blocked = rows.some((r) => r.needsReason || r.applicable === 0)

  const send = async (body: { agreeAll?: boolean; skills?: Record<string, { answers: Record<string, TaskAnswer>; reason: string } | null> }, done: string) => {
    setBusy(true)
    try {
      const { snapshot } = await skipApi.calibrate(empId, body)
      patch(empId, snapshot)
      toast(done)
      location.hash = '/calibration'
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error')
    }
    setBusy(false)
  }
  const save = () =>
    send(
      { skills: Object.fromEntries(rows.map((r) => [r.c.id, { answers: Object.fromEntries(r.c.tasks.map((t) => [t.id, answers[t.id]])), reason: reasons[r.c.id] ?? '' }])) },
      changedSkills ? `Saved, ${changedSkills} skill${changedSkills === 1 ? '' : 's'} changed` : 'Saved, you agree with the manager',
    )

  return (
    <div className="stack">
      <a className="back-link" href="#/calibration">
        <ArrowLeft size={14} /> Calibration
      </a>
      <PageHead title={`Calibrate ${e.name}`} sub={`${e.designation} · Manager: ${e.manager}`} />
      {!open ? (
        <p className="callout callout-warn">Calibration closed on {fmtDate(snap.calibration.deadline)}. The answers below are final.</p>
      ) : evaluated.length === 0 ? (
        <p className="callout">
          {e.manager} hasn't evaluated {e.name.split(' ')[0]} yet. Once they do, their answers appear here for you to review.
        </p>
      ) : (
        <p className="muted">
          You rate the same tasks as the manager. Their answer is marked on each task. Change any you see differently and the skill score updates from your answers. Changing an answer needs a reason.
        </p>
      )}

      {snap.clusters.map((c) => {
        const r = rows.find((x) => x.c.id === c.id)
        if (!r) {
          return (
            <Card key={c.id} title={c.name} description={c.description || undefined}>
              <p className="muted">Not evaluated by the manager yet.</p>
            </Card>
          )
        }
        const groups = [...new Set(c.tasks.map((t) => t.group))]
        const opts: { v: TaskAnswer; label: string }[] = [
          { v: 'yes', label: yesLabel },
          { v: 'no', label: noLabel },
          ...(snap.scale.type !== 'binary' || snap.scale.allowNA !== false ? [{ v: 'na' as TaskAnswer, label: 'N/A' }] : []),
        ]
        return (
          <Card key={c.id} title={c.name} description={c.description || undefined}>
            <div className="stack-xs">
              {c.manager.comment && <p className="muted">Manager's comment: {c.manager.comment}</p>}
              {groups.map((g) => (
                <div key={g ?? 'none'} className="stack-xs">
                  {g && <p className="field-label">{g}</p>}
                  <ul className="vtasks">
                    {c.tasks
                      .filter((t) => t.group === g)
                      .map((t) => (
                        <li key={t.id} className="vtask">
                          <span>
                            {t.name}
                            {answers[t.id] !== t.managerOriginal && <small className="muted"> · manager said {t.managerOriginal === 'na' ? 'N/A' : t.managerOriginal === 'yes' ? yesLabel : noLabel}</small>}
                          </span>
                          <div className="vopts" role="radiogroup" aria-label={t.name}>
                            {opts.map((o) => (
                              <button key={o.v} type="button" role="radio" disabled={!open} aria-checked={answers[t.id] === o.v} data-v={o.v} className="vopt" onClick={() => setAnswers({ ...answers, [t.id]: o.v })}>
                                {o.label}
                                {t.managerOriginal === o.v ? ' ·' : ''}
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
              <div className="row-between eval-result">
                <span className="muted">
                  Manager: <ScoreChip score={r.managerScore} /> {SCORE_NAME[r.managerScore]} ({outOf(r.managerYes, r.managerApplicable)} tasks)
                </span>
                <span className="eval-score">
                  You: <ScoreChip score={r.score} /> {r.score ? SCORE_NAME[r.score] : ''}
                  {r.changed === 0 ? <Badge tone="good">Agree</Badge> : <Badge tone="warn">{r.changed} changed</Badge>}
                </span>
              </div>
              {r.changed > 0 && (
                <div className="field">
                  <label className="field-label" htmlFor={`r-${c.id}`}>
                    Why are you changing it? <span className="req">required</span>
                  </label>
                  <textarea id={`r-${c.id}`} className="input" rows={2} maxLength={1000} disabled={!open} value={reasons[c.id] ?? ''} onChange={(ev) => setReasons({ ...reasons, [c.id]: ev.target.value })} placeholder="What have you seen that supports your answers?" />
                </div>
              )}
              {r.applicable === 0 && <p className="field-error">At least one task must apply.</p>}
            </div>
          </Card>
        )
      })}

      {evaluated.length > 0 && open && (
        <div className="sticky-bar">
          <span className="muted">{changedSkills ? `${changedSkills} skill${changedSkills === 1 ? '' : 's'} changed` : "No changes, the manager's answers stand"}</span>
          <div className="btn-row">
            <Button disabled={busy} onClick={() => void send({ agreeAll: true }, 'Saved, you agree with the manager')}>
              Agree with all
            </Button>
            <Button variant="primary" disabled={busy || blocked} onClick={() => void save()}>
              <Check size={14} /> Save review
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
