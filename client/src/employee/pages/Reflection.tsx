import { useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import { meApi } from '../../api'
import { Button, Card, useToast } from '../../components/ui'
import { useMe, usePublishedMe } from '../MeContext'
import { SELF_LABEL, fmtDate, fmtNum, gapSources, managerScore, outOf, selfView, summarize, testMeasure, testScore } from '../logic'
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

/** How the change reads: "+1 task", "-2 points", or "No change". */
function Delta({ now, before, unit }: { now: number | null; before: number | null; unit: [string, string] }) {
  if (now == null || before == null) return <span className="delta delta-flat">Awaiting result</span>
  const d = Math.round((now - before) * 2) / 2
  const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat'
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus
  return (
    <span className="delta" data-dir={dir}>
      <Icon size={14} /> {d === 0 ? 'No change' : `${d > 0 ? '+' : '-'}${fmtNum(Math.abs(d))} ${Math.abs(d) === 1 ? unit[0] : unit[1]}`}
    </span>
  )
}

/** Last cycle against now, both as a number out of the same maximum. */
function PairBar({ label, before, now, max, unit }: { label: string; before: number | null; now: number | null; max: number | null; unit: [string, string] }) {
  const show = (v: number | null) => (v == null || max == null ? '–' : outOf(v, max))
  const width = (v: number | null) => (v == null || !max ? 0 : Math.min(1, v / max))
  return (
    <div className="pair">
      <span className="pair-label">{label}</span>
      <div className="pair-bars">
        <div className="hbar hbar-before" title={`Last cycle: ${show(before)}`}>
          <span style={{ transform: `scaleX(${width(before)})` }} />
          <em>{show(before)}</em>
        </div>
        <div className="hbar hbar-now" title={`Now: ${show(now)}`}>
          <span style={{ transform: `scaleX(${width(now)})` }} />
          <em>{show(now)}</em>
        </div>
      </div>
      <Delta now={now} before={before} unit={unit} />
    </div>
  )
}

const TASK: [string, string] = ['task', 'tasks']
const POINT: [string, string] = ['point', 'points']

/** One skill's manager and test results as numbers, with last cycle's worked out on the same scale. */
function growthOf(c: PublishedMe['clusters'][number]) {
  const mgrMax = c.manager.status === 'calibrated' && c.manager.applicable ? c.manager.applicable : null
  const mgrNow = mgrMax != null ? c.manager.yes : null
  const mgrBefore = mgrMax != null && c.previous.managerPct != null ? Math.round((c.previous.managerPct / 100) * mgrMax) : null

  const t = c.test.latest ? testMeasure(c.test.latest) : null
  const testBefore = t && c.previous.testPct != null ? Math.round(((c.previous.testPct / 100) * t.max) * 2) / 2 : null
  const testUnit: [string, string] = c.test.latest && c.test.latest.possible != null ? POINT : ['question', 'questions']
  return { mgrMax, mgrNow, mgrBefore, test: t, testBefore, testUnit }
}

function Growth({ m }: { m: PublishedMe }) {
  const rows = m.clusters.map((c) => ({ c, g: growthOf(c) }))
  const mgrCompared = rows.filter(({ g }) => g.mgrNow != null && g.mgrBefore != null)
  const testCompared = rows.filter(({ g }) => g.test != null && g.testBefore != null)
  const mgrUp = mgrCompared.filter(({ g }) => (g.mgrNow as number) > (g.mgrBefore as number)).length
  const testUp = testCompared.filter(({ g }) => (g.test!.value as number) > (g.testBefore as number)).length
  const improved = rows.filter(({ g }) => ((g.mgrNow ?? 0) > (g.mgrBefore ?? Infinity)) || ((g.test?.value ?? 0) > (g.testBefore ?? Infinity))).length

  return (
    <Card title="Your growth" description={`Compared with ${m.previousCycle.name}.`}>
      <div className="tally">
        <div className="tally-item" data-tone={mgrCompared.length && mgrUp === 0 ? 'bad' : 'good'}>
          <strong>{mgrCompared.length ? outOf(mgrUp, mgrCompared.length) : '–'}</strong>
          <span>Skills with a higher manager score</span>
        </div>
        <div className="tally-item" data-tone={testCompared.length && testUp === 0 ? 'bad' : 'good'}>
          <strong>{testCompared.length ? outOf(testUp, testCompared.length) : '–'}</strong>
          <span>Skills with a higher test score</span>
        </div>
        <div className="tally-item" data-tone="good">
          <strong>{outOf(improved, m.clusters.length)}</strong>
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
        {rows.map(({ c, g }) => (
          <li key={c.id}>
            <p className="strong">{c.name}</p>
            <PairBar label="Manager evaluation" before={g.mgrBefore} now={g.mgrNow} max={g.mgrMax} unit={TASK} />
            <PairBar label="Objective test" before={g.testBefore} now={g.test?.value ?? null} max={g.test?.max ?? null} unit={g.testUnit} />
          </li>
        ))}
      </ul>
      {mgrCompared.length + testCompared.length === 0 ? (
        <p className="field-hint">There are no previous-cycle results to compare with yet.</p>
      ) : (
        <p className="field-hint">Previous-cycle figures here are sample data until your real history is migrated.</p>
      )}
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
  unknown: 'We need your self rating, manager evaluation and test to compare.',
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
    <Card title="Where to focus" description="Skills where your manager evaluation or test result is below the target.">
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
