import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, AtSign, ChevronRight, Lock } from 'lucide-react'
import { api, type DemoUser, type User } from '../api'

export function Login({ onSignIn }: { onSignIn: (u: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [demo, setDemo] = useState<DemoUser[]>([])

  useEffect(() => {
    api.demoUsers().then(setDemo).catch(() => setDemo([]))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onSignIn(await api.login(email, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <img className="login-logo" src="/bajaj-logo.png" alt="Bajaj Auto" />
        <h1 className="login-title">Welcome back</h1>
        <p className="muted login-sub">
          Sign in to continue to <strong>Skills Platform</strong>.
        </p>

        <form className="stack-sm" onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="login-email">
              Email
            </label>
            <div className="input-icon">
              <AtSign size={16} aria-hidden />
              <input id="login-email" className="input" type="email" autoComplete="username" placeholder="name@bajajauto.co.in" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <div className="row-between">
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <button type="button" className="link-btn link-sm" onClick={() => setError('Password reset is not available in the demo.')}>
                Forgot password?
              </button>
            </div>
            <div className="input-icon">
              <Lock size={16} aria-hidden />
              <input id="login-password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="link-btn link-sm input-end" onClick={() => setShow((s) => !s)}>
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : <>Sign in <ArrowRight size={15} /></>}
          </button>
        </form>

        {demo.length > 0 && (
          <>
            <div className="login-divider">
              <span>Demo access</span>
            </div>
            <p className="muted login-sub">Select a profile to autofill its mock credentials.</p>
            <div className="demo-grid">
              {demo.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="demo-card"
                  onClick={() => {
                    setEmail(u.email)
                    setPassword(u.password)
                    setError('')
                  }}
                >
                  <span className="demo-avatar">{u.initials}</span>
                  <span className="demo-text">
                    <strong>{u.name}</strong>
                    <small>{u.roleLabel}</small>
                  </span>
                  <ChevronRight size={14} aria-hidden />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
