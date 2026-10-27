import { Bell, Check } from 'lucide-react'
import { teamApi } from '../../api'
import { Badge, Button, Card, useToast } from '../../components/ui'
import { daysUntil, fmtDate } from '../../employee/logic'
import { useTeam } from '../TeamContext'
import { memberStats, timeAgo, type PublishedMember } from '../logic'

const SELF_BADGE = {
  submitted: { label: 'Submitted', tone: 'good' as const },
  draft: { label: 'In draft', tone: 'warn' as const },
  none: { label: 'Not started', tone: 'neutral' as const },
}

export function Tracking({ members }: { members: PublishedMember[] }) {
  const toast = useToast()
  const { markReminded } = useTeam()
  const cycle = members[0].snapshot.cycle
  const days = daysUntil(cycle.due)
  const rows = members.map((m) => ({ m, st: memberStats(m) }))
  const done = rows.filter(({ st }) => st.complete).length

  // The reminder names whatever the person still owes, since only they can do those parts.
  const owed = (st: ReturnType<typeof memberStats>) => [
    st.selfState !== 'submitted' && 'self assessment',
    st.s.testsTaken < st.testable && 'objective tests',
  ].filter(Boolean) as string[]

  const remind = async (id: string, name: string) => {
    try {
      const r = await teamApi.remind(id)
      markReminded(id, r.remindedAt)
      toast(`Reminder sent to ${name.split(' ')[0]}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send reminder', 'error')
    }
  }

  return (
    <Card
      title="Employee tracking"
      description={`${cycle.name} · due ${fmtDate(cycle.due)}${days != null ? (days >= 0 ? ` (${days} day${days === 1 ? '' : 's'} left)` : ' (past due)') : ''} · ${done} of ${members.length} fully complete`}
    >
      <div className="table-wrap">
        <table className="table track">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Self assessment</th>
              <th>Objective tests</th>
              <th>Validation</th>
              <th>Overall</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, st }) => {
              const sb = SELF_BADGE[st.selfState]
              const owes = owed(st)
              return (
                <tr key={m.id}>
                  <td>
                    <a className="strong" href={`#/team/member/${m.id}`}>
                      {m.snapshot.employee.name}
                    </a>
                    <p className="muted">{m.snapshot.employee.jobProfile}</p>
                  </td>
                  <td>
                    <Badge tone={sb.tone}>{sb.label}</Badge>
                  </td>
                  <td>
                    <span className="track-count">
                      {st.s.testsTaken}/{st.testable}
                    </span>
                  </td>
                  <td>
                    {st.s.managerDone === st.total ? (
                      <Badge tone="good">
                        <Check size={11} strokeWidth={3} />
                        &nbsp;Done
                      </Badge>
                    ) : (
                      <a href="#/team/validations" className="track-count">
                        {st.s.managerDone}/{st.total}
                      </a>
                    )}
                  </td>
                  <td>
                    <div className="track-overall">
                      <div className="pbar" role="progressbar" aria-valuenow={st.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${st.name} overall progress`}>
                        <span style={{ transform: `scaleX(${st.progress / 100})` }} />
                      </div>
                      <b>{st.progress}%</b>
                    </div>
                  </td>
                  <td className="col-actions">
                    {owes.length > 0 ? (
                      <div className="remind">
                        <Button size="sm" onClick={() => remind(m.id, st.name)} title={`Remind about: ${owes.join(', ')}`}>
                          <Bell size={13} /> Remind
                        </Button>
                        {m.remindedAt && <small className="muted">Sent {timeAgo(m.remindedAt)}</small>}
                      </div>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="field-hint">Reminders are recorded here. Email and in-app delivery come with the notifications work.</p>
    </Card>
  )
}
