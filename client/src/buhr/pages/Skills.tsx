import { Star } from 'lucide-react'
import { Card } from '../../components/ui'
import { HEAT_LABEL } from '../../team/logic'
import type { ClusterStatus } from '../../employee/logic'
import { useBu } from '../BuContext'
import { distinct, pct } from '../logic'
import type { PublishedBu } from '../types'

const ORDER: ClusterStatus[] = ['cleared', 'open', 'gap', 'incomplete']
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'
}

export function BuSkills({ data }: { data: PublishedBu }) {
  const { filtered } = useBu()
  if (!filtered.length) return <p className="muted">No one matches these filters.</p>

  const rows = data.skills
    .map((s) => {
      const cs = filtered.map((p) => p.clusters.find((c) => c.id === s.id)).filter((c): c is NonNullable<typeof c> => Boolean(c))
      const counts: Record<ClusterStatus, number> = { cleared: 0, open: 0, gap: 0, incomplete: 0 }
      cs.forEach((c) => counts[c.status]++)
      const decided = counts.cleared + counts.open + counts.gap
      return { s, cs, counts, gapPct: pct(counts.gap, decided), decided, mgr: avg(cs.map((c) => c.manager)), test: avg(cs.map((c) => c.test)) }
    })
    .sort((a, b) => b.gapPct - a.gapPct)

  const functions = distinct(filtered, (p) => p.employee.function)
  const cell = (skillId: string, fn: string) => {
    const cs = filtered.filter((p) => p.employee.function === fn).map((p) => p.clusters.find((c) => c.id === skillId)).filter((c): c is NonNullable<typeof c> => Boolean(c))
    const decided = cs.filter((c) => c.status !== 'incomplete')
    return { n: decided.length, gap: pct(decided.filter((c) => c.status === 'gap').length, decided.length) }
  }

  return (
    <div className="stack">
      <Card title="Skill gaps across the unit" description="Ranked by the share of people with a result who are below target. Awaiting results aren't counted as gaps.">
        <ul className="skill-split">
          {rows.map(({ s, counts, gapPct, decided, mgr, test }) => (
            <li key={s.id} className="skill-split-row">
              <span className="strong">
                {s.name}
                {s.critical && (
                  <span className="critical" title="Critical skill">
                    <Star size={12} />
                  </span>
                )}
              </span>
              <div className="split-bar" role="img" aria-label={ORDER.map((o) => `${counts[o]} ${HEAT_LABEL[o]}`).join(', ')}>
                {ORDER.map((o) => counts[o] > 0 && <span key={o} data-status={o} style={{ flexGrow: counts[o] }} title={`${counts[o]} ${HEAT_LABEL[o]}`}>{counts[o]}</span>)}
              </div>
              <span className="skill-metrics">
                <b>{decided ? `${gapPct}%` : '–'}</b> gap · mgr {mgr} · test {test}
              </span>
            </li>
          ))}
        </ul>
        <div className="legend">
          {ORDER.map((o) => (
            <span key={o}>
              <i className="swatch heat-swatch" data-status={o} /> {HEAT_LABEL[o]}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Gap rate by function" description="Percentage of people in each function who are below target in each skill. Darker means a bigger gap.">
        <div className="heat-wrap">
          <table className="heat heat-pct">
            <thead>
              <tr>
                <th />
                {functions.map((f) => (
                  <th key={f} title={f}>
                    <span>{f}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s }) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  {functions.map((f) => {
                    const c = cell(s.id, f)
                    return (
                      <td key={f}>
                        <span className="heat-cell heat-num" style={{ ['--k' as string]: c.n ? c.gap / 100 : 0 }} data-empty={c.n === 0} title={c.n ? `${f} · ${s.name}: ${c.gap}% of ${c.n} in gap` : 'No results yet'}>
                          {c.n ? `${c.gap}%` : '–'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
