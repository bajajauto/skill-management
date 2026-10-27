import { X } from 'lucide-react'
import { Button } from '../components/ui'
import { distinct, emptyFilters, type Filters } from './logic'
import { useBu } from './BuContext'

const FIELDS: { key: keyof Filters; label: string; pick: (p: import('./types').BuPerson) => string }[] = [
  { key: 'function', label: 'Function', pick: (p) => p.employee.function },
  { key: 'location', label: 'Location', pick: (p) => p.employee.location },
  { key: 'manager', label: 'Reporting manager', pick: (p) => p.employee.manager },
  { key: 'level', label: 'Level', pick: (p) => p.level },
]

/** The common filter set from the architecture doc, applied to every BUHR screen that shows people. */
export function FilterBar() {
  const { data, filters, setFilters, filtered } = useBu()
  if (!data?.published) return null
  const active = Object.values(filters).some(Boolean)

  return (
    <div className="bu-filters" role="group" aria-label="Filters">
      {FIELDS.map((f) => (
        <select key={f.key} className="input" aria-label={f.label} value={filters[f.key]} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}>
          <option value="">All {f.label.toLowerCase()}s</option>
          {distinct(data.people, f.pick).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ))}
      <span className="bu-filters-count muted">
        {filtered.length} of {data.people.length} people
      </span>
      {active && (
        <Button size="sm" variant="ghost" onClick={() => setFilters(emptyFilters)}>
          <X size={13} /> Clear filters
        </Button>
      )}
    </div>
  )
}
