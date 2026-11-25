import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { skipApi } from '../api'
import { Badge, Button, Card, Empty, useToast } from '../components/ui'
import { SCORE_NAME, fmtDate, outOf } from '../employee/logic'
import { NotPublished, PageHead, ScoreChip } from '../employee/shared'
import type { PublishedMe } from '../employee/types'
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
      <Card title="Review your managers' evaluations" description="Each manager scores their own team. Where you see a person differently you can change a skill's score and say why. Where you agree, or do nothing, the manager's score stands.">
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
                  <span className="muted">{cal.evaluated ? `${outOf(cal.evaluated, m.snapshot.clusters.length)} skills evaluated` : 'No evaluation yet'}</span>
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
  // The score chosen for each evaluated skill, and the reason when it differs from the manager's.
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries((snap?.clusters ?? []).filter((c) => c.manager.status === 'calibrated').map((c) => [c.id, c.manager.calibrated])))
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
  const evaluated = snap.clusters.filter((c) => c.manager.status === 'calibrated')
  const missing = evaluated.filter((c) => scores[c.id] !== c.manager.original && !(reasons[c.id] ?? '').trim())
  const changed = evaluated.filter((c) => scores[c.id] !== c.manager.original).length
  const open = snap.calibration.open

  const send = async (body: { agreeAll?: boolean; skills?: Record<string, { score: number | null; reason: string }> }, done: string) => {
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
      { skills: Object.fromEntries(evaluated.map((c) => [c.id, { score: scores[c.id], reason: reasons[c.id] ?? '' }])) },
      changed ? `Saved, ${changed} score${changed === 1 ? '' : 's'} changed` : 'Saved, you agree with the manager',
    )

  return (
    <div className="stack">
      <a className="back-link" href="#/calibration">
        <ArrowLeft size={14} /> Calibration
      </a>
      <PageHead title={`Calibrate ${e.name}`} sub={`${e.designation} · Manager: ${e.manager}`} />
      {!open ? (
        <p className="callout callout-warn">Calibration closed on {fmtDate(snap.calibration.deadline)}. The scores below are final.</p>
      ) : evaluated.length === 0 ? (
        <p className="callout">
          {e.manager} hasn't evaluated {e.name.split(' ')[0]} yet. Once they do, their scores appear here for you to review.
        </p>
      ) : (
        <p className="muted">Pick the score you think is right for each skill. The manager's score is marked. Leave it as it is to agree. A different score needs a reason.</p>
      )}

      {snap.clusters.map((c) => {
        const done = c.manager.status === 'calibrated'
        const diff = done && scores[c.id] !== c.manager.original
        const yes = c.tasks.filter((t) => t.managerAnswer === 'yes').length
        return (
          <Card key={c.id} title={c.name} description={c.description || undefined}>
            {!done ? (
              <p className="muted">Not evaluated by the manager yet.</p>
            ) : (
              <div className="stack-xs">
                <div className="row-between">
                  <span className="muted">
                    Manager's score <ScoreChip score={c.manager.original} /> {SCORE_NAME[c.manager.original]}
                    {c.manager.applicable ? ` · ${outOf(yes, c.manager.applicable)} applicable tasks marked yes` : ''}
                  </span>
                  {c.manager.calibration && <Badge tone={c.manager.calibration.agreed ? 'good' : 'warn'}>{c.manager.calibration.agreed ? 'You agreed' : `You changed it to ${c.manager.calibrated}`}</Badge>}
                </div>
                {c.manager.comment && <p className="muted">Manager's comment: {c.manager.comment}</p>}
                <div className="segmented" role="radiogroup" aria-label={`Score for ${c.name}`}>
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} type="button" role="radio" disabled={!open} aria-checked={scores[c.id] === n} className="segmented-item" onClick={() => setScores({ ...scores, [c.id]: n })}>
                      {n} {SCORE_NAME[n]}
                      {n === c.manager.original ? ' (manager)' : ''}
                    </button>
                  ))}
                </div>
                {diff && (
                  <div className="field">
                    <label className="field-label" htmlFor={`r-${c.id}`}>
                      Why are you changing it? <span className="req">required</span>
                    </label>
                    <textarea id={`r-${c.id}`} className="input" rows={2} maxLength={1000} value={reasons[c.id] ?? ''} onChange={(ev) => setReasons({ ...reasons, [c.id]: ev.target.value })} placeholder="What have you seen that supports this score?" />
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}

      {evaluated.length > 0 && open && (
        <div className="sticky-bar">
          <span className="muted">{changed ? `${changed} skill${changed === 1 ? '' : 's'} changed` : "No changes, the manager's scores stand"}</span>
          <div className="btn-row">
            <Button disabled={busy} onClick={() => void send({ agreeAll: true }, 'Saved, you agree with the manager')}>
              Agree with all
            </Button>
            <Button variant="primary" disabled={busy || missing.length > 0} onClick={() => void save()}>
              <Check size={14} /> Save review
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
