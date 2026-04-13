/**
 * Perceptual diff: compares public/screenshots/ against public/screenshots-prev/
 * using sharp + pixelmatch.
 *
 * Flags brands where >5% of pixels differ at threshold 0.1.
 * Outputs a JSON array of changed brand IDs to stdout.
 *
 * Run: npm run screenshots:diff
 * (expects public/screenshots-prev/ to already exist from workflow step 1)
 */
import pixelmatch from 'pixelmatch'
import sharp from 'sharp'
import { readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CURRENT_DIR = join(ROOT, 'public', 'screenshots')
const PREV_DIR = join(ROOT, 'public', 'screenshots-prev')

const DIFF_THRESHOLD = 0.1   // pixelmatch per-pixel noise tolerance (0–1)
const CHANGE_RATIO   = 0.05  // flag if >5% of pixels differ

if (!existsSync(PREV_DIR)) {
  // No previous screenshots to compare against — nothing changed
  process.stdout.write('[]')
  process.exit(0)
}

const W = 1280
const H = 720
const changedIds: string[] = []

const files = readdirSync(CURRENT_DIR).filter(f => f.endsWith('.webp'))

for (const file of files) {
  const id = file.replace('.webp', '')
  const prevPath = join(PREV_DIR, file)
  const currPath = join(CURRENT_DIR, file)

  if (!existsSync(prevPath)) {
    // New brand — not a "change" in the diff sense
    continue
  }

  try {
    const [prevRaw, currRaw] = await Promise.all([
      sharp(prevPath).resize(W, H).raw().ensureAlpha().toBuffer(),
      sharp(currPath).resize(W, H).raw().ensureAlpha().toBuffer(),
    ])

    const diffPixels = pixelmatch(
      new Uint8ClampedArray(prevRaw.buffer),
      new Uint8ClampedArray(currRaw.buffer),
      null,   // no diff image output
      W, H,
      { threshold: DIFF_THRESHOLD }
    )

    const ratio = diffPixels / (W * H)
    if (ratio > CHANGE_RATIO) {
      changedIds.push(id)
    }
  } catch {
    // Comparison failed — assume changed to be safe
    changedIds.push(id)
  }
}

process.stdout.write(JSON.stringify(changedIds))
