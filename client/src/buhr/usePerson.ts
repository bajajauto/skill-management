import { useEffect, useState } from 'react'
import { buhrApi } from '../api'
import type { PublishedMe } from '../employee/types'

/** One person in the business unit, fetched on demand so the tracking list itself stays small. */
export function usePerson(id: string): PublishedMe | null | 'missing' {
  const [person, setPerson] = useState<PublishedMe | null | 'missing'>(null)

  useEffect(() => {
    let cancelled = false
    setPerson(null)
    buhrApi
      .person(id)
      .then((r) => !cancelled && setPerson(r.snapshot.published ? r.snapshot : 'missing'))
      .catch(() => !cancelled && setPerson('missing'))
    return () => {
      cancelled = true
    }
  }, [id])

  return person
}
