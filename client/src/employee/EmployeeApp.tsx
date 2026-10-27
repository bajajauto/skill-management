import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  ClipboardCheck,
  Contact,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { User } from '../api'
import { ToastProvider } from '../components/ui'
import { MeProvider } from './MeContext'
import { Dashboard } from './pages/Dashboard'
import { SkillProfile } from './pages/SkillProfile'
import { Assessments } from './pages/Assessments'
import { ReflectionPage } from './pages/Reflection'
import { SkillCard } from './pages/SkillCard'
import { TeamProvider, useTeam } from '../team/TeamContext'
import { TeamPage, type TeamRoute } from '../team/TeamPage'
import { TeamCardDetail, TeamCards } from '../team/pages/TeamCards'
import { BuProvider, useBu } from '../buhr/BuContext'
import { BuPage, type BuRoute } from '../buhr/BuPage'

export type EmpRoute =
  | { page: 'dashboard' }
  | { page: 'profile' }
  | { page: 'assessments'; tab: 'overview' | 'self' | 'tests'; skillId?: string }
  | { page: 'reflection' }
  | { page: 'card' }
  | { page: 'team'; team: TeamRoute }
  | { page: 'cards'; id?: string }
  | { page: 'bu'; bu: BuRoute }

/**
 * Hash routes: #/, #/profile, #/assessments[/self|/tests[/<skillId>]], #/reflection, #/card,
 * for managers #/team[/validations|/tracking|/member/<id>|/validate/<id>/<skillId>],
 * and for BUHR #/bu[/completion|/skills|/employees|/exceptions|/person/<id>]
 */
