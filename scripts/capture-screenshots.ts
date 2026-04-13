/**
 * Capture webp previews of all brand websites.
 *
 * - Visit each brand.websiteUrl in 1280x720 viewport.
 * - Wait for network idle.
 * - Screenshot full viewport.
 * - Convert to WebP (80 quality, fallback to 65 if file exceeds size).
 * - Write to public/screenshots/{id}.webp.
 *
 * Run with: npm run screenshots
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUTPUT_DIR = join(ROOT, 'public', 'screenshots')

mkdirSync(OUTPUT_DIR, { recursive: true })

// Import brand list at runtime via tsx
const { brands } = await import('../src/data/brands.ts')

const TIMEOUT_MS = 45_000
const VIEWPORT = { width: 1280, height: 720 }
const WEBP_QUALITY = 80
const WEBP_QUALITY_LOW = 65
const MAX_SIZE_KB = 200
const RESIZE_FIT: 'cover' = 'cover'

let succeeded = 0
let failed = 0

const CHROME_PATH = process.env.CHROME_EXECUTABLE_PATH ??
  '/Users/admin/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_PATH,
})
const context = await browser.newContext({ viewport: VIEWPORT })

const limit = Number.parseInt(process.env.SCREENSHOT_LIMIT || '', 10)
const targetBrands = Number.isNaN(limit) || limit <= 0 ? brands : brands.slice(0, limit)

for (const brand of targetBrands) {
  const outPath = join(OUTPUT_DIR, `${brand.id}.webp`)

  try {
    const page = await context.newPage()
    await page.goto(brand.websiteUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS,
    })

    // Give the page a moment to render before capturing
    await page.waitForTimeout(1500)

    const pngBuffer = await page.screenshot({ type: 'png', fullPage: false })
    await page.close()

    let webpBuffer = await sharp(pngBuffer).webp({ quality: WEBP_QUALITY }).toBuffer()

    if (webpBuffer.length > MAX_SIZE_KB * 1024) {
      webpBuffer = await sharp(pngBuffer)
        .resize(VIEWPORT.width, VIEWPORT.height, { fit: RESIZE_FIT })
        .webp({ quality: WEBP_QUALITY_LOW })
        .toBuffer()
    }

    await sharp(webpBuffer).toFile(outPath)
    console.log(`✓ ${brand.id} (${Math.round(webpBuffer.length / 1024)} KB)`)
    succeeded += 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`WARN: failed to screenshot ${brand.id} — ${message}`)
    failed += 1
  }
}

await context.close()
await browser.close()

console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`)
if (failed > 0) {
  process.exit(0)
}
