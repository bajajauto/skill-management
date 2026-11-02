import { NotPublished, PageHead } from '../employee/shared'
import { useTeam } from './TeamContext'
import { isPublished } from './logic'
import { TeamOverview } from './pages/Overview'
import { Evaluations } from './pages/Evaluations'
import { Tracking } from './pages/Tracking'
import { MemberDetail } from './pages/MemberDetail'
import { EvaluationEditor } from './pages/EvaluationEditor'

export type TeamRoute =
  | { view: 'overview' | 'validations' | 'tracking' }
  | { view: 'member'; empId: string }
  | { view: 'validate'; empId: string }

const TABS = [
  { key: 'overview', label: 'Overview', href: '#/team' },
  { key: 'validations', label: 'Evaluations', href: '#/team/validations' },
  { key: 'tracking', label: 'Employee tracking', href: '#/team/tracking' },
] as const

export function TeamPage({ route }: { route: TeamRoute }) {
  const { members, error, refresh } = useTeam()

  if (error) {
    return (
      <div className="stack">
        <PageHead title="My team" />
        <p className="callout callout-bad">{error}</p>
        <div>
          <button className="btn btn-primary" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      </div>
    )
  }
  if (!members) return <p className="muted">Loading your team…</p>

  const published = members.filter(isPublished)

  // Focused screens: no tab bar.
  if (route.view === 'validate') return <EvaluationEditor empId={route.empId} />
  if (route.view === 'member') return <MemberDetail id={route.empId} />

  return (
    <>
      <PageHead title="My team" sub={`${members.length} direct report${members.length === 1 ? '' : 's'}`} />
      <nav className="journey journey-tinted" aria-label="Team sections">
        {TABS.map((t) => (
          <a key={t.key} href={t.href} className="journey-step" data-tab={t.key} aria-current={route.view === t.key ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      {published.length === 0 ? (
        <NotPublished />
      ) : (
        <>
          {route.view === 'overview' && <TeamOverview members={published} />}
          {route.view === 'validations' && <Evaluations members={published} />}
          {route.view === 'tracking' && <Tracking members={published} />}
        </>
      )}
    </>
  )
}
