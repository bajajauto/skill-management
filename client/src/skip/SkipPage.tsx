import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { skipApi } from '../api'
import { Badge, Button, Card, Dialog, Empty, useToast } from '../components/ui'
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
      {win && !win.open && (
        <p className="callout callout-warn" role="status">
          Calibration closed on {fmtDate(win.deadline)}. Scores are now visible to employees and can't be changed here.
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
              // Once the evaluation deadline has passed a person is shown even if the manager left skills unevaluated.
              const s = !m.ready ? STATE.none : cal.state === 'none' ? { label: 'Not evaluated', tone: 'neutral' as const, cta: 'Open' } : STATE[cal.state]
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
                    {!m.ready ? 'Awaiting manager evaluation' : cal.evaluated ? `You reviewed ${outOf(cal.reviewed, cal.evaluated)} skills` : 'The manager did not evaluate'}
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
  // The skip manager's answer for every task: the manager's own until they change it, empty where the manager gave none.
  const [answers, setAnswers] = useState<Record<string, TaskAnswer>>(() =>
    Object.fromEntries((snap?.clusters ?? []).flatMap((c) => c.tasks.filter((t) => t.managerAnswer).map((t) => [t.id, t.managerAnswer as TaskAnswer]))),
  )
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries((snap?.clusters ?? []).map((c) => [c.id, c.manager.calibration?.reason ?? ''])))
  // Why each task was changed from the manager's answer. Asked for in a pop-up the moment the answer is changed.
  const [taskReasons, setTaskReasons] = useState<Record<string, string>>(() => Object.assign({}, ...(snap?.clusters ?? []).map((c) => c.manager.calibration?.taskReasons ?? {})))
  const [asking, setAsking] = useState<{ taskId: string; taskName: string; managerSaid: TaskAnswer; to: TaskAnswer } | null>(null)
  const [draft, setDraft] = useState('')
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
  if (!member.ready) {
    return (
      <div className="stack">
        <a className="back-link" href="#/calibration">
          <ArrowLeft size={14} /> Calibration
        </a>
        <PageHead title={`Calibrate ${e.name}`} sub={`${e.designation} · Manager: ${e.manager}`} />
        <p className="callout">Awaiting manager evaluation. Once {e.manager} has evaluated {e.name.split(' ')[0]}, you can review the scores here.</p>
      </div>
    )
  }
  const open = snap.calibration.open
  const evalClosed = !snap.evaluation.open
  const yesLabel = snap.scale.type === 'binary' && snap.scale.yesLabel ? snap.scale.yesLabel : 'Yes'
  const noLabel = snap.scale.type === 'binary' && snap.scale.noLabel ? snap.scale.noLabel : 'No'
  // Skills the manager evaluated, and, once evaluations have closed, the ones they left out: those the skip manager rates.
  const actionable = snap.clusters.filter((c) => c.manager.status === 'calibrated' || evalClosed)
  const evaluatedCount = snap.clusters.filter((c) => c.tasks.some((t) => t.managerOriginal != null)).length

  // Each skill with the score it would have on the skip manager's answers, next to the manager's own.
  const rows = actionable.map((c) => {
    const given = c.tasks.map((t) => answers[t.id])
    const applicable = given.filter((a) => a === 'yes' || a === 'no').length
    const yes = given.filter((a) => a === 'yes').length
    const score = applicable ? percentToScore((yes / applicable) * 100, snap.scoring.manager) : null
    const unrated = c.tasks.every((t) => t.managerOriginal == null)
    const touched = given.some(Boolean)
    const complete = given.every(Boolean)
    const changed = unrated ? (touched ? c.tasks.length : 0) : c.tasks.filter((t) => answers[t.id] !== t.managerOriginal).length
    const managerYes = c.manager.calibration ? c.manager.calibration.managerYes : c.manager.yes
    const managerApplicable = c.manager.calibration ? c.manager.calibration.managerApplicable : c.manager.applicable
    const incomplete = unrated ? touched && (!complete || applicable === 0) : applicable === 0
    return { c, applicable, yes, score, changed, unrated, touched, incomplete, managerYes, managerApplicable, managerScore: c.manager.original, needsReason: !unrated && c.tasks.some((t) => answers[t.id] !== t.managerOriginal && !(taskReasons[t.id] ?? '').trim()) }
  })
  const changedSkills = rows.filter((r) => r.changed > 0).length
  // Only the skills you changed need anything more. Skills you left alone are saved as they are.
  const stuck = rows.filter((r) => r.needsReason || r.incomplete)
  const blocked = stuck.length > 0
  const goToStuck = () => {
    const first = stuck[0]
    if (!first) return
    toast(first.needsReason ? `Add a reason for each change in ${first.c.name}.` : `Finish rating ${first.c.name}.`, 'error')
    document.getElementById(`cal-${first.c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  // Picking the manager's own answer is agreeing, so no reason. Picking anything else asks for one right away.
  const pick = (unrated: boolean, t: { id: string; name: string; managerOriginal?: TaskAnswer | null }, v: TaskAnswer) => {
    if (unrated || t.managerOriginal == null) {
      setAnswers({ ...answers, [t.id]: v })
      return
    }
    if (v === t.managerOriginal) {
      setAnswers({ ...answers, [t.id]: v })
      setTaskReasons(({ [t.id]: _drop, ...rest }) => rest)
      return
    }
    setDraft(answers[t.id] === v ? (taskReasons[t.id] ?? '') : '')
    setAsking({ taskId: t.id, taskName: t.name, managerSaid: t.managerOriginal, to: v })
  }
  const label = (a: TaskAnswer) => (a === 'na' ? 'N/A' : a === 'yes' ? yesLabel : noLabel)
  const nothingToSave = rows.every((r) => r.unrated && !r.touched) && evaluatedCount === 0

  const send = async (body: { agreeAll?: boolean; skills?: Record<string, { answers: Record<string, TaskAnswer>; taskReasons: Record<string, string>; reason: string } | null> }, done: string) => {
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
      {
        skills: Object.fromEntries(
          rows.filter((r) => !(r.unrated && !r.touched)).map((r) => [
              r.c.id,
              {
                answers: Object.fromEntries(r.c.tasks.map((t) => [t.id, answers[t.id]])),
                taskReasons: Object.fromEntries(r.c.tasks.filter((t) => answers[t.id] !== t.managerOriginal && taskReasons[t.id]).map((t) => [t.id, taskReasons[t.id]])),
                reason: r.unrated ? (reasons[r.c.id] ?? '') : '',
              },
            ]),
        ),
      },
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
      ) : evaluatedCount === 0 ? (
        <p className="callout">
          {e.manager} did not evaluate {e.name.split(' ')[0]} before the deadline, so you rate each task yourself. Your answers set the scores.
        </p>
      ) : (
        <p className="muted">
          You rate the same tasks as the manager. Their answer is marked on each task. Change any you see differently and the skill score updates from your answers. Changing an answer needs a reason.
          {rows.some((r) => r.unrated) ? ' Skills the manager left out are yours to rate.' : ''}
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
            <div className="stack-xs" id={`cal-${c.id}`}>
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
                            {!r.unrated && answers[t.id] !== t.managerOriginal && <small className="muted"> · manager said {t.managerOriginal === 'na' ? 'N/A' : t.managerOriginal === 'yes' ? yesLabel : noLabel}</small>}
                            {!r.unrated && answers[t.id] !== t.managerOriginal && taskReasons[t.id] && <small className="muted" style={{ display: 'block' }}>Your reason: {taskReasons[t.id]}</small>}
                          </span>
                          <div className="vopts" role="radiogroup" aria-label={t.name}>
                            {opts.map((o) => (
                              <button key={o.v} type="button" role="radio" disabled={!open} aria-checked={answers[t.id] === o.v} data-v={o.v} className="vopt" onClick={() => pick(r.unrated, t, o.v)}>
                                {o.label}
                                {!r.unrated && t.managerOriginal === o.v ? ' ·' : ''}
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
                  {r.unrated ? (
                    'The manager did not evaluate this skill'
                  ) : (
                    <>
                      Manager: <ScoreChip score={r.managerScore} /> {SCORE_NAME[r.managerScore]} ({outOf(r.managerYes, r.managerApplicable)} tasks)
                    </>
                  )}
                </span>
                <span className="eval-score">
                  You: <ScoreChip score={r.score} /> {r.score ? SCORE_NAME[r.score] : ''}
                  {r.unrated ? r.touched && <Badge tone="warn">Rated by you</Badge> : r.changed === 0 ? <Badge tone="good">Agree</Badge> : <Badge tone="warn">{r.changed} changed</Badge>}
                </span>
              </div>
              {r.unrated && r.touched && (
                <div className="field">
                  <label className="field-label" htmlFor={`r-${c.id}`}>
                    Comment (optional)
                  </label>
                  <textarea id={`r-${c.id}`} className="input" rows={2} maxLength={1000} disabled={!open} value={reasons[c.id] ?? ''} onChange={(ev) => setReasons({ ...reasons, [c.id]: ev.target.value })} placeholder="What have you seen that supports your answers?" />
                </div>
              )}
              {r.incomplete && <p className="field-error">{r.unrated ? 'Answer every task, and at least one must apply.' : 'At least one task must apply.'}</p>}
            </div>
          </Card>
        )
      })}

      {rows.length > 0 && open && (
        <div className="sticky-bar">
          <span className={blocked ? 'field-error' : 'muted'}>
            {blocked
              ? stuck[0].needsReason
                ? `Add a reason for each change in ${stuck[0].c.name} to save`
                : `Finish rating ${stuck[0].c.name} to save`
              : changedSkills
                ? `${changedSkills} skill${changedSkills === 1 ? '' : 's'} changed`
                : "No changes, the manager's answers stand"}
          </span>
          <div className="btn-row">
            {evaluatedCount > 0 && (
              <Button disabled={busy} onClick={() => void send({ agreeAll: true }, 'Saved, you agree with the manager')}>
                Agree with all
              </Button>
            )}
            <Button variant="primary" disabled={busy || nothingToSave} onClick={() => (blocked ? goToStuck() : void save())}>
              <Check size={14} /> Save review
            </Button>
          </div>
        </div>
      )}
      <Dialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        title="Why are you changing this answer?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!draft.trim()}
              onClick={() => {
                if (!asking) return
                setAnswers({ ...answers, [asking.taskId]: asking.to })
                setTaskReasons({ ...taskReasons, [asking.taskId]: draft.trim() })
                setAsking(null)
              }}
            >
              Save change
            </Button>
          </>
        }
      >
        {asking && (
          <div className="stack-xs">
            <p className="strong">{asking.taskName}</p>
            <p className="muted">
              The manager said {label(asking.managerSaid)}. You are changing it to {label(asking.to)}.
            </p>
            <div className="field">
              <label className="field-label" htmlFor="change-reason">
                Reason <span className="req">required</span>
              </label>
              <textarea id="change-reason" className="input" rows={3} maxLength={1000} autoFocus value={draft} onChange={(ev) => setDraft(ev.target.value)} placeholder="What have you seen that supports your answer?" />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
