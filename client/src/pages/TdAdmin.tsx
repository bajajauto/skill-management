import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { AppIcon, Button, useToast, type AppIconName } from '../components/ui'
import { useSaveNow, useSaveStatus, useStore } from '../store'
import { setupProgress } from '../lib/progress'
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

  return (
    <>
      <header className="page-head">
        <h1>{TITLE[section]}</h1>
        <p className="muted">{BLURB[section]}</p>
      </header>
      <nav className="journey" aria-label="Setup steps">
        {ADMIN_SECTIONS.map((s) => {
          const complete = s.key !== 'overview' && s.key !== 'publish' && done[s.key]
          return (
            <a key={s.key} href={`#/admin/${s.key}`} className="journey-step" data-done={complete} aria-current={section === s.key ? 'page' : undefined}>
              <span className="journey-mark">
                <AppIcon name={s.icon} size={25} />
                {complete && <span className="journey-done"><Check size={9} strokeWidth={3} /></span>}
              </span>
              {s.label}
            </a>
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

/** Back and "Save and next" at the foot of every step. Edits auto-save; this writes them straight away and moves on. */
function StepFooter({ section, onNavigate }: { section: AdminSection; onNavigate: (s: AdminSection) => void }) {
  const saveNow = useSaveNow()
  const save = useSaveStatus()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const i = ADMIN_SECTIONS.findIndex((s) => s.key === section)
  const prev = ADMIN_SECTIONS[i - 1]
  const next = ADMIN_SECTIONS[i + 1]

  const saveAndNext = async () => {
    setBusy(true)
    try {
      await saveNow()
    } catch {
      toast("Couldn't save your changes. Try again.", 'error')
      setBusy(false)
      return
    }
    setBusy(false)
    toast('Saved')
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
        <span className="muted" data-save={save} role="status">
          {SAVE_TEXT[save]}
        </span>
      </div>
      <Button variant="primary" disabled={busy} onClick={saveAndNext}>
        {next ? (
          <>
            Save and next <ArrowRight size={14} />
          </>
        ) : (
          <>
            Save and finish <Check size={14} />
          </>
        )}
      </Button>
    </div>
  )
}
