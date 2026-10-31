#!/usr/bin/env node
// Creates a random, unguessable path segment for the staff console and wires it up locally:
//   .env.local         VITE_STAFF_PATH_HASH=<sha256 of segment>   (the bundle only gets the hash)
//   mock-api/.env      STAFF_PORTAL_PATH=/<segment>               (for staff reset-password links)
// Both files are gitignored. Run from apps/web:  npm run staff-path   [-- --segment <your-own-segment>]
import { createHash, randomInt } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (0/o, 1/l/i)

const flag = process.argv.indexOf('--segment')
let segment = flag > -1 ? process.argv[flag + 1] : Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
if (!/^[a-z0-9-]{12,64}$/.test(segment ?? '')) {
  console.error('Segment must be 12–64 characters of a-z, 0-9 or "-".')
  process.exit(1)
}
const hash = createHash('sha256').update(segment).digest('hex')

function upsert(file, key, value, comment) {
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : []
  const kept = lines.filter((l) => !l.startsWith(`${key}=`) && !l.startsWith('# Staff console URL'))
  while (kept.length && kept.at(-1) === '') kept.pop()
  if (comment) kept.push(comment)
  kept.push(`${key}=${value}`, '')
  writeFileSync(file, kept.join('\n'))
}

const webEnv = join(webDir, '.env.local')
if (!existsSync(webEnv) && existsSync(join(webDir, '.env.example'))) {
  writeFileSync(webEnv, readFileSync(join(webDir, '.env.example'), 'utf8').replace(/^VITE_STAFF_PATH_HASH=.*\n?/m, ''))
}
upsert(webEnv, 'VITE_STAFF_PATH_HASH', hash, `# Staff console URL (local only, keep private): http://localhost:5173/${segment}/login`)
upsert(join(webDir, 'mock-api/.env'), 'STAFF_PORTAL_PATH', `/${segment}`)

console.log(`
Staff console path generated.

  Local URL:   http://localhost:5173/${segment}/login
  Segment:     ${segment}
  SHA-256:     ${hash}

Written to .env.local (hash only) and mock-api/.env (path). Restart "npm run dev:all".

For production, keep the segment private and set:
  Web build (CI):            VITE_STAFF_PATH_HASH=${hash}
  API (Elastic Beanstalk):   STAFF_PORTAL_PATH=/${segment}
`)
