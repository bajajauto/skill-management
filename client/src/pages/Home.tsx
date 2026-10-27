import { ArrowRight } from 'lucide-react'
import { AppIcon, type AppIconName } from '../components/ui'

const modules = [
  { title: 'Skill Framework Setup', description: 'Define business unit skills, rating scales, questions, scoring rules and publish the assessment standard.', icon: 'skill-framework', href: '#/admin/overview', status: 'Available', color: 'var(--tile-sage)' },
  { title: 'Talent Insights', description: 'View capability coverage, proficiency distribution, critical gaps and department trends.', icon: 'talent-insights', status: 'Coming soon', color: 'var(--tile-sky)' },
  { title: 'Assessment Cycles', description: 'Create assessment periods, assign employees and track manager and employee completion.', icon: 'assessment-cycles', status: 'Coming soon', color: 'var(--tile-sand)' },
  { title: 'Learning Actions', description: 'Connect identified skill gaps to courses, development plans and follow-up assessments.', icon: 'learning-actions', status: 'Coming soon', color: 'var(--tile-lilac)' },
] satisfies { title: string; description: string; icon: AppIconName; href?: string; status: string; color: string }[]

export function Home() {
  return <>
    <div className="page stack">
      <section aria-labelledby="modules-title">
        <h1 id="modules-title" className="home-section-title">
          Talent development hub <span>Build frameworks and close capability gaps</span>
        </h1>
        <div className="module-grid">
          {modules.map((module) => {
            const content = <><span className="module-top"><span className="tile tile-3d" style={{ ['--tile' as string]: module.color }}><AppIcon name={module.icon} size={82} /></span><span className={`module-status ${module.href ? 'module-status-live' : ''}`}>{module.status}</span></span><span><strong className="module-title">{module.title}</strong><span className="module-description">{module.description}</span></span><span className="module-action">{module.href ? <>Open module <ArrowRight size={14} /></> : 'Not yet available'}</span></>
            return module.href ? <a key={module.title} className="module-card" href={module.href}>{content}</a> : <article key={module.title} className="module-card module-card-disabled" aria-disabled="true">{content}</article>
          })}
        </div>
      </section>
    </div>
  </>
}
