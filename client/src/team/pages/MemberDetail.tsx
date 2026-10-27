import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Badge, Card } from '../../components/ui'
import { SCORE_NAME, SELF_LABEL, clusterStatus, fmtDate, managerScore, pctOf, testScore } from '../../employee/logic'
import { ScoreChip, StatusBadge } from '../../employee/shared'
import { useTeam } from '../TeamContext'
import { isPublished, memberStats, timeAgo, type PublishedMember } from '../logic'

/** Read-only profile of one person's cycle. Managers can jump from here to validating a skill. */
export function PersonView({ member, backHref, backLabel, canValidate }: { member: PublishedMember; backHref: string; backLabel: string; canValidate: boolean }) {
  const m = member.snapshot
  const e = m.employee
  const st = memberStats(member)
  const initials = e.name.split(' ').map((p) => p[0]).join('').slice(0, 2)

  return (
    <div className="stack">
      <a className="back-link" href={backHref}>
        <ArrowLeft size={14} /> {backLabel}
      </a>
      <Card>
        <div className="profile-head">
          <span className="demo-avatar avatar-lg">{initials}</span>
          <div>
            <h2 className="card-title">{e.name}</h2>
            <p className="muted">
              {e.designation} · {e.employeeId}
            </p>
          </div>
          <Badge tone={st.complete ? 'good' : 'warn'}>{st.complete ? 'Cycle complete' : `${st.progress}% through the cycle`}</Badge>
        </div>
        <dl className="facts">
          <div><dt>Job profile</dt><dd>{e.jobProfile}</dd></div>
          <div><dt>Level</dt><dd>{st.s.level?.name}</dd></div>
          <div><dt>Function</dt><dd>{e.function}</dd></div>
          <div><dt>Location</dt><dd>{e.location}</dd></div>
          <div><dt>Reporting manager</dt><dd>{e.manager}</dd></div>
          <div><dt>Skip manager</dt><dd>{e.skipManager || '–'}</dd></div>
          <div><dt>Joined</dt><dd>{fmtDate(e.joined)}</dd></div>
          <div><dt>Email</dt><dd>{e.email}</dd></div>
          <div><dt>Reminder</dt><dd>{member.remindedAt ? `Sent ${timeAgo(member.remindedAt)}` : 'None sent'}</dd></div>
        </dl>
        <div className="tally" style={{ marginTop: 16 }}>
          <div className="tally-item" data-tone="good"><strong>{st.s.cleared.length}</strong><span>Cleared</span></div>
          <div className="tally-item" data-tone="warn"><strong>{st.s.open.length}</strong><span>In progress</span></div>
          <div className="tally-item" data-tone="bad"><strong>{st.s.gaps.length}</strong><span>Gaps</span></div>
          <div className="tally-item" data-tone="neutral"><strong>{st.s.incomplete.length}</strong><span>Awaiting</span></div>
        </div>
      </Card>

      <Card title="Skill by skill" description="Self rating is for their own reflection and is not part of the result.">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{m.labels.skill}</th>
                <th>Self</th>
                <th>Manager</th>
                <th>Test</th>
                <th>Status</th>
                {canValidate && <th className="col-actions" />}
              </tr>
            </thead>
            <tbody>
              {m.clusters.map((c) => (
                <tr key={c.id}>
                  <td className="strong">{c.name}</td>
                  <td>
                    <ScoreChip score={c.self?.rating ?? null} label={c.self ? SELF_LABEL[c.self.rating] : undefined} />
                  </td>
                  <td>
                    <ScoreChip score={managerScore(c)} />
                    <span className="muted"> {managerScore(c) ? `${pctOf(c.manager.pct)}` : 'Pending'}</span>
                  </td>
                  <td>
                    <ScoreChip score={testScore(c)} />
                    <span className="muted"> {c.test.latest ? `${pctOf(c.test.latest.pct)}` : 'Not taken'}</span>
                  </td>
                  <td>
                    <StatusBadge status={clusterStatus(c, m.scoring)} />
                  </td>
                  {canValidate && (
                    <td className="col-actions">
                      <a className="btn btn-sm" href={`#/team/validate/${member.id}/${c.id}`}>
                        {c.manager.status === 'calibrated' ? 'Review' : 'Validate'} <ArrowRight size={13} />
                      </a>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint">Scores: {Object.entries(SCORE_NAME).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
      </Card>
    </div>
  )
}

export function MemberDetail({ id }: { id: string }) {
  const { members } = useTeam()
  const member = members?.find((m) => m.id === id)
  if (!member || !isPublished(member)) {
    return (
      <div className="stack">
        <a className="back-link" href="#/team">
          <ArrowLeft size={14} /> My team
        </a>
        <p className="muted">That person isn't in your team.</p>
      </div>
    )
  }
  return <PersonView member={member} backHref="#/team" backLabel="My team" canValidate />
}
