import { useState } from 'react'
import { PencilLine } from 'lucide-react'
import { useDispatch, useStore } from '../../store'
import { Card, Field, Segmented, SetupGuide } from '../../components/ui'
import { percentToScore } from '../../lib/scale'
import { ReviewChoice } from './ReviewChoice'
import type { Bands, Difficulty, ScoringConfig } from '../../types'

export function Scoring() {
  const { config } = useStore()
  const dispatch = useDispatch()
  const s = config.scoring
  const set = (patch: Partial<ScoringConfig>) => dispatch({ type: 'config', update: (c) => ({ ...c, scoring: { ...c.scoring, ...patch } }) })

  return (
    <div className="stack">
      <SetupGuide step="Step 4 of 5 · Set calculation rules" title="Define how assessment results are interpreted" icon="scoring">
        Confirm score bands, question difficulty weights, development-gap triggers and the minimum result needed for progression. Use the simulator to test the rules before publishing.
      </SetupGuide>
      <ReviewChoice area="scoring" subject="scoring rules" />
      <Card
        title="Score bands"
        description="Convert a 0–100% result into a 0–3 proficiency score. 0 is reserved for “not assessed”, so scored results are always 1–3."
      >
        <div className="bands">
          <BandEditor
            title="Manager validation"
            hint={config.scale.type === 'binary' ? 'Share of applicable tasks marked positive.' : 'Average rating, normalised to 0–100%.'}
            bands={s.manager}
            onChange={(manager) => set({ manager })}
          />
          <BandEditor title="Objective test" hint="Weighted test score as a percentage." bands={s.test} onChange={(test) => set({ test })} />
        </div>
        <Simulator />
      </Card>

      <Card title="Gap & progression rules" description="Applied to the manager and test scores. Self-rating is reflection only and never counts.">
        <div className="grid-2">
          <Field label="Flag a development gap when either score is below" hint="Course-trigger threshold.">
            <Segmented
              label="Course trigger"
              value={s.courseTriggerBelow}
              onChange={(v) => set({ courseTriggerBelow: v })}
              options={[1, 2, 3].map((v) => ({ value: v as 1 | 2 | 3, label: String(v) }))}
            />
          </Field>
          <Field label="Cluster is cleared when both scores reach" hint="Progression threshold.">
            <Segmented
              label="Progression minimum"
              value={s.progressionMin}
              onChange={(v) => set({ progressionMin: v })}
              options={[1, 2, 3].map((v) => ({ value: v as 1 | 2 | 3, label: String(v) }))}
            />
          </Field>
        </div>
        <Field label="When a score is missing" hint="Strict rule: no gap decision fires until both inputs exist, unless you choose otherwise.">
          <Segmented
            label="Missing input"
            value={s.missingInput}
            onChange={(v) => set({ missingInput: v })}
            options={[
              { value: 'incomplete', label: 'Mark incomplete and wait' },
              { value: 'treat-as-zero', label: 'Treat as 0' },
            ]}
          />
        </Field>
      </Card>

      <Card title="Question difficulty weights" description="Points per correct answer when computing the weighted test score.">
        <div className="grid-3">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
            <Field key={d} label={d[0].toUpperCase() + d.slice(1)} htmlFor={`w-${d}`}>
              <input
                id={`w-${d}`}
                className="input"
                type="number"
                min={0.1}
                step={0.5}
                value={s.weights[d]}
                onChange={(e) => set({ weights: { ...s.weights, [d]: Number(e.target.value) } })}
              />
            </Field>
          ))}
        </div>
      </Card>
    </div>
  )
}

function BandEditor({ title, hint, bands, onChange }: { title: string; hint: string; bands: Bands; onChange: (b: Bands) => void }) {
  const clamp = (n: number) => Math.max(0, Math.min(99, Math.round(Number.isFinite(n) ? n : 0)))
  const invalid = !(bands.s1Max < bands.s2Max && bands.s2Max < 100)
  return (
    <div className="band-editor">
      <div className="band-editor-head">
        <div><p className="strong">{title}</p><p className="field-hint">{hint}</p></div>
        <span className="editable-badge"><PencilLine size={12} /> Editable</span>
      </div>
      <div className="band-bar" aria-hidden>
        <span style={{ flexGrow: bands.s1Max + 1 }} data-score="1" />
        <span style={{ flexGrow: Math.max(0, bands.s2Max - bands.s1Max) }} data-score="2" />
        <span style={{ flexGrow: Math.max(0, 100 - bands.s2Max) }} data-score="3" />
      </div>
      <p className="band-instruction">Set the highest percentage for Scores 1 and 2. The next range updates automatically.</p>
      <div className="band-rows">
        <div className="band-row">
          <span className="band-chip" data-score="1">1</span>
          <span className="band-range-label"><strong>Score 1</strong><small>0% through</small></span>
          <label className="threshold-input"><input type="number" min={0} max={99} aria-label={`${title}: score 1 maximum percentage`} value={bands.s1Max} onChange={(e) => onChange({ ...bands, s1Max: clamp(e.target.valueAsNumber) })} /><span>% max</span></label>
        </div>
        <div className="band-row">
          <span className="band-chip" data-score="2">2</span>
          <span className="band-range-label"><strong>Score 2</strong><small>{bands.s1Max + 1}% through</small></span>
          <label className="threshold-input"><input type="number" min={0} max={99} aria-label={`${title}: score 2 maximum percentage`} value={bands.s2Max} onChange={(e) => onChange({ ...bands, s2Max: clamp(e.target.valueAsNumber) })} /><span>% max</span></label>
        </div>
        <div className="band-row">
          <span className="band-chip" data-score="3">3</span>
          <span className="band-range-label"><strong>Score 3</strong><small>{bands.s2Max + 1}% through 100%</small></span>
          <span className="auto-value">Calculated automatically</span>
        </div>
      </div>
      {invalid && <p className="field-error">Each band must end above the previous one and below 100%.</p>}
    </div>
  )
}

function Simulator() {
  const { config } = useStore()
  const { scoring: s } = config
  const [mgr, setMgr] = useState(70)
  const [test, setTest] = useState(55)
  const m = percentToScore(mgr, s.manager)
  const t = percentToScore(test, s.test)
  const gap = m < s.courseTriggerBelow || t < s.courseTriggerBelow
  const cleared = m >= s.progressionMin && t >= s.progressionMin

  return (
    <div className="sim">
      <p className="preview-eyebrow">Try it</p>
      <div className="sim-grid">
        <label className="sim-input">
          <span>Manager %</span>
          <input type="range" min={0} max={100} value={mgr} onChange={(e) => setMgr(Number(e.target.value))} />
          <output>
            {mgr}% → <b data-score={m}>{m}</b>
          </output>
        </label>
        <label className="sim-input">
          <span>Test %</span>
          <input type="range" min={0} max={100} value={test} onChange={(e) => setTest(Number(e.target.value))} />
          <output>
            {test}% → <b data-score={t}>{t}</b>
          </output>
        </label>
        <div className="sim-result" data-state={cleared ? 'cleared' : gap ? 'gap' : 'open'}>
          {cleared ? 'Cluster cleared' : gap ? 'Development gap' : 'Open: below clearance, not a gap'}
        </div>
      </div>
    </div>
  )
}

