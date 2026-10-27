import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { meApi } from '../../api'
import { Button, ConfirmDialog, useToast } from '../../components/ui'
import { useMe, usePublishedMe } from '../MeContext'
import { SCORE_NAME, pctOf } from '../logic'
import { ProgressBar, ScoreChip } from '../shared'
import type { TestResult, TestStart } from '../types'

const LETTERS = ['A', 'B', 'C', 'D']

type Phase = { name: 'loading' } | { name: 'intro' } | { name: 'running'; test: TestStart } | { name: 'result'; result: TestResult } | { name: 'error'; message: string }

export function TestPage({ skillId }: { skillId: string }) {
  const pub = usePublishedMe()
  const { setMe } = useMe()
  const cluster = pub?.me.clusters.find((c) => c.id === skillId)
  const latestId = cluster?.test.latest?.id
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
  }, [latestId, skillId])

  if (!cluster) {
    return (
      <div className="test-shell">
        <BackLink />
        <p className="muted">That test isn't part of your current level.</p>
      </div>
    )
  }

  const start = async () => {
    try {
      setPhase({ name: 'running', test: await meApi.startTest(skillId) })
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : 'Could not start the test.' })
    }
  }

  return (
    <div className="test-shell">
      <BackLink />
      <h1 className="test-title">{cluster.name}</h1>

      {phase.name === 'loading' && <p className="muted">Loading…</p>}
      {phase.name === 'error' && <p className="callout callout-bad">{phase.message}</p>}

      {phase.name === 'intro' && (
        <section className="card stack-sm">
          <h2 className="card-title">Before you begin</h2>
          <ul className="bullets">
            <li>{cluster.test.testLength} multiple-choice question{cluster.test.testLength === 1 ? '' : 's'}, no time limit.</li>
            <li>You get one attempt per skill this cycle, so find a quiet moment.</li>
            <li>Harder questions count for more points.</li>
            <li>You can go back and change answers until you submit.</li>
          </ul>
          <div>
            <Button variant="primary" disabled={!cluster.test.questionCount || cluster.test.attemptsLeft === 0} onClick={start}>
              {cluster.test.inProgressId ? 'Resume test' : 'Start test'} <ArrowRight size={15} />
            </Button>
          </div>
        </section>
      )}

      {phase.name === 'running' && (
        <Runner
          test={phase.test}
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
    <a className="back-link" href="#/assessments/tests">
      <ArrowLeft size={14} /> All tests
    </a>
  )
}

function Runner({ test, onDone }: { test: TestStart; onDone: (r: TestResult) => void }) {
  const toast = useToast()
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const q = test.questions[i]
  const last = i === test.questions.length - 1
  const unanswered = test.questions.length - Object.keys(answers).length

  const submit = async () => {
    setBusy(true)
    try {
      onDone(await meApi.submitTest(test.attemptId, answers))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not submit', 'error')
      setBusy(false)
    }
  }

  return (
    <section className="card stack-sm">
      <div className="row-between">
        <span className="muted">
          Question {i + 1} of {test.questions.length}
        </span>
        <span className="muted">{Object.keys(answers).length} answered</span>
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
          <Button variant="primary" disabled={busy} onClick={() => (unanswered ? setConfirm(true) : submit())}>
            Submit test
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setI(i + 1)}>
            Next <ArrowRight size={14} />
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Submit with unanswered questions?"
        confirmLabel="Submit anyway"
        message={`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered and will count as incorrect. You can't retake this test this cycle.`}
        onConfirm={submit}
        onClose={() => setConfirm(false)}
      />
    </section>
  )
}

function Result({ result }: { result: TestResult }) {
  const { attempt, review } = result
  return (
    <div className="stack">
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">Your result</span>
          <h2 className="hero-title">
            {attempt.correct} of {attempt.total} correct
          </h2>
          <p className="muted">
            Weighted score {pctOf(attempt.pct)}. {attempt.score ? `That places you at ${SCORE_NAME[attempt.score]} for this skill's test.` : ''}
          </p>
        </div>
        <div className="big-score">
          <ScoreChip score={attempt.score} />
          <span>{attempt.score ? SCORE_NAME[attempt.score] : ''}</span>
        </div>
      </section>

      <section className="card stack-sm">
        <h2 className="card-title">Review your answers</h2>
        <ol className="review">
          {review.map((r, n) => (
            <li key={r.id} data-correct={r.isCorrect}>
              <div className="review-head">
                <span className="review-mark">{r.isCorrect ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}</span>
                <span className="strong">
                  {n + 1}. {r.text}
                </span>
              </div>
              <ul className="review-opts">
                {r.options.map((o, idx) => {
                  const letter = LETTERS[idx]
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
          ))}
        </ol>
      </section>
    </div>
  )
}
