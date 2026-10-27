import { useState } from 'react'
import { ArrowRight, Check, Lock, RotateCcw } from 'lucide-react'
import { meApi } from '../../api'
import { Badge, Button, Card, ConfirmDialog, useToast } from '../../components/ui'
import { useMe, usePublishedMe } from '../MeContext'
import { SELF_LABEL, daysUntil, fmtDate, pctOf, summarize } from '../logic'
import { NotPublished, PageHead, ProgressBar, ScoreChip } from '../shared'
import { TestPage } from './TestPage'
import type { PublishedMe } from '../types'

const TABS = [
  { key: 'overview', label: 'Overview', href: '#/assessments' },
  { key: 'self', label: 'Self assessment', href: '#/assessments/self' },
  { key: 'tests', label: 'Objective tests', href: '#/assessments/tests' },
] as const

export function Assessments({ tab, skillId }: { tab: 'overview' | 'self' | 'tests'; skillId?: string }) {
  const pub = usePublishedMe()
  if (!pub) {
    return (
      <>
        <PageHead title="My assessments" />
        <NotPublished />
      </>
    )
  }
  // A single test is a focused, full-width view with no tab bar.
  if (tab === 'tests' && skillId) return <TestPage skillId={skillId} />

  return (
    <>
      <PageHead title="My assessments" sub={`${pub.me.cycle.name} · due ${fmtDate(pub.me.cycle.due)}`} />
      <nav className="journey" aria-label="Assessment sections">
        {TABS.map((t) => (
          <a key={t.key} href={t.href} className="journey-step" aria-current={tab === t.key ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      {tab === 'overview' && <Overview m={pub.me} />}
      {tab === 'self' && <SelfAssessment m={pub.me} />}
      {tab === 'tests' && <TestList m={pub.me} />}
    </>
  )
}

/* -------------------------------- Overview -------------------------------- */

function Overview({ m }: { m: PublishedMe }) {
  const { setMe } = useMe()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const s = summarize(m)
  const days = daysUntil(m.cycle.due)
  const cards = [
    {
      title: 'Self assessment',
      body: 'Rate how confident you feel in each skill. It is for your own reflection and does not affect your results.',
      status: s.selfDone ? 'Submitted' : s.selfDraftCount ? 'In progress' : 'Not started',
      tone: s.selfDone ? 'good' : s.selfDraftCount ? 'warn' : 'neutral',
      value: s.selfDraftCount,
      max: m.clusters.length,
      cta: s.selfDone ? 'View responses' : s.selfDraftCount ? 'Continue' : 'Start',
      href: '#/assessments/self',
    },
    {
      title: 'Manager validation',
      body: `${m.employee.manager} confirms which tasks you can perform. Your skip manager reviews the rating.`,
      status: s.managerDone === m.clusters.length ? 'Complete' : `${s.managerDone} of ${m.clusters.length} done`,
      tone: s.managerDone === m.clusters.length ? 'good' : 'warn',
      value: s.managerDone,
      max: m.clusters.length,
      cta: 'See results',
      href: '#/profile',
    },
    {
      title: 'Objective tests',
      body: 'A short multiple-choice test for each skill. One attempt per skill each cycle.',
      status: s.testsLeft.length === 0 && s.testableCount > 0 ? 'Complete' : `${s.testsTaken} of ${m.clusters.length} taken`,
      tone: s.testsLeft.length === 0 && s.testableCount > 0 ? 'good' : s.testsTaken ? 'warn' : 'neutral',
      value: s.testsTaken,
      max: m.clusters.length,
      cta: s.testsLeft.length ? 'Take a test' : 'View results',
      href: '#/assessments/tests',
    },
  ] as const

  return (
    <div className="stack">
      {days != null && days >= 0 && days <= 14 && !(s.selfDone && s.testsLeft.length === 0) && (
        <p className="callout callout-warn">
          {days} day{days === 1 ? '' : 's'} left in this cycle. Finish your self assessment and tests before {fmtDate(m.cycle.due)}.
        </p>
      )}
      <div className="assess-grid">
        {cards.map((c) => (
          <section key={c.title} className="card assess-card">
            <div className="row-between">
              <h2 className="card-title">{c.title}</h2>
              <Badge tone={c.tone}>{c.status}</Badge>
            </div>
            <p className="muted">{c.body}</p>
            <ProgressBar value={c.value} max={c.max} label={`${c.title} progress`} />
            <a className="step-cta" href={c.href}>
              {c.cta} <ArrowRight size={14} />
            </a>
          </section>
        ))}
      </div>

      <Card title="Demo controls" description="Restores your self assessment, test attempts and reflection to the starting demo state so you can walk through the flow again.">
        <Button size="sm" onClick={() => setConfirm(true)}>
          <RotateCcw size={14} /> Reset my demo progress
        </Button>
      </Card>
      <ConfirmDialog
        open={confirm}
        danger
        title="Reset your progress?"
        confirmLabel="Reset"
        message="Your ratings, test attempts and reflection notes go back to the starting demo state. Manager results are not affected."
        onConfirm={async () => {
          setMe(await meApi.reset())
          toast('Progress reset')
        }}
        onClose={() => setConfirm(false)}
      />
    </div>
  )
}

/* ---------------------------- Self assessment ---------------------------- */

function SelfAssessment({ m }: { m: PublishedMe }) {
  const { setMe } = useMe()
  const toast = useToast()
  const locked = m.self.submittedAt != null
  const [draft, setDraft] = useState<Record<string, { rating: number | null; comment: string }>>(() =>
    Object.fromEntries(m.clusters.map((c) => [c.id, { rating: c.self?.rating ?? null, comment: c.self?.comment ?? '' }])),
  )
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const rated = Object.values(draft).filter((d) => d.rating != null).length
  const all = rated === m.clusters.length && m.clusters.length > 0

  const save = async (submit: boolean) => {
    setBusy(true)
    try {
      const ratings = Object.fromEntries(Object.entries(draft).filter(([, d]) => d.rating != null).map(([id, d]) => [id, { rating: d.rating as number, comment: d.comment }]))
      const next = await meApi.saveSelf(ratings, submit)
      setMe(next)
      toast(submit ? 'Self assessment submitted' : 'Draft saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (m.clusters.length === 0) return <Card><p className="muted">No skills are mapped to your level yet.</p></Card>

  return (
    <div className="stack">
      <Card
        title={locked ? 'Submitted' : 'How confident are you?'}
        description={
          locked
            ? `You submitted on ${fmtDate(m.self.submittedAt)}. You can revisit it in your reflection.`
            : 'Be honest. This is only for you: it is shown beside your manager and test results, but never changes them.'
        }
      >
        <div className="scale-key">
          {SELF_LABEL.map((l, i) => (
            <span key={l}>
              <ScoreChip score={i || null} /> {i} · {l}
            </span>
          ))}
        </div>
      </Card>

      {m.clusters.map((c) => {
        const d = draft[c.id]
        return (
          <section key={c.id} className="card self-item">
            <div>
              <h3 className="strong">{c.name}</h3>
              {c.description && <p className="muted">{c.description}</p>}
              <p className="field-hint">{c.tasks.length} tasks at this level</p>
            </div>
            <div className="rate" role="radiogroup" aria-label={`Rating for ${c.name}`}>
              {SELF_LABEL.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={d.rating === i}
                  disabled={locked}
                  className="rate-opt"
                  onClick={() => setDraft({ ...draft, [c.id]: { ...d, rating: i } })}
                >
                  <strong>{i}</strong>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <textarea
              className="input"
              rows={2}
              disabled={locked}
              placeholder="Anything you'd like to note? (optional)"
              aria-label={`Notes for ${c.name}`}
              value={d.comment}
              onChange={(e) => setDraft({ ...draft, [c.id]: { ...d, comment: e.target.value } })}
            />
          </section>
        )
      })}

      {!locked && (
        <div className="sticky-bar">
          <span className="muted">
            {rated} of {m.clusters.length} rated
          </span>
          <div className="btn-row">
            <Button disabled={busy || rated === 0} onClick={() => save(false)}>
              Save draft
            </Button>
            <Button variant="primary" disabled={busy || !all} onClick={() => setConfirm(true)}>
              <Check size={14} /> Submit
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title="Submit your self assessment?"
        confirmLabel="Submit"
        message="You won't be able to change your ratings after submitting."
        onConfirm={() => save(true)}
        onClose={() => setConfirm(false)}
      />
    </div>
  )
}

/* ------------------------------ Objective tests ------------------------------ */

function TestList({ m }: { m: PublishedMe }) {
  if (m.clusters.length === 0) return <Card><p className="muted">No skills are mapped to your level yet.</p></Card>
  return (
    <div className="stack">
      <Card title="One attempt per skill" description="Each test is a short set of multiple-choice questions with no time limit. Once you submit, you'll see which answers were right and why.">
        <ul className="test-list">
          {m.clusters.map((c) => {
            const t = c.test
            const done = t.latest
            return (
              <li key={c.id} className="test-row">
                <div>
                  <p className="strong">{c.name}</p>
                  <p className="muted">
                    {done
                      ? `Taken ${fmtDate(done.submittedAt)} · ${done.correct} of ${done.total} correct · ${pctOf(done.pct)}`
                      : t.questionCount
                        ? `${t.testLength} question${t.testLength === 1 ? '' : 's'}${t.inProgressId ? ' · in progress' : ''}`
                        : 'No questions available yet'}
                  </p>
                </div>
                {done ? <ScoreChip score={done.score} /> : null}
                {done ? (
                  <a className="btn btn-sm" href={`#/assessments/tests/${c.id}`}>
                    View result
                  </a>
                ) : t.questionCount ? (
                  <a className="btn btn-sm btn-primary" href={`#/assessments/tests/${c.id}`}>
                    {t.inProgressId ? 'Resume' : 'Start'} <ArrowRight size={13} />
                  </a>
                ) : (
                  <span className="muted test-locked">
                    <Lock size={13} /> Unavailable
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
