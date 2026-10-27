import { ArrowRight, Bell } from 'lucide-react'
import { Badge, Button, Card, Empty, useToast } from '../../components/ui'
import { timeAgo } from '../../team/logic'
import { useBu } from '../BuContext'
import type { PublishedBu } from '../types'

export function BuExceptions({ data }: { data: PublishedBu }) {
  const { filtered, remind } = useBu()
  const toast = useToast()

  const blocked = filtered.filter((p) => p.employee.exception)
  // Not one thing done yet, so a reminder is the first useful step.
  const notStarted = filtered.filter((p) => !p.employee.exception && p.self === 'none' && p.tests.taken === 0 && p.validation.done === 0)

  const send = async (ids: string[], label: string) => {
    try {
      await remind(ids)
      toast(`Reminder sent to ${label}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send reminders', 'error')
    }
  }

  return (
    <div className="stack">
      <Card title={`Data and workflow exceptions (${blocked.length})`} description="People the campaign can't process normally. These need an HR or data fix before they can complete.">
        {blocked.length === 0 ? (
          <Empty title="No exceptions">Everyone in scope is correctly mapped and active.</Empty>
        ) : (
          <ul className="exception-list">
            {blocked.map((p) => (
              <li key={p.id}>
                <span>
                  <a className="strong" href={`#/bu/person/${p.id}`}>
                    {p.employee.name}
                  </a>
                  <small className="muted">
                    {p.employee.employeeId} · {p.employee.function} · reports to {p.employee.manager}
                  </small>
                </span>
                <Badge tone="warn">{p.employee.exception}</Badge>
                <a className="btn btn-sm" href={`#/bu/person/${p.id}`}>
                  Open <ArrowRight size={13} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={`Not started (${notStarted.length})`}
        description="No self assessment, test or validation yet."
        action={
          notStarted.length > 0 && (
            <Button size="sm" variant="primary" onClick={() => send(notStarted.map((p) => p.id), `${notStarted.length} ${notStarted.length === 1 ? 'person' : 'people'}`)}>
              <Bell size={14} /> Remind all
            </Button>
          )
        }
      >
        {notStarted.length === 0 ? (
          <Empty title="Everyone has started">Each person in scope has done at least one part of the cycle.</Empty>
        ) : (
          <ul className="exception-list">
            {notStarted.map((p) => (
              <li key={p.id}>
                <span>
                  <a className="strong" href={`#/bu/person/${p.id}`}>
                    {p.employee.name}
                  </a>
                  <small className="muted">
                    {p.employee.function} · manager {p.employee.manager}
                  </small>
                </span>
                <span className="muted">{data.reminders[p.id] ? `Reminded ${timeAgo(data.reminders[p.id])}` : 'No reminder yet'}</span>
                <Button size="sm" onClick={() => send([p.id], p.employee.name.split(' ')[0])}>
                  <Bell size={13} /> Remind
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
