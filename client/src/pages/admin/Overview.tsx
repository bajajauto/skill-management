import { ArrowRight } from 'lucide-react'
import { AppIcon } from '../../components/ui'
import { useStore } from '../../store'
import { setupProgress } from '../../lib/progress'

export function Overview() {
  const state = useStore()
  const { publication, dirtySincePublish, nodes, questions } = state
  const { count, total } = setupProgress(state)
  const skills = nodes.filter((n) => n.type === 'skill').length
  const tasks = nodes.filter((n) => n.type === 'task').length

  return <div className="stack">
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-eyebrow">Framework status</span>
        <h2 className="hero-title">{publication ? `Framework v${publication.version}${dirtySincePublish ? ' has unpublished changes' : ' is live'}` : 'Your framework is still in setup'}</h2>
        <p className="muted">{skills} skills · {tasks} tasks · {questions.length} questions · {count} of {total} setup steps done</p>
        <a className="btn btn-primary" href="#/admin/framework" style={{ textDecoration: 'none' }}>Continue setup <ArrowRight size={15} /></a>
      </div>
    </section>

    <section className="overview-explainer" aria-labelledby="td-admin-responsibility-title">
      <div className="overview-intro"><span className="overview-kicker">Your responsibility as TD Admin</span><h3 id="td-admin-responsibility-title">Configure and publish the business unit's assessment standard</h3><p className="muted">You define what will be assessed, how it will be rated and how results will be calculated. Complete the setup in sequence, validate every mapping, then publish the approved configuration.</p></div>
      <div className="assessment-flow admin-flow" aria-label="TD Admin setup workflow">
        <div className="flow-node"><AppIcon name="framework" size={46} /><span><strong>1. Define rules</strong><small>Organization, business unit, hierarchy, levels and rating scale</small></span></div><ArrowRight className="flow-arrow" size={18} aria-hidden />
        <div className="flow-node"><AppIcon name="skills" size={46} /><span><strong>2. Load source data</strong><small>Skill matrix and mapped question bank</small></span></div><ArrowRight className="flow-arrow" size={18} aria-hidden />
        <div className="flow-node"><AppIcon name="validation" size={46} /><span><strong>3. Validate setup</strong><small>Scoring rules, missing data and mappings</small></span></div><ArrowRight className="flow-arrow" size={18} aria-hidden />
        <div className="flow-node flow-result"><AppIcon name="publish" size={46} /><span><strong>4. Publish</strong><small>Release the approved version for use</small></span></div>
      </div>
    </section>
  </div>
}
