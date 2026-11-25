import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Lock } from 'lucide-react'
import { AppIcon, Button, useToast, type AppIconName } from '../components/ui'
import { usePublish, useSaveNow, useSaveStatus, useStore } from '../store'
import { validate } from '../lib/validate'
import { lockedSteps, setupProgress } from '../lib/progress'
import { Overview } from './admin/Overview'
import { Framework } from './admin/Framework'
import { Skills } from './admin/Skills'
import { Questions } from './admin/Questions'
import { Scoring } from './admin/Scoring'
import { Publish } from './admin/Publish'
import type { AdminSection } from '../types'

export const ADMIN_SECTIONS: { key: AdminSection; label: string; icon: AppIconName }[] = [
  { key: 'overview', label: 'Overview', icon: 'skill-framework' },
  { key: 'framework', label: 'Framework', icon: 'framework' },
  { key: 'skills', label: 'Skills', icon: 'skills' },
  { key: 'questions', label: 'Questions', icon: 'questions' },
  { key: 'scoring', label: 'Scoring', icon: 'scoring' },
  { key: 'publish', label: 'Publish', icon: 'publish' },
]

const BLURB: Record<AdminSection, string> = {
  overview: 'See the current setup status and understand the complete framework workflow.',
  framework: 'Choose how deep skills go, how people are rated and what proficiency levels exist.',
  skills: 'Bring in the skills and tasks learners will be assessed on.',
  questions: 'Build the question bank that powers the objective test.',
  scoring: 'Decide how ratings turn into scores, gaps and progress.',
  publish: 'Check everything over and make it live.',
}

const TITLE: Record<AdminSection, string> = {
  overview: 'Skill framework overview',
  framework: 'Framework & rating scale',
  skills: 'Skill library',
  questions: 'Question bank',
  scoring: 'Scoring & rules',
  publish: 'Review & publish',
}

/** The TD admin area of the app. Sections are steps on a guided setup path. */
export function TdAdmin({ section, onNavigate }: { section: AdminSection; onNavigate: (s: AdminSection) => void }) {
  const state = useStore()
  const { done } = setupProgress(state)
  const locked = lockedSteps(state)
  const lock = locked[section]
  // The furthest step reached in this visit; the bar lets you go back to any step up to there.
  const at = ADMIN_SECTIONS.findIndex((x) => x.key === section)
  const [furthest, setFurthest] = useState(at)
  useEffect(() => setFurthest((m) => Math.max(m, at)), [at])

  // Typing a later step's address doesn't skip the process: go back to the step still to be finished.
  useEffect(() => {
    if (lock) location.hash = `/admin/${lock.first}`
  }, [lock])
  if (lock) return null

  return (
    <>
      <header className="page-head">
        <h1>{TITLE[section]}</h1>
        <p className="muted">{BLURB[section]}</p>
      </header>
      <nav className="journey" aria-label="Setup steps">
        {ADMIN_SECTIONS.map((s, n) => {
          const blocked = locked[s.key]
          const current = s.key === section
          // A tick means this step is finished and you have already been through it, so a cohort that is already
          // complete doesn't open with every step ticked: they fill in as you go.
          const complete = s.key !== 'overview' && s.key !== 'publish' && done[s.key] && n <= furthest && !current
          // You can step back to anywhere you have already been; steps ahead open only through Save and next.
          const reachable = !blocked && n <= furthest && !current
          const inner = (
            <>
              <span className="journey-mark">
                <AppIcon name={s.icon} size={25} />
                {blocked ? <span className="journey-done"><Lock size={9} strokeWidth={3} /></span> : complete && <span className="journey-done"><Check size={9} strokeWidth={3} /></span>}
              </span>
              {s.label}
            </>
          )
          return reachable ? (
            <a key={s.key} href={`#/admin/${s.key}`} className="journey-step" data-done={complete}>
              {inner}
            </a>
          ) : (
            <span key={s.key} className="journey-step" data-done={complete} aria-current={current ? 'page' : undefined} aria-disabled={blocked ? 'true' : undefined} title={blocked?.message}>
              {inner}
            </span>
          )
        })}
      </nav>
      <div className="page" key={section}>
        {section === 'overview' && <Overview />}
        {section === 'framework' && <Framework />}
        {section === 'skills' && <Skills />}
        {section === 'questions' && <Questions />}
        {section === 'scoring' && <Scoring />}
        {section === 'publish' && <Publish go={onNavigate} />}
      </div>
      <StepFooter section={section} onNavigate={onNavigate} />
    </>
  )
}

const SAVE_TEXT = { saved: 'All changes saved', saving: 'Saving…', error: "Couldn't save yet" } as const

/** Back and "Save and next" (just "Next" on the overview) at the foot of every step. Edits auto-save; this writes them straight away and moves on. */
function StepFooter({ section, onNavigate }: { section: AdminSection; onNavigate: (s: AdminSection) => void }) {
  const saveNow = useSaveNow()
  const publishNow = usePublish()
  const state = useStore()
  const save = useSaveStatus()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const i = ADMIN_SECTIONS.findIndex((s) => s.key === section)
  const prev = ADMIN_SECTIONS[i - 1]
  const next = ADMIN_SECTIONS[i + 1]
  // The last step also releases the setup: finishing with changes waiting would leave them unpublished.
  const toPublish = !next && (state.publication === null || state.dirtySincePublish)

  const saveAndNext = async () => {
    // The overview has nothing to save: it just moves on.
    if (section === 'overview' && next) {
      onNavigate(next.key)
      return
    }
    if (toPublish && validate(state).some((x) => x.severity === 'error')) {
      toast('Resolve the errors above before publishing.', 'error')
      return
    }
    setBusy(true)
    try {
      if (toPublish) await publishNow()
      else await saveNow()
    } catch {
      toast(toPublish ? "Couldn't publish. Try again." : "Couldn't save your changes. Try again.", 'error')
      setBusy(false)
      return
    }
    setBusy(false)
    // This step still has something to finish, so the next one stays closed.
    if (next && lockedSteps(state)[next.key]) {
      toast('Saved. Finish this step to move on to the next.')
      return
    }
    toast(toPublish ? `Published version ${(state.publication?.version ?? 0) + 1}` : 'Saved')
    // The last step has nowhere further in the setup, so finish at the cohort list.
    if (next) onNavigate(next.key)
    else location.hash = '/admin/cohorts/all'
  }

  return (
    <div className="step-footer sticky-bar">
      <div className="step-footer-left">
        {prev ? (
          <a className="btn btn-ghost" href={`#/admin/${prev.key}`}>
            <ArrowLeft size={14} /> Back
          </a>
        ) : null}
        {section !== 'overview' && (
          <span className="muted" data-save={save} role="status">
            {SAVE_TEXT[save]}
          </span>
        )}
      </div>
      <Button variant="primary" disabled={busy} onClick={saveAndNext}>
        {next ? (
          <>
            {section === 'overview' ? 'Next' : 'Save and next'} <ArrowRight size={14} />
          </>
        ) : (
          <>
            {toPublish ? 'Save and publish' : 'Save and finish'} <Check size={14} />
          </>
        )}
      </Button>
    </div>
  )
}
