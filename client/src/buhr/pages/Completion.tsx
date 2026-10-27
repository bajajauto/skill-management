import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Button, Card, Segmented, useToast } from '../../components/ui'
import { timeAgo } from '../../team/logic'
import { useBu } from '../BuContext'
import { groupBy, owes, pct } from '../logic'
import type { BuPerson, PublishedBu } from '../types'

type Dim = 'manager' | 'function' | 'location' | 'level'

const DIMS: { value: Dim; label: string; key: (p: BuPerson) => string }[] = [
  { value: 'manager', label: 'Manager', key: (p) => p.employee.manager },
  { value: 'function', label: 'Function', key: (p) => p.employee.function },
  { value: 'location', label: 'Location', key: (p) => p.employee.location },
  { value: 'level', label: 'Level', key: (p) => p.level },
]

function Bar({ done, all, label }: { done: number; all: number; label: string }) {
  return (
    <div className="cell-bar">
      <div className="pbar" role="progressbar" aria-valuenow={pct(done, all)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ transform: `scaleX(${all ? done / all : 0})` }} />
      </div>
      <span>{pct(done, all)}%</span>
    </div>
  )
}

export function BuCompletion({ data }: { data: PublishedBu }) {
  const { filtered, remind } = useBu()
  const toast = useToast()
  const [dim, setDim] = useState<Dim>('manager')
  const key = DIMS.find((d) => d.value === dim)!.key
  // Most behind first, so the follow-up list is the top of the table.
  const rows = groupBy(filtered, key).sort((a, b) => a.t.progress - b.t.progress)

  const nudge = async (name: string, people: BuPerson[]) => {
    try {
      if (dim === 'manager') {
        await remind([], [name])
        toast(`Reminder sent to ${name}`)
      } else {
        const ids = people.filter((p) => owes(p).length).map((p) => p.id)
        if (!ids.length) return toast('Nobody here has anything left to do')
        await remind(ids)
        toast(`Reminder sent to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`)
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send the reminder', 'error')
    }
  }

  return (
    <Card
      title="Completion"
      description="Who is behind, and where. Sorted with the furthest behind first."
      action={<Segmented label="Group by" value={dim} onChange={setDim} options={DIMS.map((d) => ({ value: d.value, label: d.label }))} />}
    >
      {!rows.length ? (
        <p className="muted">No one matches these filters.</p>
      ) : (
        <div className="table-wrap">
          <table className="table track">
            <thead>
              <tr>
                <th>{DIMS.find((d) => d.value === dim)!.label}</th>
                <th>People</th>
                <th>Self assessment</th>
                <th>Tests</th>
                <th>Validation</th>
                <th>Overall</th>
                <th>Fully done</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const at = dim === 'manager' ? data.reminders[`mgr:${g.name}`] : undefined
                const canNudge = dim === 'manager' ? g.pending > 0 : g.rows.some((p) => owes(p).length)
                return (
                  <tr key={g.name}>
                    <td className="strong">
                      {g.name}
                      {dim === 'manager' && g.pending > 0 && <p className="muted">{g.pending} validation{g.pending === 1 ? '' : 's'} pending</p>}
                    </td>
                    <td>{g.t.n}</td>
                    <td>
                      <Bar done={g.t.selfDone} all={g.t.n} label={`${g.name} self assessments`} />
                    </td>
                    <td>
                      <Bar done={g.t.testsDone} all={g.t.testsAll} label={`${g.name} tests`} />
                    </td>
                    <td>
                      <Bar done={g.t.valDone} all={g.t.valAll} label={`${g.name} validations`} />
                    </td>
                    <td>
                      <b className="track-count">{g.t.progress}%</b>
                    </td>
                    <td>
                      {g.t.complete}/{g.t.n}
                    </td>
                    <td className="col-actions">
                      {canNudge && (
                        <div className="remind">
                          <Button size="sm" onClick={() => nudge(g.name, g.rows)} title={dim === 'manager' ? 'Remind this manager about pending validations' : 'Remind everyone here who still has something to do'}>
                            <Bell size={13} /> Remind
                          </Button>
                          {at && <small className="muted">Sent {timeAgo(at)}</small>}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="field-hint">Reminders are recorded here. Email and in-app delivery come with the notifications work.</p>
    </Card>
  )
}
