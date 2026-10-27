import { useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useDispatch, usePublish, useStore } from '../../store'
import { Button, Card, ConfirmDialog, SetupGuide, useToast } from '../../components/ui'
import { validate } from '../../lib/validate'
import type { AdminSection } from '../../types'

const AREA: Record<AdminSection, string> = {
  overview: 'Overview',
  framework: 'Framework',
  skills: 'Skill library',
  questions: 'Question bank',
  scoring: 'Scoring',
  publish: 'Publish',
}

export function Publish({ go }: { go: (r: AdminSection) => void }) {
  const state = useStore()
  const dispatch = useDispatch()
  const toast = useToast()
  const publishNow = usePublish()
  const [resetting, setResetting] = useState(false)
  const issues = validate(state)
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const { publication, dirtySincePublish } = state

  return (
    <div className="stack">
      <SetupGuide step="Step 5 of 5 · Validate and publish" title="Release the approved assessment standard" icon="publish">
        Review every error and warning, confirm that the framework and question mappings are complete, then publish a numbered version for the assessment cycle.
      </SetupGuide>
      <Card
        title="Review & publish"
        description="Publishing freezes this setup as a numbered version. Later assessment cycles record which version they used."
        action={
          <Button
            variant="primary"
            disabled={errors.length > 0 || (publication !== null && !dirtySincePublish)}
            onClick={async () => {
              try {
                await publishNow()
              } catch {
                toast('Could not publish. Try again.', 'error')
                return
              }
              toast(`Published version ${(publication?.version ?? 0) + 1}`)
            }}
          >
            {publication ? `Publish v${publication.version + 1}` : 'Publish v1'}
          </Button>
        }
      >
        {errors.length === 0 && warnings.length === 0 ? (
          <p className="all-clear">
            <CheckCircle2 size={16} /> Everything checks out.
          </p>
        ) : (
          <ul className="issues">
            {[...errors, ...warnings].map((i) => (
              <li key={i.id} data-severity={i.severity}>
                {i.severity === 'error' ? <AlertCircle size={16} /> : <AlertTriangle size={16} />}
                <span>{i.message}</span>
                <button className="link-btn" onClick={() => go(i.area)}>
                  {AREA[i.area]}
                </button>
              </li>
            ))}
          </ul>
        )}
        {errors.length > 0 && <p className="field-hint">Resolve {errors.length === 1 ? 'the error' : `all ${errors.length} errors`} to publish. Warnings don't block.</p>}
      </Card>

      <Card title="Danger zone">
        <div className="row-between">
          <div>
            <p className="strong">Reset all setup</p>
            <p className="field-hint">Clears this cohort's draft framework, skills, questions and scoring. The live published version isn't affected until you publish again.</p>
          </div>
          <Button variant="danger" onClick={() => setResetting(true)}>
            Reset
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={resetting}
        danger
        title="Reset everything?"
        confirmLabel="Reset"
        message="The draft's skills, questions and settings will be removed. The live version stays as it is until you publish again."
        onConfirm={() => dispatch({ type: 'reset' })}
        onClose={() => setResetting(false)}
      />
    </div>
  )
}

