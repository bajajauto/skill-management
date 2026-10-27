import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Bell, Download } from 'lucide-react'
import { Badge, Button, Card, Segmented, useToast } from '../../components/ui'
import { downloadText, toCsv } from '../../lib/importers'
import { timeAgo } from '../../team/logic'
import { useBu } from '../BuContext'
import { countStatuses, owes, progressOf } from '../logic'
import type { BuPerson, PublishedBu } from '../types'

type SortKey = 'name' | 'function' | 'manager' | 'progress' | 'gaps'
type Stage = 'all' | 'todo' | 'done'

const SELF_BADGE = {
  submitted: { label: 'Submitted', tone: 'good' as const },
  draft: { label: 'In draft', tone: 'warn' as const },
  none: { label: 'Not started', tone: 'neutral' as const },
}

const sortValue = (p: BuPerson, k: SortKey): string | number => {
  switch (k) {
    case 'name':
      return p.employee.name
    case 'function':
      return p.employee.function
    case 'manager':
      return p.employee.manager
    case 'progress':
      return progressOf(p).progress
    case 'gaps':
      return countStatuses(p).gap
  }
}

export function BuEmployees({ data }: { data: PublishedBu }) {
  const { filtered, remind } = useBu()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [stage, setStage] = useState<Stage>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'progress', dir: 1 })

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = filtered.filter((p) => {
      const done = progressOf(p).complete
      return (stage === 'all' || (stage === 'done' ? done : !done)) && (!needle || `${p.employee.name} ${p.employee.employeeId} ${p.employee.email}`.toLowerCase().includes(needle))
    })
    return list.sort((a, b) => {
      const x = sortValue(a, sort.key)
      const y = sortValue(b, sort.key)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir
    })
  }, [filtered, q, stage, sort])

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'progress' ? 1 : key === 'gaps' ? -1 : 1 }))
  const th = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => toggle(key)}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  )

  const owing = rows.filter((p) => owes(p).length)

  const exportCsv = () => {
    const head = ['Employee ID', 'Name', 'Email', 'Function', 'Location', 'Reporting manager', 'Skip manager', 'Level', 'Self assessment', 'Tests taken', 'Tests total', 'Validations done', 'Validations total', 'Overall %', 'Cleared', 'In progress', 'Gaps', 'Awaiting', 'Exception']
    const body = rows.map((p) => {
      const s = countStatuses(p)
      return [p.employee.employeeId, p.employee.name, p.employee.email, p.employee.function, p.employee.location, p.employee.manager, p.employee.skipManager, p.level, p.self, p.tests.taken, p.tests.total, p.validation.done, p.validation.total, progressOf(p).progress, s.cleared, s.open, s.gap, s.incomplete, p.employee.exception ?? ''].map(String)
    })
    downloadText(`${data.scope.organization}-${data.scope.businessUnit}-skills-tracking.csv`.toLowerCase().replace(/\s+/g, '-'), toCsv([head, ...body]))
    toast(`Exported ${rows.length} ${rows.length === 1 ? 'person' : 'people'}`)
  }

  const remindAll = async () => {
    try {
      await remind(owing.map((p) => p.id))
      toast(`Reminder sent to ${owing.length} ${owing.length === 1 ? 'person' : 'people'}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send reminders', 'error')
    }
  }

  return (
    <Card
      title={`Employees (${rows.length})`}
      description="Everyone in the business unit with their progress. Select a name for the full picture."
      action={
        <div className="btn-row">
          <Button size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download size={14} /> Export CSV
          </Button>
          <Button size="sm" variant="primary" onClick={remindAll} disabled={!owing.length} title="Remind everyone listed who still has a self assessment or test to do">
            <Bell size={14} /> Remind {owing.length || ''}
          </Button>
        </div>
      }
    >
      <div className="emp-tools">
        <input className="input" type="search" placeholder="Search name, ID or email" aria-label="Search employees" value={q} onChange={(e) => setQ(e.target.value)} />
        <Segmented
          label="Stage"
          value={stage}
          onChange={setStage}
          options={[
            { value: 'all', label: 'All' },
            { value: 'todo', label: 'Not finished' },
            { value: 'done', label: 'Complete' },
          ]}
        />
      </div>
      <div className="table-wrap">
        <table className="table track emp-table">
          <thead>
            <tr>
              {th('name', 'Employee')}
              {th('function', 'Function')}
              {th('manager', 'Manager')}
              <th>Self</th>
              <th>Tests</th>
              <th>Validation</th>
              {th('progress', 'Overall')}
              {th('gaps', 'Skills')}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const { progress, complete } = progressOf(p)
              const s = countStatuses(p)
              const sb = SELF_BADGE[p.self]
              const at = data.reminders[p.id]
              return (
                <tr key={p.id}>
                  <td>
                    <a className="strong" href={`#/bu/person/${p.id}`}>
                      {p.employee.name}
                    </a>
                    <p className="muted">
                      {p.employee.employeeId} · {p.employee.location}
                    </p>
                    {p.employee.exception && <Badge tone="warn">{p.employee.exception}</Badge>}
                  </td>
                  <td>{p.employee.function}</td>
                  <td>{p.employee.manager}</td>
                  <td>
                    <Badge tone={sb.tone}>{sb.label}</Badge>
                  </td>
                  <td className="track-count">
                    {p.tests.taken}/{p.tests.total}
                  </td>
                  <td className="track-count">
                    {p.validation.done}/{p.validation.total}
                  </td>
                  <td>
                    <div className="track-overall">
                      <div className="pbar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.employee.name} overall progress`}>
                        <span style={{ transform: `scaleX(${progress / 100})` }} />
                      </div>
                      <b>{progress}%</b>
                    </div>
                    {complete ? <small className="muted">Complete</small> : at ? <small className="muted">Reminded {timeAgo(at)}</small> : null}
                  </td>
                  <td>
                    <span className="skill-mini">
                      {s.cleared > 0 && <span data-status="cleared" title="Cleared">{s.cleared}</span>}
                      {s.open > 0 && <span data-status="open" title="In progress">{s.open}</span>}
                      {s.gap > 0 && <span data-status="gap" title="Gaps">{s.gap}</span>}
                      {s.incomplete > 0 && <span data-status="incomplete" title="Awaiting">{s.incomplete}</span>}
                    </span>
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="table-empty">
                  No one matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
