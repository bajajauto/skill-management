// Runs the API server and the Vite client together with prefixed output.
import { spawn } from 'node:child_process'

const procs = [
  ['server', 'server'],
  ['client', 'client'],
].map(([name, dir]) => {
  const p = spawn('npm', ['run', 'dev'], { cwd: dir, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const tag = (stream, out) => stream.on('data', (d) => d.toString().split(/\r?\n/).filter(Boolean).forEach((l) => out.write(`[${name}] ${l}\n`)))
  tag(p.stdout, process.stdout)
  tag(p.stderr, process.stderr)
  p.on('exit', (code) => {
    console.log(`[${name}] exited (${code})`)
    shutdown(code ?? 0)
  })
  return p
})

let closing = false
function shutdown(code) {
  if (closing) return
  closing = true
  procs.forEach((p) => p.kill())
  process.exit(code)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
