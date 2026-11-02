import { useCallback, useEffect, useRef, useState } from 'react'
import { meApi } from '../api'

/**
 * Test integrity, as far as a web page can go. A page cannot stop the operating system or a phone camera
 * from capturing the screen, so this blocks what the browser lets it block, detects and records the rest,
 * and watermarks every question so a leaked photo points back to the person who took it.
 */

export type ViolationType = 'tab-hidden' | 'window-blur' | 'fullscreen-exit' | 'screenshot-key' | 'print'

export const fullscreenSupported = () => typeof document !== 'undefined' && document.fullscreenEnabled === true

/** Must be called from a click or key press, or the browser refuses. */
export async function enterFullscreen() {
  try {
    if (fullscreenSupported() && !document.fullscreenElement) await document.documentElement.requestFullscreen()
  } catch {
    /* refused: the page falls back to tab-switch detection alone */
  }
}

export const REASON: Record<ViolationType, string> = {
  'tab-hidden': 'You switched to another tab or window.',
  'window-blur': 'The test window lost focus.',
  'fullscreen-exit': 'You left full screen.',
  'screenshot-key': 'A screenshot key was pressed.',
  print: 'Printing was attempted.',
}

const BLOCKED_COMBOS = ['p', 's', 'c', 'x', 'u']
const SHORT_NOTICE_MS = 4000

export function useTestGuard({
  attemptId,
  maxViolations,
  initialCount,
  onAutoSubmit,
}: {
  attemptId: string
  maxViolations: number
  initialCount: number
  /** Called once when the strikes run out; the caller submits the answers so far. */
  onAutoSubmit: () => void
}) {
  const [count, setCount] = useState(initialCount)
  const [paused, setPaused] = useState<ViolationType | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const away = useRef(false)
  const finished = useRef(false)
  const lastStrike = useRef<{ type: string; at: number } | null>(null)
  const needFullscreen = useRef(fullscreenSupported())
  const autoSubmit = useRef(onAutoSubmit)
  autoSubmit.current = onAutoSubmit

  const report = useCallback(
    async (type: ViolationType) => {
      if (finished.current) return
      setCount((c) => c + 1)
      try {
        const r = await meApi.reportViolation(attemptId, type)
        setCount(r.count)
        if (r.autoSubmit && !finished.current) {
          finished.current = true
          autoSubmit.current()
        }
      } catch {
        /* offline: the server count catches up on the next report */
      }
    },
    [attemptId],
  )

  /** Leaving the test: one strike per absence, and the questions stay hidden until the person comes back. */
  const leave = useCallback(
    (type: ViolationType) => {
      if (away.current || finished.current) return
      away.current = true
      setPaused(type)
      void report(type)
    },
    [report],
  )

  /** A one-off action (screenshot or print key): a strike, but no need to pause. Repeats within 2s count once. */
  const strike = useCallback(
    (type: ViolationType) => {
      if (finished.current) return
      const now = Date.now()
      if (lastStrike.current && lastStrike.current.type === type && now - lastStrike.current.at < 2000) return
      lastStrike.current = { type, at: now }
      setNotice(`${REASON[type]} This counts as a strike.`)
      setTimeout(() => setNotice(null), SHORT_NOTICE_MS)
      void report(type)
    },
    [report],
  )

  useEffect(() => {
    const onVisibility = () => document.hidden && leave('tab-hidden')
    const onBlur = () => leave('window-blur')
    const onFullscreen = () => needFullscreen.current && !document.fullscreenElement && leave('fullscreen-exit')
    const stop = (e: Event) => e.preventDefault()

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      if (mod && k === 'p') strike('print')
      if ((mod && BLOCKED_COMBOS.includes(k)) || e.key === 'F12' || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k))) e.preventDefault()
    }
    // PrintScreen only fires keyup on Windows. Overwriting the clipboard leaves a pasted capture empty of the question.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        void navigator.clipboard?.writeText('Screenshots are not allowed during the test.').catch(() => {})
        strike('screenshot-key')
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFullscreen)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    const onBeforePrint = () => strike('print')
    window.addEventListener('beforeprint', onBeforePrint)
    for (const ev of ['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'selectstart']) document.addEventListener(ev, stop)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreen)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('beforeprint', onBeforePrint)
      for (const ev of ['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'selectstart']) document.removeEventListener(ev, stop)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [leave, strike])

  /** Back to the test: go full screen again (needs the click), then show the questions. */
  const resume = useCallback(async () => {
    if (needFullscreen.current) await enterFullscreen()
    if (needFullscreen.current && !document.fullscreenElement) return
    away.current = false
    setPaused(null)
  }, [])

  return { count, paused, notice, resume, remaining: Math.max(0, maxViolations - count) }
}

/** Faint, repeating "name · ID" over the whole page. A photo or capture of a question shows who took the test. */
export function Watermark({ text }: { text: string }) {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='170'><text x='140' y='90' text-anchor='middle' transform='rotate(-22 140 85)' font-family='Segoe UI,Arial,sans-serif' font-size='15' font-weight='600' fill='#000' fill-opacity='0.07'>${safe}</text></svg>`
  return <div className="watermark" aria-hidden style={{ backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")` }} />
}
