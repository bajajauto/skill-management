import { useEffect, useRef } from 'react'
import { Check, Minus, Star, X } from 'lucide-react'
import { usePublishedMe } from '../MeContext'
import { SCORE_NAME, SELF_LABEL, clusterStatus, fmtDate, pctOf, gapSources } from '../logic'
import { NotPublished, PageHead, ScoreChip, StatusBadge } from '../shared'
import { Badge, Card } from '../../components/ui'
import type { Cluster, PublishedMe } from '../types'

export function SkillProfile() {
  const pub = usePublishedMe()
  const focusId = useRef<string | null>(null)

  useEffect(() => {
    focusId.current = sessionStorage.getItem('focus-skill')
    sessionStorage.removeItem('focus-skill')
    if (focusId.current) document.getElementById(`skill-${focusId.current}`)?.scrollIntoView({ block: 'start' })
  }, [])

  if (!pub) {
    return (
      <>
        <PageHead title="Skill profile" />
        <NotPublished />
      </>
    )
  }
  const m = pub.me
  const e = m.employee

  return (
    <>
      <PageHead title="Skill profile" sub="Everything that goes into your results, skill by skill." />
      <div className="stack">
        <Card>
          <div className="profile-head">
            <span className="demo-avatar avatar-lg">{e.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
            <div>
              <h2 className="card-title">{e.name}</h2>
              <p className="muted">{e.designation}</p>
            </div>
          </div>
          <dl className="facts">
            <Fact k="Job profile" v={e.jobProfile} />
            <Fact k="Business unit" v={e.businessUnit} />
            <Fact k="Function" v={e.function} />
            <Fact k="Location" v={e.location} />
            <Fact k="Reporting manager" v={e.manager} />
            <Fact k="Skip manager" v={e.skipManager} />
          </dl>
          <div className="divider" />
          <p className="field-label">Proficiency path</p>
          <ol className="path">
            {m.levels.map((l, i) => {
              const cur = m.levels.findIndex((x) => x.id === m.currentLevelId)
              const state = i < cur ? 'done' : i === cur ? 'current' : 'locked'
              return (
                <li key={l.id} data-state={state}>
                  <span className="path-dot">{state === 'done' ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  <span>{l.name}</span>
                  <small>{state === 'current' ? 'You are here' : state === 'locked' ? 'Unlocks after clearing the level before' : 'Completed'}</small>
                </li>
              )
            })}
          </ol>
        </Card>

        {m.clusters.length === 0 ? (
          <Card>
            <p className="muted">No skills are mapped to your level yet.</p>
          </Card>
        ) : (
          m.clusters.map((c) => <SkillCardBlock key={c.id} c={c} m={m} />)
        )}
      </div>
    </>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function SkillCardBlock({ c, m }: { c: Cluster; m: PublishedMe }) {
  const status = clusterStatus(c, m.scoring)
  const adjusted = c.manager.status === 'calibrated' && c.manager.calibrated !== c.manager.original
  const src = gapSources(c, m.scoring)
  return (
    <section className="card skill-block" id={`skill-${c.id}`}>
      <header className="skill-block-head">
        <div>
          <h2 className="card-title">
            {c.name}
            {c.critical && (
              <span className="critical" title="Critical skill">
                <Star size={13} />
              </span>
            )}
          </h2>
          {c.description && <p className="muted">{c.description}</p>}
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="score-cols">
        <div className="score-col">
          <span className="score-col-label">Self rating</span>
          <span className="score-col-value">
            <ScoreChip score={c.self?.rating ?? null} />
            {c.self ? SELF_LABEL[c.self.rating] : 'Not rated'}
          </span>
          <small className="muted">Reflection only. Not used in results.</small>
        </div>
        <div className="score-col">
          <span className="score-col-label">Manager validation</span>
          <span className="score-col-value">
            <ScoreChip score={c.manager.status === 'pending' ? null : c.manager.calibrated} />
            {c.manager.status === 'pending' ? 'Pending' : SCORE_NAME[c.manager.calibrated]}
          </span>
          <small className="muted">
            {c.manager.applicable ? `${c.manager.yes} of ${c.manager.applicable} tasks (${pctOf(c.manager.pct)})` : 'No applicable tasks'}
          </small>
        </div>
        <div className="score-col">
          <span className="score-col-label">Objective test</span>
          <span className="score-col-value">
            <ScoreChip score={c.test.latest?.score ?? null} />
            {c.test.latest?.score ? SCORE_NAME[c.test.latest.score] : 'Not taken'}
          </span>
          <small className="muted">
            {c.test.latest ? `${pctOf(c.test.latest.pct)} · ${fmtDate(c.test.latest.submittedAt)}` : c.test.questionCount ? <a href={`#/assessments/tests/${c.id}`}>Take the test</a> : 'No test available yet'}
          </small>
        </div>
      </div>

      {adjusted && (
        <p className="callout">
          Your manager's rating of {c.manager.original} was {c.manager.calibrated > c.manager.original ? 'raised' : 'lowered'} to {c.manager.calibrated} on review by your skip manager. {c.manager.reason}
        </p>
      )}
      {c.manager.comment && (
        <p className="callout">
          <strong>Your manager's note:</strong> {c.manager.comment}
        </p>
      )}
      {status === 'gap' &&<p className="callout callout-bad">This is a development area because of your {src.join(' and ')} result.</p>}

      <details className="tasks">
        <summary>
          {c.tasks.length} {m.labels.task.toLowerCase()}
          {c.tasks.length === 1 ? '' : 's'} at {m.levels.find((l) => l.id === m.currentLevelId)?.name}
        </summary>
        <ul>
          {c.tasks.map((t) => (
            <li key={t.id}>
              <span className="task-mark" data-answer={t.managerAnswer ?? 'none'} title={t.managerAnswer === 'yes' ? 'Manager: can perform' : t.managerAnswer === 'no' ? 'Manager: not yet' : 'Not applicable'}>
                {t.managerAnswer === 'yes' ? <Check size={12} strokeWidth={3} /> : t.managerAnswer === 'no' ? <X size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
              </span>
              <span>
                {t.name}
                {t.group && <Badge>{t.group}</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
