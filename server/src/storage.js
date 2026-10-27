import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = process.env.DATA_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')

const fileFor = (name) => path.join(DATA_DIR, `${name}.json`)

export async function readDoc(name) {
  try {
    return JSON.parse(await readFile(fileFor(name), 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
}

// Serialise writes and swap the file in atomically so a crash mid-write can't leave half a document.
let queue = Promise.resolve()
export function writeDoc(name, data) {
  queue = queue.then(async () => {
    const file = fileFor(name)
    await mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    await writeFile(tmp, JSON.stringify(data, null, 2))
    await rename(tmp, file)
  })
  return queue
}

export async function deleteDoc(name) {
  await rm(fileFor(name), { force: true })
}

/** Names (without .json) of the documents in a folder, or [] if the folder doesn't exist yet. */
export async function listDocs(dir) {
  try {
    const files = await readdir(path.join(DATA_DIR, dir))
    return files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
}
