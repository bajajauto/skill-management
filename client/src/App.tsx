import { useEffect, useState } from 'react'
import { FilePen, LayoutList, LogOut, Plus, Settings2, type LucideIcon } from 'lucide-react'
import { Login } from './pages/Login'
import { setApiUser, type User } from './api'
import { EmployeeApp } from './employee/EmployeeApp'
import { StoreProvider, useStoreMaybe } from './store'
import { AppIcon, ToastProvider } from './components/ui'
import { CohortsProvider, isBlankDraft, useCohorts } from './cohorts/CohortsContext'
import { useNewCohort } from './cohorts/useNewCohort'
import { SetupStart } from './pages/SetupStart'
import { Home } from './pages/Home'
import { Cohorts, type CohortView } from './pages/Cohorts'
import { ADMIN_SECTIONS, TdAdmin } from './pages/TdAdmin'
import type { AdminSection } from './types'

const COHORT_VIEWS: { key: CohortView; label: string; icon: LucideIcon }[] = [
  { key: 'all', label: 'All', icon: LayoutList },
  { key: 'drafts', label: 'Drafts', icon: FilePen },
  { key: 'manage', label: 'Manage Cohorts', icon: Settings2 },
]

type Route = { page: 'home' } | { page: 'start' } | { page: 'cohorts'; view: CohortView } | { page: 'admin'; section: AdminSection }

/** Hash routes: #/, #/admin/<section> (Skill Framework Setup) and #/admin/cohorts/<all|drafts|manage|new>. */
function parseHash(): Route {
  const [page, second, third] = location.hash.replace(/^#\/?/, '').split('/')
  if (page !== 'admin') return { page: 'home' }
  if (second === 'start') return { page: 'start' }
  if (second === 'cohorts') return { page: 'cohorts', view: COHORT_VIEWS.find((v) => v.key === third)?.key ?? 'all' }
  return { page: 'admin', section: ADMIN_SECTIONS.find((s) => s.key === second)?.key ?? 'overview' }
}


function Shell({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const isAdmin = user.role === 'td-admin'
  const [route, setRoute] = useState<Route>(parseHash)
  const state = useStoreMaybe()
  const { cohorts } = useCohorts()
  const newCohort = useNewCohort()
  const live = cohorts?.filter((c) => c.status === 'live') ?? []
  const drafts = cohorts?.filter((c) => c.status === 'draft' && !isBlankDraft(c)).length ?? 0

  useEffect(() => {
    const on = () => {
      const next = parseHash()
      setRoute(next)
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/bajaj-logo.png" alt="Bajaj Auto" />
          <span className="brand-name">Skills Platform</span>
        </div>
        <nav className="sidenav" aria-label="Main">
          <a href="#/" className="nav-item" aria-current={route.page === 'home' ? 'page' : undefined}>
            <AppIcon name="home" size={30} />
            Home
          </a>
          {isAdmin && (
            <a href="#/admin/start" className="nav-item nav-group-title" data-active={route.page === 'admin' || route.page === 'start'}>
              <AppIcon name="skill-framework" size={30} />
              Skill Framework Setup
            </a>
          )}
          {isAdmin && (
            <>
              <a href="#/admin/cohorts/all" className="nav-item nav-group-title" data-active={route.page === 'cohorts'} aria-expanded={route.page === 'cohorts'}>
                <AppIcon name="department" size={30} />
                Live Cohorts
                {live.length > 0 && <span className="nav-count nav-count-good">{live.length}</span>}
              </a>
              {route.page === 'cohorts' && (
                <div className="nav-subitems" aria-label="Cohort sections">
                  {COHORT_VIEWS.map((v) => (
                    <a key={v.key} href={`#/admin/cohorts/${v.key}`} className="nav-subitem" aria-current={route.view === v.key ? 'page' : undefined}>
                      <span className="sub-icon">
                        <v.icon size={15} aria-hidden />
                      </span>
                      {v.label}
                      {v.key === 'drafts' && drafts > 0 && <span className="nav-count">{drafts}</span>}
                    </a>
                  ))}
                  {/* Creates a blank draft and opens the Framework step, where organization and business unit are chosen. */}
                  <button type="button" className="nav-subitem" disabled={newCohort.busy} onClick={newCohort.start}>
                    <span className="sub-icon">
                      <Plus size={15} aria-hidden />
                    </span>
                    New Cohort
                  </button>
                </div>
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
        {(route.page === 'home' || !isAdmin) && <Home />}
        {route.page === 'start' && isAdmin && <SetupStart />}
        {route.page === 'cohorts' && isAdmin && <Cohorts view={route.view} />}
        {route.page === 'admin' && isAdmin && state && <TdAdmin section={route.section} onNavigate={(s) => (location.hash = `/admin/${s}`)} />}
        {route.page === 'admin' && isAdmin && !state && (
          <div className="page empty">
            <p className="empty-title">{cohorts ? 'No cohort to set up yet' : 'Loading…'}</p>
            {cohorts && (
              <div className="empty-body">
                Skill framework setup works on a cohort. Create one first.
                <div className="btn-row center">
                  <button type="button" className="btn btn-primary" disabled={newCohort.busy} onClick={newCohort.start}>
                    <Plus size={14} /> New cohort
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

/** Skill Framework Setup edits whichever cohort was opened last, so its data loads around the whole shell. */
function AdminRoot({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { current, refresh } = useCohorts()
  const shell = <Shell user={user} onSignOut={onSignOut} />
  return current ? (
    <StoreProvider key={current.id} cohortId={current.id} onChanged={refresh}>
      {shell}
    </StoreProvider>
  ) : (
    shell
  )
}

const SESSION_KEY = 'skills-platform-user'

/** The session lives in sessionStorage: a reload keeps you signed in, but opening the link fresh lands on the login page. */
function loadUser(): User | null {
  try {
    localStorage.removeItem(SESSION_KEY) // older builds kept the session here
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as User | null
  } catch {
    return null
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(loadUser)

  const signIn = (u: User) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
    } catch {
      /* session just won't survive a reload */
    }
    location.hash = '/'
    setUser(u)
  }
  const signOut = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    setUser(null)
  }

  setApiUser(user?.id ?? null)
  if (!user) return <Login onSignIn={signIn} />
  if (user.role === 'employee' || user.role === 'manager' || user.role === 'buhr') return <EmployeeApp user={user} onSignOut={signOut} />
  // Only TD admins manage cohorts; other roles never call the cohorts API.
  if (user.role !== 'td-admin') {
    return (
      <ToastProvider>
        <Shell user={user} onSignOut={signOut} />
      </ToastProvider>
    )
  }
  return (
    <CohortsProvider>
      <ToastProvider>
        <AdminRoot user={user} onSignOut={signOut} />
      </ToastProvider>
    </CohortsProvider>
  )
}
