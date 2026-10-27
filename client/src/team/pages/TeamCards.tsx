import { SkillCardView } from '../../employee/pages/SkillCard'
import { NotPublished, PageHead } from '../../employee/shared'
import { SkillCardsGrid } from '../SkillCardsGrid'
import { useTeam } from '../TeamContext'
import { isPublished, memberStats } from '../logic'

/** Skill cards for a manager's direct reports. */
export function TeamCards() {
  const { members, error, refresh } = useTeam()
  if (error) {
    return (
      <div className="stack">
        <PageHead title="Team skill cards" />
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

  return (
    <>
      <PageHead title="Team skill cards" sub="Each direct report's strengths and development areas on one page. Open a card to read it in full or print it." />
      {published.length === 0 ? (
        <NotPublished />
      ) : (
        <SkillCardsGrid
          hrefFor={(id) => `#/cards/${id}`}
          items={published.map((m) => {
            const st = memberStats(m)
            const e = m.snapshot.employee
            return {
              id: m.id,
              name: e.name,
              role: e.designation,
              sub: `${e.jobProfile} · ${e.location}`,
              level: st.s.level?.name ?? '',
              cleared: st.s.cleared.length,
              open: st.s.open.length,
              gaps: st.s.gaps.length,
              awaiting: st.s.incomplete.length,
              total: st.total,
            }
          })}
        />
      )}
    </>
  )
}

export function TeamCardDetail({ id }: { id: string }) {
  const { members } = useTeam()
  if (!members) return <p className="muted">Loading…</p>
  const m = members.find((x) => x.id === id)
  if (!m || !isPublished(m)) {
    return (
      <div className="stack">
        <a className="back-link" href="#/cards">
          Back to team skill cards
        </a>
        <p className="muted">That person isn't in your team.</p>
      </div>
    )
  }
  return <SkillCardView m={m.snapshot} title={`${m.snapshot.employee.name}'s skill card`} sub="A one-page summary of strengths and development areas." back={{ href: '#/cards', label: 'Team skill cards' }} />
}
