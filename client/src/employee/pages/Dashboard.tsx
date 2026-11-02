import { ArrowRight, Check, CircleDashed } from 'lucide-react'
import { usePublishedMe, useMe } from '../MeContext'
import { daysUntil, evaluationOf, fmtDate, managerScore, summarize, testScore } from '../logic'
import { NotPublished, PageHead, ProgressBar, ScoreChip, StatusBadge } from '../shared'
import { Badge, Card } from '../../components/ui'
import type { MeEmployee } from '../types'

export function Dashboard() {
  const { me } = useMe()
  const pub = usePublishedMe()
  const first = me.employee.name.split(' ')[0]

  if (!pub) {
    return (
      <>
        <PageHead title={`Hi ${first}`} sub="Welcome to your skills journey." />
        <div className="dash">
          <div className="stack dash-main">
            <NotPublished />
            <div className="assess-grid assess-grid-2">
              {[
                ['Self assessment', 'Rate your confidence in each skill. For your own reflection only.'],
                ['Objective test', 'One multiple-choice test with a section for each skill. One attempt this cycle.'],
              ].map(([title, body]) => (
                <section key={title} className="card assess-card">
                  <div className="row-between">
                    <h2 className="card-title">{title}</h2>
                    <Badge>Not open yet</Badge>
                  </div>
                  <p className="muted">{body}</p>
                  <ProgressBar value={0} max={1} label={`${title} progress`} />
                </section>
              ))}
            </div>
          </div>
          <aside>
            <ParticipantCard e={me.employee} />
          </aside>
        </div>
      </>
    )
  }
  const m = pub.me
  const s = summarize(m)
  const ev = evaluationOf(m)
  const days = daysUntil(m.cycle.due)

  // The single most useful thing to do next.
  const next = !s.selfDone
    ? { text: 'Complete your self assessment', sub: `${s.selfDraftCount} of ${m.clusters.length} skills rated`, href: '#/assessments/self' }
    : s.testToTake
      ? { text: s.testStarted ? 'Finish your objective test' : 'Take your objective test', sub: `One test with ${m.test.skills.length} sections, one per skill`, href: '#/assessments/tests' }
      : s.gaps.length
        ? { text: 'Review your development areas', sub: `${s.gaps.length} skill${s.gaps.length > 1 ? 's' : ''} to focus on`, href: '#/reflection' }
        : { text: 'See your skill card', sub: 'A summary you can share', href: '#/card' }

  const steps = [
    { label: 'Self assessment', done: s.selfDone, detail: s.selfDone ? 'Submitted' : `${s.selfDraftCount}/${m.clusters.length} rated`, href: '#/assessments/self' },
    { label: 'Manager evaluation', done: ev.state === 'done', detail: ev.state === 'done' ? 'Done' : ev.state === 'progress' ? 'In progress' : 'Not started', href: '#/profile' },
    { label: 'Objective test', done: s.testDone && s.testableCount > 0, detail: s.testDone ? 'Taken' : s.testStarted ? 'In progress' : 'Not taken', href: '#/assessments/tests' },
  ]

  return (
    <>
      <PageHead title={`Hi ${first}`} sub={`${m.employee.jobProfile} · ${m.employee.businessUnit}`} />

      <div className="dash">
      <div className="stack dash-main">
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              {m.cycle.name}
              {days != null && days >= 0 ? ` · ${days} day${days === 1 ? '' : 's'} left` : days != null ? ' · past due' : ''}
            </span>
            <h2 className="hero-title">{next.text}</h2>
            <p className="muted">{next.sub}</p>
            <a className="btn btn-primary" href={next.href} style={{ textDecoration: 'none' }}>
              Continue <ArrowRight size={15} />
            </a>
          </div>
          <div className="level-stat">
            <span className="level-stat-label">Current level</span>
            <strong className="level-stat-value">{s.level?.name}</strong>
            <span className="muted">
              {s.cleared.length} of {m.clusters.length} skills cleared
            </span>
            <ProgressBar value={s.cleared.length} max={m.clusters.length} label="Skills cleared at your level" />
          </div>
        </section>

        <div className="assess-grid assess-grid-2">
          <section className="card assess-card">
            <div className="row-between">
              <h2 className="card-title">Self assessment</h2>
              <Badge tone={s.selfDone ? 'good' : s.selfDraftCount ? 'warn' : 'neutral'}>{s.selfDone ? 'Submitted' : s.selfDraftCount ? 'In progress' : 'Not started'}</Badge>
            </div>
            <p className="muted">Rate your confidence in each skill. For your own reflection only.</p>
            <ProgressBar value={s.selfDraftCount} max={m.clusters.length} label="Self assessment progress" />
            <span className="muted">{s.selfDraftCount} of {m.clusters.length} skills rated</span>
            <a className="step-cta" href="#/assessments/self">
              {s.selfDone ? 'View responses' : s.selfDraftCount ? 'Continue' : 'Start'} <ArrowRight size={14} />
            </a>
          </section>
          <section className="card assess-card">
            <div className="row-between">
              <h2 className="card-title">Objective test</h2>
              <Badge tone={s.testDone && s.testableCount > 0 ? 'good' : s.testStarted ? 'warn' : 'neutral'}>
                {s.testDone && s.testableCount > 0 ? 'Complete' : s.testStarted ? 'In progress' : 'Not started'}
              </Badge>
            </div>
            <p className="muted">One multiple-choice test with a section for each skill. One attempt this cycle.</p>
            <ProgressBar value={s.testsTaken} max={m.clusters.length} label="Objective test progress" />
            <span className="muted">{s.testsTaken} of {m.clusters.length} skill sections scored</span>
            <a className="step-cta" href="#/assessments/tests">
              {s.testToTake ? (s.testStarted ? 'Resume test' : 'Take the test') : 'View results'} <ArrowRight size={14} />
            </a>
          </section>
        </div>

        <div className="grid-2">
          <Card title="This cycle" description={`Opened ${fmtDate(m.cycle.opens)} · due ${fmtDate(m.cycle.due)}`}>
            <ul className="cycle-steps">
              {steps.map((st) => (
                <li key={st.label}>
                  <a href={st.href} className="cycle-step" data-done={st.done}>
                    <span className="cycle-mark">{st.done ? <Check size={14} strokeWidth={3} /> : <CircleDashed size={14} />}</span>
                    <span className="strong">{st.label}</span>
                    <span className="muted">{st.detail}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Where you stand" description="Based on manager evaluation and your objective test.">
            <div className="tally">
              <Tally n={s.cleared.length} label="Cleared" tone="good" />
              <Tally n={s.gaps.length} label="Gaps" tone="bad" />
              <Tally n={s.incomplete.length} label="Awaiting" tone="neutral" />
            </div>
            {s.allCleared && (
              <p className="callout">{s.nextLevel ? `Every ${m.labels.skill.toLowerCase()} at ${s.level?.name} is cleared. ${s.nextLevel.name} unlocks next.` : 'Every skill is cleared. Well done.'}</p>
            )}
          </Card>
        </div>

        <Card title={`Your ${m.labels.skill.toLowerCase()}s at ${s.level?.name}`} description="Tap any skill to see the tasks and scores behind it.">
          {m.clusters.length === 0 ? (
            <p className="muted">No skills are mapped to your level yet.</p>
          ) : (
            <ul className="skill-grid">
              {s.rows.map(({ c, status }) => (
                <li key={c.id}>
                  <a className="skill-tile" href="#/profile" onClick={() => sessionStorage.setItem('focus-skill', c.id)}>
                    <span className="skill-tile-top">
                      <span className="strong">{c.name}</span>
                      <StatusBadge status={status} />
                    </span>
                    <span className="skill-tile-scores">
                      <span>Manager <ScoreChip score={managerScore(c)} /></span>
                      <span>Test <ScoreChip score={testScore(c)} /></span>
                      <span>Self <ScoreChip score={c.self?.rating ?? null} /></span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <aside>
        <ParticipantCard e={m.employee} />
      </aside>
      </div>
    </>
  )
}

function ParticipantCard({ e }: { e: MeEmployee }) {
  const rows: [string, string][] = [
    ['Email', e.email],
    ['Job level', e.jobLevel],
    ['Department', e.function],
    ['Location', e.location],
    ['Skip manager', e.skipManager],
    ['BU Head', e.buHead],
    ['BUHR', e.buhr],
  ]
  return (
    <section className="card participant">
      <h2 className="card-title">Participant details</h2>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Tally({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="tally-item" data-tone={tone}>
      <strong>{n}</strong>
      <span>{label}</span>
    </div>
  )
}
