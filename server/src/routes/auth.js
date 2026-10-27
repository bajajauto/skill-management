import { Router } from 'express'

export const authRouter = Router()

// Demo-only accounts. Replace with HRMS / SSO-backed auth before real use.
const USERS = [
  { id: 'u1', name: 'Asha Rao', initials: 'AR', role: 'employee', roleLabel: 'Employee', email: 'asha.rao@bajajauto.co.in', password: 'demo@123' },
  { id: 'u2', name: 'Vikram Shah', initials: 'VS', role: 'manager', roleLabel: 'Manager', email: 'vikram.shah@bajajauto.co.in', password: 'demo@123' },
  { id: 'u3', name: 'Priya Nair', initials: 'PN', role: 'buhr', roleLabel: 'BU HR', email: 'priya.nair@bajajauto.co.in', password: 'demo@123' },
  { id: 'u4', name: 'TD Administrator', initials: 'TD', role: 'td-admin', roleLabel: 'TD Admin', email: 'td.admin@bajajauto.co.in', password: 'demo@123' },
]

const publicUser = ({ password: _p, ...u }) => u

authRouter.get('/demo', (_req, res) => {
  res.json(USERS.map((u) => ({ ...publicUser(u), password: u.password })))
})

authRouter.post('/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const user = USERS.find((u) => u.email === email && u.password === password)
  if (!user) return res.status(401).json({ error: 'Incorrect email or password.' })
  res.json({ user: publicUser(user) })
})
