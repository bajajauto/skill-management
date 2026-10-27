import { useState } from 'react'
import { cohortApi } from '../api'
import { useToast } from '../components/ui'
import { useCohorts } from './CohortsContext'

/**
 * Starts a new cohort: creates a blank draft, makes it the one Skill Framework Setup works on,
 * and opens the Framework step, where the organization and business unit are chosen.
 */
export function useNewCohort() {
  const { refresh, select } = useCohorts()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const start = async () => {
    if (busy) return
    setBusy(true)
    try {
      const c = await cohortApi.create('', '')
      await refresh()
      select(c.id)
      location.hash = '/admin/framework'
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create the cohort', 'error')
    } finally {
      setBusy(false)
    }
  }
  return { start, busy }
}
