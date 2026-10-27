import { useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import { cohortApi } from '../api'
import { Badge, Button, Card, ConfirmDialog, Empty, useToast } from '../components/ui'
import { cohortLabel, useCohorts } from '../cohorts/CohortsContext'
import { useNewCohort } from '../cohorts/useNewCohort'
import type { CohortSummary } from '../types'

export type CohortView = 'all' | 'drafts' | 'manage'

const HEAD: Record<CohortView, { title: string; sub: string }> = {
  all: { title: 'Live cohorts', sub: 'Cohorts that are in use now, and ones that have finished their cycle. Employees see the published version that matches their organization and business unit.' },
  drafts: { title: 'Draft cohorts', sub: "Still being set up. Employees can't see these until they are published." },
  manage: { title: 'Manage cohorts', sub: 'Mark a live cohort completed when its cycle ends, reopen one, or delete cohorts you no longer need.' },
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '–')

function StatusBadge({ c }: { c: CohortSummary }) {
  if (c.status === 'draft') return <Badge>Draft</Badge>
  if (c.status === 'completed') return <Badge tone="accent">Completed</Badge>
  return c.dirty ? <Badge tone="warn">Live · unpublished changes</Badge> : <Badge tone="good">Live</Badge>
}

function Identity({ c }: { c: CohortSummary }) {
  return (
    <>
      <td className="strong">{c.organization || <Badge tone="warn">Not set</Badge>}</td>
      <td>{c.businessUnit || <Badge tone="warn">Not set</Badge>}</td>
    </>
  )
}

/** Simple read-only table used by All and Drafts. `kind` decides which columns make sense. */
function CohortTable({ rows, kind }: { rows: CohortSummary[]; kind: 'live' | 'completed' | 'draft' }) {
  const { select } = useCohorts()
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Organization</th>
            <th>Business unit</th>
            {kind !== 'draft' && <th>Version</th>}
            {kind === 'live' && <th>Published</th>}
            {kind === 'completed' && <th>Completed</th>}
            <th>Skills</th>
            <th>Tasks</th>
            <th>Questions</th>
            <th className="col-actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <Identity c={c} />
              {kind !== 'draft' && (
                <td>
                  <Badge tone={kind === 'live' ? 'good' : 'accent'}>v{c.version}</Badge>
                  {kind === 'live' && c.dirty && (
                    <>
                      {' '}
                      <Badge tone="warn">Unpublished changes</Badge>
                    </>
                  )}
                </td>
              )}
              {kind === 'live' && <td className="muted">{fmt(c.publishedAt)}</td>}
              {kind === 'completed' && <td className="muted">{fmt(c.closedAt)}</td>}
              <td>{c.skills}</td>
              <td>{c.tasks}</td>
              <td>{c.questions}</td>
              <td className="col-actions">
                <a className="btn btn-sm" href="#/admin/overview" onClick={() => select(c.id)}>
                  {kind === 'draft' ? 'Continue setup' : 'Open'} <ArrowRight size={13} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AllView({ cohorts }: { cohorts: CohortSummary[] }) {
  const live = cohorts.filter((c) => c.status === 'live')
  const completed = cohorts.filter((c) => c.status === 'completed')
  return (
    <>
      <Card title={`Live (${live.length})`} description="Published and in use. Employees in these cohorts are being assessed against them.">
        {live.length ? <CohortTable rows={live} kind="live" /> : <p className="muted">Nothing is live right now.{cohorts.some((c) => c.status === 'draft') ? ' Finish a draft and publish it.' : ''}</p>}
      </Card>
      <Card title={`Completed (${completed.length})`} description="Cycle finished. Results and history are kept, but employees are no longer assessed against these.">
        {completed.length ? <CohortTable rows={completed} kind="completed" /> : <p className="muted">No cohort has been completed yet.</p>}
      </Card>
    </>
  )
}

function NewCohortButton() {
  const { start, busy } = useNewCohort()
  return (
    <Button variant="primary" disabled={busy} onClick={start}>
      <Plus size={14} /> New cohort
    </Button>
  )
}

function DraftsView({ cohorts }: { cohorts: CohortSummary[] }) {
  const drafts = cohorts.filter((c) => c.status === 'draft')
  return (
    <Card title={`Drafts (${drafts.length})`}>
      {drafts.length ? (
        <CohortTable rows={drafts} kind="draft" />
      ) : (
        <Empty title="No drafts">
          Every cohort has been published.
          <div className="btn-row center">
            <NewCohortButton />
          </div>
        </Empty>
      )}
    </Card>
  )
}

type Pending = { kind: 'complete' | 'reopen' | 'delete'; cohort: CohortSummary }

function ManageView({ cohorts, refresh }: { cohorts: CohortSummary[]; refresh: () => Promise<void> }) {
  const toast = useToast()
  const { select } = useCohorts()
  const [pending, setPending] = useState<Pending | null>(null)

  const run = async (p: Pending) => {
    try {
      if (p.kind === 'complete') await cohortApi.complete(p.cohort.id)
      else if (p.kind === 'reopen') await cohortApi.reopen(p.cohort.id)
      else await cohortApi.remove(p.cohort.id)
      await refresh()
      toast(p.kind === 'complete' ? 'Cohort marked completed' : p.kind === 'reopen' ? 'Cohort reopened' : 'Cohort deleted')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That did not work', 'error')
    }
  }

  const copy = {
    complete: { title: 'Mark as completed?', confirm: 'Mark completed', danger: false, msg: 'Employees will stop being assessed against it. Results and history are kept, and you can reopen it later.' },
    reopen: { title: 'Reopen this cohort?', confirm: 'Reopen', danger: false, msg: 'It goes back to live and employees are assessed against its latest published version again.' },
    delete: { title: 'Delete this cohort?', confirm: 'Delete', danger: true, msg: 'The cohort, its draft and every published version are removed. This cannot be undone.' },
  }

  return (
    <>
      <Card title={`All cohorts (${cohorts.length})`}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Business unit</th>
                <th>Status</th>
                <th>Version</th>
                <th>Last edited</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.id}>
                  <Identity c={c} />
                  <td>
                    <StatusBadge c={c} />
                  </td>
                  <td>{c.version != null ? `v${c.version}` : '–'}</td>
                  <td className="muted">{fmt(c.updatedAt)}</td>
                  <td className="col-actions manage-actions">
                    <a className="btn btn-sm" href="#/admin/overview" onClick={() => select(c.id)}>
                      Open
                    </a>
                    {c.status === 'live' && (
                      <Button size="sm" onClick={() => setPending({ kind: 'complete', cohort: c })}>
                        Mark completed
                      </Button>
                    )}
                    {c.status === 'completed' && (
                      <Button size="sm" onClick={() => setPending({ kind: 'reopen', cohort: c })}>
                        Reopen
                      </Button>
                    )}
                    {c.status !== 'live' && (
                      <Button size="sm" variant="danger" onClick={() => setPending({ kind: 'delete', cohort: c })}>
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint">A live cohort has to be marked completed before it can be deleted.</p>
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `${copy[pending.kind].title}` : ''}
        confirmLabel={pending ? copy[pending.kind].confirm : 'Confirm'}
        danger={pending ? copy[pending.kind].danger : false}
        message={pending ? (<><strong>{cohortLabel(pending.cohort)}</strong>. {copy[pending.kind].msg}</>) : ''}
        onConfirm={() => pending && run(pending)}
        onClose={() => setPending(null)}
      />
    </>
  )
}

export function Cohorts({ view }: { view: CohortView }) {
  const { cohorts, refresh } = useCohorts()
  const head = HEAD[view]

  return (
    <>
      <header className="page-head">
        <h1>{head.title}</h1>
        <p className="muted">{head.sub}</p>
      </header>
      <div className="page stack" key={view}>
        {!cohorts ? (
          <p className="muted">Loading…</p>
        ) : cohorts.length === 0 ? (
          <Card>
            <Empty title="No cohorts yet">
              Create one to start building its skill framework.
              <div className="btn-row center">
                <NewCohortButton />
              </div>
            </Empty>
          </Card>
        ) : (
          <>
            {view === 'all' && <AllView cohorts={cohorts} />}
            {view === 'drafts' && <DraftsView cohorts={cohorts} />}
            {view === 'manage' && <ManageView cohorts={cohorts} refresh={refresh} />}
          </>
        )}
      </div>
    </>
  )
}
