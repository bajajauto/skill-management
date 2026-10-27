import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'

export type AppIconName = 'home' | 'skill-framework' | 'talent-insights' | 'assessment-cycles' | 'learning-actions' | 'framework' | 'skills' | 'questions' | 'scoring' | 'publish' | 'validation' | 'department'

export function AppIcon({ name, size = 28, className = '' }: { name: AppIconName; size?: number; className?: string }) {
  return <img className={`app-icon ${className}`} src={`/icon-${name}.png`} width={size} height={size} alt="" aria-hidden />
}

/* --------------------------------- Buttons --------------------------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
}
export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...rest }: BtnProps) {
  return <button type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...rest} />
}

/* ---------------------------------- Fields --------------------------------- */

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          className="segmented-item"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)}>
      <span className="toggle-thumb" />
    </button>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Card({ title, description, action, children }: { title?: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {description && <p className="card-desc">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function SetupGuide({ step, title, icon, children }: { step: string; title: string; icon?: AppIconName; children: ReactNode }) {
  return (
    <section className="setup-guide">
      {icon && <AppIcon name={icon} size={62} className="setup-guide-icon" />}
      <div><span className="overview-kicker">{step}</span><h2>{title}</h2><p>{children}</p></div>
    </section>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  )
}

/* --------------------------------- Dialogs --------------------------------- */

/** Modal dialog on the native <dialog> element: focus trap, Esc and inert background come for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return createPortal(
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <div className="dialog-inner">
          <header className="dialog-head">
            <h2 id={titleId}>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </header>
          <div className="dialog-body">{children}</div>
          {footer && <footer className="dialog-foot">{footer}</footer>}
        </div>
      )}
    </dialog>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Dialog>
  )
}

/* ---------------------------------- Toasts --------------------------------- */

interface ToastItem {
  id: number
  message: string
  tone: 'ok' | 'error'
}
const ToastCtx = createContext<(message: string, tone?: ToastItem['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const next = useRef(0)
  const push = useCallback((message: string, tone: ToastItem['tone'] = 'ok') => {
    const id = next.current++
    setItems((l) => [...l.slice(-2), { id, message, tone }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.tone === 'ok' ? <Check size={14} /> : <X size={14} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
