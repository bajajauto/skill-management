import { useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button, Dialog, useToast } from './ui'
import { readTable, type ImportResult } from '../lib/importers'

type Rows = Awaited<ReturnType<typeof readTable>>

export function ImportDialog<T>({
  open,
  onClose,
  title,
  intro,
  onTemplate,
  parse,
  preview,
  extra,
  commitLabel,
  onCommit,
}: {
  open: boolean
  onClose: () => void
  title: string
  intro: ReactNode
  onTemplate: () => void
  /** Re-run whenever the file or any option in `extra` changes. */
  parse: (rows: Rows) => ImportResult<T>
  preview: (items: T[]) => ReactNode
  extra?: ReactNode
  commitLabel: (count: number) => string
  onCommit: (items: T[]) => void
}) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<Rows | null>(null)
  const [drag, setDrag] = useState(false)
  const [loading, setLoading] = useState(false)

  const result = useMemo(() => (rows ? parse(rows) : null), [rows, parse])

  const close = () => {
    setFile(null)
    setRows(null)
    onClose()
  }

  const pick = async (f: File | undefined) => {
    if (!f) return
    if (!/\.(xlsx|csv)$/i.test(f.name)) {
      toast('Use an .xlsx or .csv file.', 'error')
      return
    }
    setLoading(true)
    try {
      setRows(await readTable(f))
      setFile(f)
    } catch {
      toast("Couldn't read that file. Check it isn't password-protected or open elsewhere.", 'error')
    } finally {
      setLoading(false)
    }
  }

  const ok = result && result.errors.length === 0 && result.items.length > 0

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!ok}
            onClick={() => {
              if (!result) return
              onCommit(result.items)
              toast(`${commitLabel(result.items.length)}`)
              close()
            }}
          >
            {result ? commitLabel(result.items.length) : 'Import'}
          </Button>
        </>
      }
    >
      <p className="muted">{intro}</p>
      <button type="button" className="link-btn" onClick={onTemplate}>
        <Download size={14} /> Download template (.csv)
      </button>

      {extra}

      <div
        className={`drop ${drag ? 'drop-active' : ''}`}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          void pick(e.dataTransfer.files[0])
        }}
      >
        <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        {file ? <FileSpreadsheet size={20} /> : <Upload size={20} />}
        <p className="strong">{loading ? 'Reading file…' : file ? file.name : 'Drop an .xlsx or .csv file here'}</p>
        <Button size="sm" onClick={() => input.current?.click()}>
          {file ? 'Choose a different file' : 'Browse files'}
        </Button>
      </div>

      {result && (
        <div className="import-result">
          {result.errors.length > 0 && (
            <ul className="notes notes-error">
              {result.errors.slice(0, 6).map((e, i) => (
                <li key={i}>
                  <AlertTriangle size={14} /> {e}
                </li>
              ))}
              {result.errors.length > 6 && <li>…and {result.errors.length - 6} more</li>}
            </ul>
          )}
          {result.items.length > 0 && preview(result.items)}
          {result.warnings.length > 0 && (
            <details className="notes notes-warn">
              <summary>
                {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
              </summary>
              <ul>
                {result.warnings.slice(0, 30).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {result.warnings.length > 30 && <li>…and {result.warnings.length - 30} more</li>}
              </ul>
            </details>
          )}
        </div>
      )}
    </Dialog>
  )
}
