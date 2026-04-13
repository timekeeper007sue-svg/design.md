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

const limit = Number.parseInt(process.env.SCREENSHOT_LIMIT || '', 10)
const only = process.env.SCREENSHOT_ONLY ? process.env.SCREENSHOT_ONLY.split(',').map(s => s.trim()) : null

let targetBrands = Number.isNaN(limit) || limit <= 0 ? brands : brands.slice(0, limit)
if (only) {
  targetBrands = brands.filter(b => only.includes(b.id))
}

// Use headed mode for sites with aggressive anti-bot
const HEADED_IDS = new Set(['ferrari', 'lamborghini'])
const useHeaded = targetBrands.some(b => HEADED_IDS.has(b.id))

const browser = await chromium.launch({
  headless: !useHeaded,
  executablePath: CHROME_PATH,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
  ],
})
const context = await browser.newContext({
  viewport: VIEWPORT,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
})

// Stealth: remove webdriver flag
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  // Override plugins to look like a real browser
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
})

// Override URLs for sites that block headless browsers
const URL_OVERRIDES: Record<string, string> = {
  'linear.app': 'https://linear.app/method',
  'pinterest': 'https://newsroom.pinterest.com',
  'lamborghini': 'https://www.lamborghini.com/en-en',
  'ferrari': 'https://www.ferrari.com/en-EN',
}

for (const brand of targetBrands) {
  const outPath = join(OUTPUT_DIR, `${brand.id}.webp`)
  const url = URL_OVERRIDES[brand.id] ?? brand.websiteUrl

  try {
    const page = await context.newPage()
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS,
    })

    // Wait for network to settle, then extra render time
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }) } catch {}
    await page.waitForTimeout(3000)

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
