import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ShieldAlert, X } from 'lucide-react'
import { meApi } from '../../api'
import { Button, ConfirmDialog, useToast } from '../../components/ui'
import { useMe, usePublishedMe } from '../MeContext'
import { SCORE_NAME, outOf, testText } from '../logic'
import { NotPublished, ProgressBar, ScoreChip } from '../shared'
import { REASON, Watermark, enterFullscreen, fullscreenSupported, useTestGuard } from '../testGuard'
import type { ReviewItem, TestResult, TestStart } from '../types'

const LETTERS = ['A', 'B', 'C', 'D']

type Phase = { name: 'loading' } | { name: 'intro' } | { name: 'running'; test: TestStart } | { name: 'result'; result: TestResult } | { name: 'error'; message: string }

/**
 * The objective test: one module with a section for each skill. Every section is scored on its own,
 * the same way the separate per-skill tests were, so what feeds the gap logic is unchanged.
 */
export function TestPage() {
  const pub = usePublishedMe()
  const { me, setMe } = useMe()
  const test = pub?.me.test
  const latestId = test?.latest?.id
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })

  useEffect(() => {
    let cancelled = false
    if (latestId) {
      meApi
        .getAttempt(latestId)
        .then((result) => !cancelled && setPhase({ name: 'result', result }))
        .catch((e: Error) => !cancelled && setPhase({ name: 'error', message: e.message }))
    } else setPhase({ name: 'intro' })
    return () => {
      cancelled = true
    }
  }, [latestId])

  if (!pub || !test) {
    return (
      <div className="test-shell">
        <BackLink />
        <NotPublished />
      </div>
    )
  }

  const start = async () => {
    // Full screen has to be requested straight from the click, before anything is awaited.
    await enterFullscreen()
    try {
      setPhase({ name: 'running', test: await meApi.startTest() })
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : 'Could not start the test.' })
    }
  }

  return (
    <div className="test-shell">
      <BackLink />
      <h1 className="test-title">Objective test</h1>

      {phase.name === 'loading' && <p className="muted">Loading…</p>}
      {phase.name === 'error' && <p className="callout callout-bad">{phase.message}</p>}

      {phase.name === 'intro' && (
        <section className="card stack-sm">
          <h2 className="card-title">Before you begin</h2>
          <ul className="bullets">
            <li>
              One test, {test.testLength} multiple-choice question{test.testLength === 1 ? '' : 's'}, no time limit.
            </li>
            <li>It has a section for each skill. Each section is scored on its own, just as the separate skill tests were.</li>
            <li>You get one attempt this cycle, so find a quiet moment.</li>
            <li>Harder questions count for more points.</li>
            <li>You can move between sections and change answers until you submit.</li>
          </ul>

          <div>
            <p className="field-label">Sections</p>
            <ol className="section-list">
              {test.skills.map((s, n) => (
                <li key={s.id}>
                  <span className="label-num">{n + 1}</span>
                  <span>{s.name}</span>
                  <small className="muted">
                    {s.count} question{s.count === 1 ? '' : 's'}
                  </small>
                </li>
              ))}
            </ol>
          </div>

          <div className="callout callout-warn rules">
            <p className="strong">
              <ShieldAlert size={15} aria-hidden /> Test rules
            </p>
            <ul className="bullets">
              {fullscreenSupported() && <li>The test runs in full screen.</li>}
              <li>Switching tabs or windows{fullscreenSupported() ? ', leaving full screen,' : ''} taking a screenshot or printing counts as a strike, and the questions are hidden until you come back.</li>
              <li>After 3 strikes the test is submitted automatically with the answers you have given so far.</li>
              <li>Copying is blocked, and every question carries your name and ID. Strikes are recorded and visible to your manager.</li>
            </ul>
          </div>
          <div>
            <Button variant="primary" disabled={!test.questionCount || test.attemptsLeft === 0} onClick={start}>
              {test.inProgressId ? 'Resume test' : 'Start test'} <ArrowRight size={15} />
            </Button>
          </div>
        </section>
      )}

      {phase.name === 'running' && (
        <Runner
          test={phase.test}
          watermark={`${me.employee.name} · ${me.employee.employeeId}`}
          onDone={async (result) => {
            setPhase({ name: 'result', result })
            setMe(await meApi.get())
          }}
        />
      )}

      {phase.name === 'result' && <Result result={phase.result} />}
    </div>
  )
}

