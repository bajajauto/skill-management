import express from 'express'
import { cohortsRouter } from './routes/cohorts.js'
import { authRouter } from './routes/auth.js'
import { meRouter } from './routes/me.js'
import { teamRouter } from './routes/team.js'
import { buhrRouter } from './routes/buhr.js'
import { ensureSeed } from './lib/demoSetup.js'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(express.json({ limit: '20mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/me', meRouter)
app.use('/api/team', teamRouter)
app.use('/api/buhr', buhrRouter)
app.use('/api/cohorts', cohortsRouter)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status ?? 500).json({ error: err.expose ? err.message : 'Internal server error' })
})

if (await ensureSeed()) console.log('Seeded demo framework, questions and employee progress')
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))
