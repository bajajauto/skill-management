import { useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import { meApi } from '../../api'
import { Button, Card, useToast } from '../../components/ui'
import { useMe, usePublishedMe } from '../MeContext'
import { SELF_LABEL, fmtDate, gapSources, managerScore, selfView, summarize, testScore } from '../logic'
import { NotPublished, PageHead } from '../shared'
import type { PublishedMe } from '../types'

export function ReflectionPage() {
  const pub = usePublishedMe()
  if (!pub) {
    return (
      <>
        <PageHead title="Reflection" />
        <NotPublished />
      </>
    )
  }
  const m = pub.me
  return (
    <>
      <PageHead title="Reflection" sub="Step back and look at how you've grown, where your own view and the evidence differ, and what to focus on." />
      {m.clusters.length === 0 ? (
        <Card>
          <p className="muted">No skills are mapped to your level yet.</p>
        </Card>
      ) : (
        <div className="stack">
          <Growth m={m} />
          <SelfVsEvidence m={m} />
          <Focus m={m} />
          <Journal m={m} />
        </div>
      )}
    </>
  )
}

/* -------------------------------- Growth -------------------------------- */

function Delta({ now, before }: { now: number | null; before: number | null }) {
  if (now == null || before == null) return <span className="delta delta-flat">Awaiting result</span>
  const d = Math.round(now - before)
  const Icon = d > 1 ? ArrowUpRight : d < -1 ? ArrowDownRight : Minus
  return (
    <span className="delta" data-dir={d > 1 ? 'up' : d < -1 ? 'down' : 'flat'}>
      <Icon size={14} /> {d > 0 ? '+' : ''}
      {d} pts
    </span>
  )
}

function PairBar({ label, before, now }: { label: string; before: number | null; now: number | null }) {
  return (
    <div className="pair">
      <span className="pair-label">{label}</span>
      <div className="pair-bars">
        <div className="hbar hbar-before" title={`Last cycle: ${before ?? '–'}%`}>
          <span style={{ transform: `scaleX(${(before ?? 0) / 100})` }} />
          <em>{before == null ? '–' : `${Math.round(before)}%`}</em>
        </div>
        <div className="hbar hbar-now" title={`Now: ${now ?? '–'}%`}>
          <span style={{ transform: `scaleX(${(now ?? 0) / 100})` }} />
          <em>{now == null ? '–' : `${Math.round(now)}%`}</em>
        </div>
      </div>
      <Delta now={now} before={before} />
    </div>
  )
}

function Growth({ m }: { m: PublishedMe }) {
  const withBoth = m.clusters.filter((c) => c.test.latest?.pct != null)
  const avgTest = withBoth.length ? withBoth.reduce((a, c) => a + ((c.test.latest!.pct ?? 0) - c.previous.testPct), 0) / withBoth.length : null
  const mgr = m.clusters.filter((c) => c.manager.pct != null && c.previous.managerPct != null)
  const avgMgr = mgr.length ? mgr.reduce((a, c) => a + ((c.manager.pct ?? 0) - (c.previous.managerPct ?? 0)), 0) / mgr.length : null
  const improved = m.clusters.filter((c) => (c.manager.pct ?? 0) - (c.previous.managerPct ?? 0) > 1 || (c.test.latest?.pct ?? 0) - c.previous.testPct > 1).length

  return (
    <Card title="Your growth" description={`Compared with ${m.previousCycle.name}.`}>
      <div className="tally">
        <div className="tally-item" data-tone={avgMgr == null ? 'neutral' : avgMgr >= 0 ? 'good' : 'bad'}>
          <strong>{avgMgr == null ? '–' : `${avgMgr > 0 ? '+' : ''}${Math.round(avgMgr)}`}</strong>
          <span>Avg manager validation (pts)</span>
        </div>
        <div className="tally-item" data-tone={avgTest == null ? 'neutral' : avgTest >= 0 ? 'good' : 'bad'}>
          <strong>{avgTest == null ? '–' : `${avgTest > 0 ? '+' : ''}${Math.round(avgTest)}`}</strong>
          <span>Avg test score (pts)</span>
        </div>
        <div className="tally-item" data-tone="good">
          <strong>
            {improved}/{m.clusters.length}
          </strong>
          <span>Skills improved</span>
        </div>
      </div>
      <div className="legend">
        <span>
          <i className="swatch swatch-before" /> {m.previousCycle.name}
        </span>
        <span>
          <i className="swatch swatch-now" /> Now
        </span>
      </div>
      <ul className="growth-list">
        {m.clusters.map((c) => (
          <li key={c.id}>
            <p className="strong">{c.name}</p>
            <PairBar label="Manager validation" before={c.previous.managerPct} now={c.manager.pct} />
            <PairBar label="Objective test" before={c.previous.testPct} now={c.test.latest?.pct ?? null} />
          </li>
        ))}
      </ul>
      <p className="field-hint">Previous-cycle figures here are sample data until your real history is migrated.</p>
    </Card>
  )
}

/* ---------------------------- Self vs evidence ---------------------------- */

function ScoreBar({ label, value, max = 3 }: { label: string; value: number | null; max?: number }) {
  return (
    <div className="sbar">
      <span>{label}</span>
      <div className="sbar-track">
        <span style={{ transform: `scaleX(${(value ?? 0) / max})` }} data-score={value ?? undefined} />
      </div>
      <b>{value ?? '–'}</b>
    </div>
  )
}

const VIEW_COPY = {
  over: 'You rated yourself higher than the evidence suggests. Worth asking your manager what they look for.',
  under: 'You rated yourself lower than the evidence suggests. You may be more capable than you give yourself credit for.',
  aligned: 'Your view and the evidence line up well.',
  unknown: 'We need your self rating, manager validation and test to compare.',
} as const

function SelfVsEvidence({ m }: { m: PublishedMe }) {
  return (
    <Card title="How you see yourself" description="Your self rating beside what your manager and test results show. Self rating is for reflection only and never changes your results.">
      <ul className="growth-list">
        {m.clusters.map((c) => {
          const v = selfView(c)
          return (
            <li key={c.id}>
              <p className="strong">{c.name}</p>
              <ScoreBar label="Self" value={c.self?.rating ?? null} />
              <ScoreBar label="Manager" value={managerScore(c)} />
              <ScoreBar label="Test" value={testScore(c)} />
              <p className="view-note" data-view={v}>
                {VIEW_COPY[v]}
              </p>
            </li>
          )
        })}
      </ul>
      <p className="field-hint">Self rating scale: {SELF_LABEL.map((l, i) => `${i} ${l}`).join(' · ')}</p>
    </Card>
  )
}

/* ------------------------------ Focus areas ------------------------------ */

function Focus({ m }: { m: PublishedMe }) {
  const s = summarize(m)
  const items = s.gaps.map(({ c }) => ({ c, src: gapSources(c, m.scoring), todo: c.tasks.filter((t) => t.managerAnswer === 'no') }))
  return (
    <Card title="Where to focus" description="Skills where your manager validation or test result is below the target.">
      {items.length === 0 ? (
        <p className="callout callout-good">
          {s.incomplete.length ? 'No gaps so far. Some results are still to come, so check back once they are in.' : 'No development gaps right now. Keep it up.'}
        </p>
      ) : (
        <ul className="focus-list">
          {items.map(({ c, src, todo }) => (
            <li key={c.id}>
              <p className="strong">{c.name}</p>
              <p className="muted">Below target on {src.join(' and ')}.</p>
              {todo.length > 0 && (
                <>
                  <p className="field-label">Tasks your manager hasn't yet seen you do</p>
                  <ul className="bullets">
                    {todo.map((t) => (
                      <li key={t.id}>{t.name}</li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="field-hint">Recommended courses will appear here in the next phase of the platform.</p>
    </Card>
  )
}

/* -------------------------------- Journal -------------------------------- */

const PROMPTS: { key: 'proud' | 'focus' | 'support'; label: string; hint: string }[] = [
  { key: 'proud', label: 'What am I most proud of this cycle?', hint: 'A skill you improved, a task you can now do confidently.' },
  { key: 'focus', label: 'What will I focus on next?', hint: 'One or two skills or tasks you want to get better at.' },
  { key: 'support', label: 'What support would help me?', hint: 'Time, a mentor, practice on the line, training.' },
]

function Journal({ m }: { m: PublishedMe }) {
  const { setMe } = useMe()
  const toast = useToast()
  const [r, setR] = useState({ proud: m.reflection.proud, focus: m.reflection.focus, support: m.reflection.support })
  const [busy, setBusy] = useState(false)
  const dirty = r.proud !== m.reflection.proud || r.focus !== m.reflection.focus || r.support !== m.reflection.support

  const save = async () => {
    setBusy(true)
    try {
      const saved = await meApi.saveReflection(r)
      setMe({ ...m, reflection: saved })
      toast('Reflection saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Your reflection" description="Private notes to help you plan. Writing it down makes it more likely to happen.">
      <div className="stack-sm">
        {PROMPTS.map((p) => (
          <div className="field" key={p.key}>
            <label className="field-label" htmlFor={`ref-${p.key}`}>
              {p.label}
            </label>
            <textarea id={`ref-${p.key}`} className="input" rows={3} maxLength={2000} value={r[p.key]} onChange={(e) => setR({ ...r, [p.key]: e.target.value })} />
            <p className="field-hint">{p.hint}</p>
          </div>
        ))}
        <div className="row-between">
          <span className="muted">{m.reflection.savedAt ? `Last saved ${fmtDate(m.reflection.savedAt)}` : 'Not saved yet'}</span>
          <Button variant="primary" disabled={!dirty || busy} onClick={save}>
            Save reflection <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </Card>
  )
}