function parse(): EmpRoute {
  const [page, a, b, c] = location.hash.replace(/^#\/?/, '').split('/')
  switch (page) {
    case 'profile':
      return { page: 'profile' }
    case 'assessments':
      return a === 'self' ? { page: 'assessments', tab: 'self' } : a === 'tests' ? { page: 'assessments', tab: 'tests', skillId: b } : { page: 'assessments', tab: 'overview' }
    case 'reflection':
      return { page: 'reflection' }
    case 'card':
      return { page: 'card' }
    case 'team':
      if (a === 'member' && b) return { page: 'team', team: { view: 'member', empId: b } }
      if (a === 'validate' && b && c) return { page: 'team', team: { view: 'validate', empId: b, skillId: c } }
      return { page: 'team', team: { view: a === 'validations' ? 'validations' : a === 'tracking' ? 'tracking' : 'overview' } }
    case 'cards':
      return { page: 'cards', id: a }
    case 'bu':
      if ((a === 'person' || a === 'card') && b) return { page: 'bu', bu: { view: a, id: b } }
      return { page: 'bu', bu: { view: a === 'completion' || a === 'skills' || a === 'employees' || a === 'exceptions' || a === 'cards' ? a : 'overview' } }
    default:
      return { page: 'dashboard' }
  }
}

const NAV: { page: EmpRoute['page']; href: string; label: string; icon: LucideIcon }[] = [
  { page: 'dashboard', href: '#/', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'profile', href: '#/profile', label: 'Skill profile', icon: UserRound },
  { page: 'assessments', href: '#/assessments', label: 'My assessments', icon: ClipboardCheck },
  { page: 'reflection', href: '#/reflection', label: 'Reflection', icon: Sparkles },
  { page: 'card', href: '#/card', label: 'Skill card', icon: BadgeCheck },
]

const BU_NAV: { view: BuRoute['view']; href: string; label: string; icon: LucideIcon }[] = [
  { view: 'overview', href: '#/bu', label: 'Overview', icon: LayoutDashboard },
  { view: 'completion', href: '#/bu/completion', label: 'Completion', icon: ListChecks },
  { view: 'skills', href: '#/bu/skills', label: 'Skill gaps', icon: Target },
  { view: 'employees', href: '#/bu/employees', label: 'Employees', icon: UsersRound },
  { view: 'exceptions', href: '#/bu/exceptions', label: 'Exceptions', icon: AlertTriangle },
  { view: 'cards', href: '#/bu/cards', label: 'Skill cards', icon: Contact },
]

/** Count of validations waiting on the manager, shown beside "My team". */
function TeamBadge() {
  const { members } = useTeam()
  const n =
    members?.reduce((a, m) => a + (m.snapshot.published ? m.snapshot.clusters.filter((c) => c.manager.status === 'pending').length : 0), 0) ?? 0
  return n > 0 ? (
    <span className="nav-count" title={`${n} validation${n === 1 ? '' : 's'} waiting`}>
      {n}
    </span>
  ) : null
}

/** Sits above everything for a BUHR: switches between their own manager screens and the business-unit tracking. */
function ViewRibbon({ inBu }: { inBu: boolean }) {
  const { data } = useBu()
  const scope = data ? `${data.scope.organization} · ${data.scope.businessUnit}` : ''
  return (
    <div className="ribbon" data-mode={inBu ? 'bu' : 'manager'} role="region" aria-label="Switch view">
      <span className="ribbon-label">
        <BarChart3 size={15} aria-hidden /> Viewing as
      </span>
      <div className="segmented ribbon-switch" role="radiogroup" aria-label="View">
        <a href="#/" role="radio" aria-checked={!inBu} className="segmented-item">
          Manager view
        </a>
        <a href="#/bu" role="radio" aria-checked={inBu} className="segmented-item">
          BUHR view
        </a>
      </div>
      <span className="ribbon-scope">{inBu ? `Whole business unit · ${scope}` : 'Your own development and your direct reports'}</span>
    </div>
  )
}

/**
 * Employee screens for everyone. Managers also get a separate My team area. A BUHR gets both, plus a ribbon
 * to switch into business-unit tracking.
 */
export function EmployeeApp({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const isBuhr = user.role === 'buhr'
  const hasTeam = user.role === 'manager' || isBuhr
  const [route, setRoute] = useState<EmpRoute>(parse)

  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const inBu = isBuhr && route.page === 'bu'

  const shell = (
    <>
      {isBuhr && <ViewRibbon inBu={inBu} />}
      <div className="app" data-ribbon={isBuhr}>
        <aside className="sidebar">
          <div className="brand">
            <img className="brand-logo" src="/bajaj-logo.png" alt="Bajaj Auto" />
            <span className="brand-name">Skills Platform</span>
          </div>
          <nav className="sidenav" aria-label="Main">
            {inBu ? (
              <>
                <p className="nav-label">Business unit</p>
                {BU_NAV.map((n) => (
                  <a key={n.view} href={n.href} className="nav-item" aria-current={route.page === 'bu' && (route.bu.view === n.view || (n.view === 'employees' && route.bu.view === 'person') || (n.view === 'cards' && route.bu.view === 'card')) ? 'page' : undefined}>
                    <n.icon size={20} aria-hidden />
                    {n.label}
                  </a>
                ))}
              </>
            ) : (
              <>
                {hasTeam && <p className="nav-label">My development</p>}
                {NAV.map((n) => (
                  <a key={n.page} href={n.href} className="nav-item" aria-current={route.page === n.page ? 'page' : undefined}>
                    <n.icon size={20} aria-hidden />
                    {n.label}
                  </a>
                ))}
                {hasTeam && (
                  <>
                    <p className="nav-label">Team</p>
                    <a href="#/team" className="nav-item" aria-current={route.page === 'team' ? 'page' : undefined}>
                      <UsersRound size={20} aria-hidden />
                      My team
                      <TeamBadge />
                    </a>
                    <a href="#/cards" className="nav-item" aria-current={route.page === 'cards' ? 'page' : undefined}>
                      <Contact size={20} aria-hidden />
                      Team skill cards
                    </a>
                  </>
                )}
              </>
            )}
          </nav>
          <div className="signout">
            <span className="demo-avatar">{user.initials}</span>
            <span className="signout-who">
              <strong>{user.name}</strong>
              <small>{user.roleLabel}</small>
            </span>
            <button type="button" className="icon-btn" style={{ marginInlineStart: 'auto' }} aria-label="Sign out" title="Sign out" onClick={onSignOut}>
              <LogOut size={16} />
            </button>
          </div>
        </aside>
        <main className="main">
          <div className="page" key={route.page + (route.page === 'assessments' ? route.tab : route.page === 'team' ? route.team.view : route.page === 'bu' ? route.bu.view : route.page === 'cards' ? (route.id ?? 'list') : '')}>
            {route.page === 'dashboard' && <Dashboard />}
            {route.page === 'profile' && <SkillProfile />}
            {route.page === 'assessments' && <Assessments tab={route.tab} skillId={route.skillId} />}
            {route.page === 'reflection' && <ReflectionPage />}
            {route.page === 'card' && <SkillCard />}
            {route.page === 'team' && hasTeam && <TeamPage route={route.team} />}
            {route.page === 'cards' && hasTeam && (route.id ? <TeamCardDetail id={route.id} /> : <TeamCards />)}
            {route.page === 'bu' && isBuhr && <BuPage route={route.bu} />}
          </div>
        </main>
      </div>
    </>
  )

  const withTeam = hasTeam ? <TeamProvider>{shell}</TeamProvider> : shell
  return (
    <ToastProvider>
      <MeProvider>{isBuhr ? <BuProvider>{withTeam}</BuProvider> : withTeam}</MeProvider>
    </ToastProvider>
  )
}
