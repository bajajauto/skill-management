import { useRef } from 'react'
import { Check, PencilLine } from 'lucide-react'
import { useDispatch, useStore } from '../../store'
import { Button } from '../../components/ui'
import type { Reviewed } from '../../types'

/**
 * Shown at the top of steps that start with usable defaults. The admin either accepts the defaults as they are
 * or edits them; both count as signing the step off, which is what puts the tick on it.
 */
export function ReviewChoice({ area, subject }: { area: keyof Reviewed; subject: string }) {
  const { config } = useStore()
  const dispatch = useDispatch()
  const ref = useRef<HTMLElement>(null)

  if (config.reviewed[area]) {
    return (
      <p className="review-done">
        <Check size={15} strokeWidth={3} /> Reviewed. You can still change anything below.
      </p>
    )
  }

  return (
    <section className="review-choice" ref={ref} aria-label={`Review the ${subject}`}>
      <div>
        <p className="strong">Use the default {subject}, or make your own?</p>
        <p className="muted">Sensible defaults are already filled in. Accept them as they are, or change anything below. Either way this step is then marked done.</p>
      </div>
      <div className="btn-row">
        <Button variant="primary" onClick={() => dispatch({ type: 'review', area, value: true })}>
          <Check size={14} /> Use as they are
        </Button>
        <Button onClick={() => (ref.current?.nextElementSibling as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <PencilLine size={14} /> Make edits
        </Button>
      </div>
    </section>
  )
}
