import { useEffect, useState } from 'react'
import { buhrApi } from '../api'
import { NotPublished, PageHead } from '../employee/shared'
import { PersonView } from '../team/pages/MemberDetail'
import type { PublishedMember } from '../team/logic'
import { useBu } from './BuContext'
import { FilterBar } from './FilterBar'
import { BuOverview } from './pages/Overview'
import { BuCompletion } from './pages/Completion'
import { BuSkills } from './pages/Skills'
import { BuEmployees } from './pages/Employees'
import { BuExceptions } from './pages/Exceptions'
import { BuCards, BuCardDetail } from './pages/Cards'

export type BuView = 'overview' | 'completion' | 'skills' | 'employees' | 'exceptions' | 'cards' | 'person' | 'card'
export type BuRoute = { view: Exclude<BuView, 'person' | 'card'> } | { view: 'person' | 'card'; id: string }

const HEAD: Record<Exclude<BuView, 'person' | 'card'>, { title: string; sub: string }> = {
  overview: { title: 'Business unit overview', sub: 'How the whole unit is getting on this cycle.' },
  completion: { title: 'Completion tracking', sub: 'Who is behind and where, by manager, function, location or level.' },
  skills: { title: 'Skill gaps', sub: 'Which skills are strong or stretched across the unit.' },
  employees: { title: 'Employees', sub: 'Everyone in the business unit, with progress, filters and export.' },
  exceptions: { title: 'Exceptions', sub: 'People who need a data fix or a first nudge.' },
  cards: { title: 'Skill cards', sub: "Each person's strengths and development areas on one page, ready to read or print." },
}

/** One person, read-only, fetched on demand so the tracking list stays small. */
function PersonPage({ id }: { id: string }) {
  const { data } = useBu()
  const [member, setMember] = useState<PublishedMember | null | 'missing'>(null)

  useEffect(() => {
    let cancelled = false
    setMember(null)
    buhrApi
      .person(id)
      .then((r) => {
        if (cancelled) return
        setMember(r.snapshot.published ? { id, remindedAt: data?.reminders[id] ?? null, snapshot: r.snapshot } : 'missing')
      })
      .catch(() => !cancelled && setMember('missing'))
    return () => {
      cancelled = true
    }
    // The reminder time is read once on open; refetching on every reminder would flicker the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (member === null) return <p className="muted">Loading…</p>
  if (member === 'missing') {
    return (
      <div className="stack">
        <a className="back-link" href="#/bu/employees">
          Back to employees
        </a>
        <p className="muted">That person isn't in your business unit.</p>
      </div>
    )
  }
  return <PersonView member={member} backHref="#/bu/employees" backLabel="Employees" canValidate={false} />
}

export function BuPage({ route }: { route: BuRoute }) {
  const { data, error, refresh } = useBu()

  if (error) {
    return (
      <div className="stack">
        <PageHead title="Business unit" />
        <p className="callout callout-bad">{error}</p>
        <div>
          <button className="btn btn-primary" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      </div>
    )
  }
  if (!data) return <p className="muted">Loading your business unit…</p>
  if (!data.published) {
    return (
      <>
        <PageHead title="Business unit" />
        <NotPublished />
      </>
    )
  }
  if (route.view === 'person') return <PersonPage id={route.id} />
  if (route.view === 'card') return <BuCardDetail id={route.id} />

  const head = HEAD[route.view]
  return (
    <>
      <PageHead title={head.title} sub={`${data.scope.organization} · ${data.scope.businessUnit} · ${head.sub}`} />
      <div className="stack">
        <FilterBar />
        {route.view === 'overview' && <BuOverview data={data} />}
        {route.view === 'completion' && <BuCompletion data={data} />}
        {route.view === 'skills' && <BuSkills data={data} />}
        {route.view === 'employees' && <BuEmployees data={data} />}
        {route.view === 'exceptions' && <BuExceptions data={data} />}
        {route.view === 'cards' && <BuCards />}
      </div>
    </>
  )
}