function BackLink() {
  return (
    <a className="back-link" href="#/assessments">
      <ArrowLeft size={14} /> My assessments
    </a>
  )
}

function Runner({ test, watermark, onDone }: { test: TestStart; watermark: string; onDone: (r: TestResult) => void }) {
  const toast = useToast()
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const answersRef = useRef(answers)
  answersRef.current = answers
  const q = test.questions[i]
  const last = i === test.questions.length - 1
  const unanswered = test.questions.length - Object.keys(answers).length

  // Where each section starts in the question list, and which section the current question belongs to.
  const sections = useMemo(() => {
    let start = 0
    return test.sections.map((s) => {
      const from = start
      start += s.count
      const ids = test.questions.slice(from, start).map((x) => x.id)
      return { ...s, from, ids }
    })
  }, [test])
  const current = sections.findIndex((s) => i >= s.from && i < s.from + s.count)
  const section = sections[current]

  const submit = async (reason?: 'violations') => {
    setBusy(true)
    try {
      onDone(await meApi.submitTest(test.attemptId, answersRef.current, reason))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not submit', 'error')
      setBusy(false)
    }
  }

  const guard = useTestGuard({ attemptId: test.attemptId, maxViolations: test.maxViolations, initialCount: test.violations, onAutoSubmit: () => void submit('violations') })

  // Came back to a test that had already run out of strikes (for example after a reload): finish it now.
  useEffect(() => {
    if (test.violations >= test.maxViolations) void submit('violations')
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="card stack-sm guarded test-running">
      <Watermark text={watermark} />
      {guard.notice && (
        <div className="guard-notice" role="alert">
          <ShieldAlert size={15} aria-hidden /> {guard.notice}
        </div>
      )}
      {guard.paused && (
        <div className="pause-overlay" role="alertdialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="pause-card">
            <ShieldAlert size={30} aria-hidden />
            <h2 id="pause-title">Test paused</h2>
            <p>{REASON[guard.paused]}</p>
            <p className="strong">
              Strike {Math.min(guard.count, test.maxViolations)} of {test.maxViolations}
            </p>
            <p className="muted">
              {guard.remaining > 0
                ? `${guard.remaining} more and the test is submitted automatically with your answers so far.`
                : 'The test is being submitted with your answers so far.'}
            </p>
            {guard.remaining > 0 && (
              <Button variant="primary" onClick={guard.resume}>
                Return to the test
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="strike-chip" data-hot={guard.count > 0} title="Times you left the test">
        Strikes {Math.min(guard.count, test.maxViolations)}/{test.maxViolations}
      </div>

      <nav className="section-tabs" aria-label="Test sections">
        {sections.map((s, n) => {
          const done = s.ids.filter((id) => answers[id]).length
          return (
            <button key={s.id} type="button" className="section-tab" aria-current={n === current ? 'step' : undefined} data-done={done === s.count} onClick={() => setI(s.from)} title={s.name}>
              <span className="section-tab-name">{s.name}</span>
              <span className="section-tab-count">
                {done}/{s.count}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="row-between">
        <span className="muted">
          <strong>{section.name}</strong> · Question {i - section.from + 1} of {section.count}
        </span>
        <span className="muted">{Object.keys(answers).length} of {test.questions.length} answered</span>
      </div>
      <ProgressBar value={i + 1} max={test.questions.length} label="Test progress" />

      <h2 className="q-text">{q.text}</h2>
      <div className="options" role="radiogroup" aria-label="Answer options">
        {q.options.map((opt, idx) => (
          <button key={idx} type="button" role="radio" aria-checked={answers[q.id] === LETTERS[idx]} className="option" onClick={() => setAnswers({ ...answers, [q.id]: LETTERS[idx] })}>
            <span className="option-letter">{LETTERS[idx]}</span>
            {opt}
          </button>
        ))}
      </div>

      <div className="row-between">
        <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ArrowLeft size={14} /> Previous
        </Button>
        {last ? (
          <Button variant="primary" disabled={busy} onClick={() => (unanswered ? setConfirm(true) : void submit())}>
            Submit test
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setI(i + 1)}>
            {i + 1 === section.from + section.count ? 'Next section' : 'Next'} <ArrowRight size={14} />
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Submit with unanswered questions?"
        confirmLabel="Submit anyway"
        message={`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered and will count as incorrect. You can't retake this test this cycle.`}
        onConfirm={() => void submit()}
        onClose={() => setConfirm(false)}
      />
    </section>
  )
}

const LETTER = ['A', 'B', 'C', 'D']

function Result({ result }: { result: TestResult }) {
  const { attempt, review, breakdown } = result

  // Group the review by section, keeping the order the sections came in.
  const groups = useMemo(() => {
    const out: { id: string; name: string; items: ReviewItem[] }[] = []
    for (const r of review) {
      const g = out.find((x) => x.id === r.skillId)
      if (g) g.items.push(r)
      else out.push({ id: r.skillId, name: r.skill, items: [r] })
    }
    return out
  }, [review])

  let n = 0
  return (
    <div className="stack">
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">Your result</span>
          <h2 className="hero-title">
            {outOf(attempt.correct ?? 0, attempt.total)} correct
          </h2>
          <p className="muted">Each skill section is scored on its own below. Those section scores are what your skill results use.</p>
        </div>
        <div className="big-score">
          <ScoreChip score={attempt.score} />
          <span>Overall {testText(attempt)}</span>
        </div>
      </section>

      {attempt.violations > 0 && (
        <p className="callout callout-warn" role="status">
          <ShieldAlert size={15} aria-hidden />{' '}
          {attempt.autoSubmitted
            ? `This test was submitted automatically after ${attempt.violations} strikes for leaving the test. Your answers up to that point were scored.`
            : `${attempt.violations} strike${attempt.violations === 1 ? '' : 's'} recorded for leaving the test.`}{' '}
          Your manager can see this.
        </p>
      )}

      <section className="card stack-sm">
        <h2 className="card-title">Your score by skill</h2>
        <ul className="section-scores">
          {breakdown.map((b) => (
            <li key={b.skillId}>
              <ScoreChip score={b.score} />
              <span className="strong">{b.name}</span>
              <span className="muted">
                {outOf(b.correct ?? 0, b.total)} correct{b.possible != null && b.earned != null ? ` · ${testText(b)}` : ''}
              </span>
              <span className="section-score-name">{b.score ? SCORE_NAME[b.score] : ''}</span>
            </li>
          ))}
        </ul>
      </section>

      {groups.map((g) => (
        <section key={g.id} className="card stack-sm">
          <h2 className="card-title">{g.name}</h2>
          <ol className="review">
            {g.items.map((r) => {
              n++
              return (
                <li key={r.id} data-correct={r.isCorrect}>
                  <div className="review-head">
                    <span className="review-mark">{r.isCorrect ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}</span>
                    <span className="strong">
                      {n}. {r.text}
                    </span>
                  </div>
                  <ul className="review-opts">
                    {r.options.map((o, idx) => {
                      const letter = LETTER[idx]
                      const state = letter === r.correct ? 'correct' : letter === r.chosen ? 'wrong' : 'plain'
                      return (
                        <li key={letter} data-state={state}>
                          <span className="option-letter">{letter}</span>
                          {o}
                          {letter === r.chosen && <small>Your answer</small>}
                        </li>
                      )
                    })}
                  </ul>
                  {!r.chosen && <p className="field-hint">You didn't answer this one.</p>}
                  {r.explanation && <p className="explain">{r.explanation}</p>}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
