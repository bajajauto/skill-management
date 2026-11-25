import { useState } from 'react'
import { ArrowRight, FilePen, Pencil, Plus, Trash2 } from 'lucide-react'
import { cohortApi } from '../api'
import { Badge, Button, ConfirmDialog, useToast } from '../components/ui'
import { cohortLabel, isBlankDraft, useCohorts } from '../cohorts/CohortsContext'
import { useNewCohort } from '../cohorts/useNewCohort'
import type { CohortSummary } from '../types'

const STATUS: Record<CohortSummary['status'], { label: string; tone?: 'good' | 'warn' }> = {
  draft: { label: 'Draft' },
  live: { label: 'Live', tone: 'good' },
  completed: { label: 'Completed' },
}

/** Where Skill Framework Setup begins: set up a new cohort, or pick an existing one to edit. */
export function SetupStart() {
  const { cohorts, refresh, select } = useCohorts()
  const toast = useToast()
  // What is waiting on a yes: one draft, or every draft.
  const [deleting, setDeleting] = useState<CohortSummary | 'all' | null>(null)
  const newCohort = useNewCohort()
  const [picking, setPicking] = useState<'drafts' | 'existing' | null>(null)
  const drafts = cohorts?.filter((c) => c.status === 'draft' && !isBlankDraft(c)) ?? []
  const existing = cohorts?.filter((c) => c.status !== 'draft') ?? []
  const removeDrafts = async () => {
    const targets = deleting === 'all' ? drafts : deleting ? [deleting] : []
    try {
      await Promise.all(targets.map((c) => cohortApi.remove(c.id)))
      toast(targets.length === 1 ? 'Draft deleted' : `${targets.length} drafts deleted`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', 'error')
    }
    await refresh()
  }
  const list = picking === 'drafts' ? drafts : existing

  return (
    <div className="page stack">
      <header className="page-head">
        <h1>Skill Framework Setup</h1>
        <p className="muted">Start a new cohort, carry on with a draft, or open an existing live cohort to change it.</p>
      </header>

      <div className="module-grid">
        <button type="button" className="module-card" disabled={newCohort.busy} onClick={newCohort.start}>
          <span className="module-top">
            <span className="tile tile-3d" style={{ ['--tile' as string]: 'var(--tile-sage)' }}>
              <Plus size={40} aria-hidden />
            </span>
          </span>
          <span>
            <strong className="module-title">Set up a new cohort</strong>
            <span className="module-description">Create a blank cohort and go through the setup steps: framework, skills, questions, scoring and publish.</span>
          </span>
          <span className="module-action">
            Start <ArrowRight size={14} />
          </span>
        </button>

        <button type="button" className="module-card" aria-expanded={picking === 'drafts'} onClick={() => setPicking((p) => (p === 'drafts' ? null : 'drafts'))}>
          <span className="module-top">
            <span className="tile tile-3d" style={{ ['--tile' as string]: 'var(--tile-sand)' }}>
              <FilePen size={36} aria-hidden />
            </span>
            {drafts.length > 0 && <span className="module-status">{drafts.length}</span>}
          </span>
          <span>
            <strong className="module-title">Continue a draft</strong>
            <span className="module-description">Pick up a cohort you started setting up but haven't published yet.</span>
          </span>
          <span className="module-action">
            {picking === 'drafts' ? 'Hide list' : 'Choose a draft'} <ArrowRight size={14} />
          </span>
        </button>

        <button type="button" className="module-card" aria-expanded={picking === 'existing'} onClick={() => setPicking((p) => (p === 'existing' ? null : 'existing'))}>
          <span className="module-top">
            <span className="tile tile-3d" style={{ ['--tile' as string]: 'var(--tile-sky)' }}>
              <Pencil size={36} aria-hidden />
            </span>
          </span>
          <span>
            <strong className="module-title">Edit an existing cohort</strong>
            <span className="module-description">Pick a live or completed cohort from the list and change its setup.</span>
          </span>
          <span className="module-action">
            {picking === 'existing' ? 'Hide list' : 'Choose a cohort'} <ArrowRight size={14} />
          </span>
        </button>
      </div>

      {picking && (
        <section className="card" aria-label="Cohorts">
          <div className="row-between">
            <h2 className="card-title">{picking === 'drafts' ? 'Pick a draft to continue' : 'Pick a cohort to edit'}</h2>
            {picking === 'drafts' && drafts.length > 0 && (
              <Button size="sm" variant="danger" onClick={() => setDeleting('all')}>
                Clear all drafts
              </Button>
            )}
          </div>
          {!cohorts ? (
            <p className="muted">Loading…</p>
          ) : list.length === 0 ? (
            <p className="muted">{picking === 'drafts' ? 'There are no drafts. Set up a new cohort.' : 'There are no live cohorts yet.'}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                    <tr key={c.id}>
                      <td className="strong">{cohortLabel(c)}</td>
                      <td>
                        <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                      </td>
                      <td>{c.version != null ? `v${c.version}` : '–'}</td>
                      <td className="col-actions">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <a className="icon-btn" href="#/admin/overview" onClick={() => select(c.id)} aria-label={picking === 'drafts' ? 'Continue this draft' : 'Edit this cohort'} title={picking === 'drafts' ? 'Continue this draft' : 'Edit this cohort'}>
                            <Pencil size={16} aria-hidden />
                          </a>
                          {picking === 'drafts' && (
                            <button type="button" className="icon-btn" onClick={() => setDeleting(c)} aria-label="Delete this draft" title="Delete this draft">
                              <Trash2 size={16} aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      <ConfirmDialog
        open={deleting !== null}
        danger
        title={deleting === 'all' ? 'Delete all drafts?' : 'Delete this draft?'}
        confirmLabel={deleting === 'all' ? 'Delete all' : 'Delete'}
        message={deleting === 'all' ? `All ${drafts.length} drafts and everything set up in them are removed. This cannot be undone.` : deleting ? `${cohortLabel(deleting)} and everything set up in it is removed. This cannot be undone.` : ''}
        onConfirm={removeDrafts}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
