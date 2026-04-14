/**
 * Extract reusable design tokens from a public website.
 *
 * Usage:
 *   npx tsx scripts/extract-design-tokens.ts <url> [options]
 *
 * Example:
 *   npm run extract:tokens -- https://example.com --out /tmp/tokens.json
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const DEFAULTS = {
  timeoutMs: 45_000,
  waitForNetworkIdleMs: 8_000,
  extraRenderMs: 2_000,
  viewport: { width: 1280, height: 720 },
  colorLimit: 24,
  spacingLimit: 24,
} as const

type ExtractOptions = {
  url: string
  output?: string
  timeoutMs: number
  waitForNetworkIdleMs: number
  extraRenderMs: number
  viewport: { width: number; height: number }
  colorLimit: number
  spacingLimit: number
}

type ColorStat = {
  hex: string
  count: number
  sources: string[]
}

type TypographyToken = {
  tag: string
  sample: string
  family: string
  size: string
  weight: string
  lineHeight: string
  letterSpacing: string
}

type ExtractedPayload = {
  title: string
  colors: ColorStat[]
  typography: TypographyToken[]
  spacing: string[]
  shadows: string[]
  borderRadius: string[]
  gapValues: string[]
}

function usage(): string {
  return [
    'Usage:',
    '  npx tsx scripts/extract-design-tokens.ts <url> [options]',
    '',
    'Options:',
    '  --help                    Show this help message',
    '  --out <file>              Write result JSON to file',
    '  --viewport WIDTHxHEIGHT    Capture viewport, default 1280x720',
    '  --timeout <ms>',
    '  --network <ms>',
    '  --render <ms>',
    '  --colors <n>',
    '  --spacing <n>',
  ].join('\n')
}

function ensurePositiveInt(name: string, value: string | undefined): number {
  if (!value) {
    throw new Error(`Missing value for --${name}`)
  }

  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n <= 0 || Number.isNaN(n)) {
    throw new Error(`Invalid ${name}: ${value}`)
  }

  return n
}

function parseArgs(argv: string[]): ExtractOptions {
  if (argv.length === 0 || argv.includes('--help')) {
    console.error(usage())
    process.exit(argv.includes('--help') ? 0 : 1)
  }

  const parsed: ExtractOptions = {
    url: argv[0],
    output: undefined,
    timeoutMs: DEFAULTS.timeoutMs,
    waitForNetworkIdleMs: DEFAULTS.waitForNetworkIdleMs,
    extraRenderMs: DEFAULTS.extraRenderMs,
    viewport: { ...DEFAULTS.viewport },
    colorLimit: DEFAULTS.colorLimit,
    spacingLimit: DEFAULTS.spacingLimit,
  }

  for (let i = 1; i < argv.length; i += 1) {
    const flag = argv[i]
    if (!flag.startsWith('--')) continue

    switch (flag) {
      case '--out':
        parsed.output = argv[++i]
        break
      case '--viewport': {
        const raw = argv[++i]
        if (!raw || !raw.includes('x')) {
          throw new Error(`Invalid --viewport value: ${raw}`)
        }
        const [wRaw, hRaw] = raw.split('x')
        parsed.viewport = {
          width: ensurePositiveInt('viewport width', wRaw),
          height: ensurePositiveInt('viewport height', hRaw),
        }
        break
      }
      case '--timeout':
        parsed.timeoutMs = ensurePositiveInt('timeout', argv[++i])
        break
      case '--network':
        parsed.waitForNetworkIdleMs = ensurePositiveInt('network', argv[++i])
        break
      case '--render':
        parsed.extraRenderMs = ensurePositiveInt('render', argv[++i])
        break
      case '--colors':
        parsed.colorLimit = ensurePositiveInt('colors', argv[++i])
        break
      case '--spacing':
        parsed.spacingLimit = ensurePositiveInt('spacing', argv[++i])
        break
      default:
        throw new Error(`Unknown option: ${flag}`)
    }
  }

  return parsed
}

const extractScript = `(() => {
  function toHex(value) {
    if (!value || value === 'transparent' || value === 'none' || value === 'rgba(0, 0, 0, 0)' || value === 'rgba(0,0,0,0)') {
      return null
    }

    var v = value.trim()
    if (v[0] === '#') {
      if (/^#[0-9a-fA-F]{3}$/.test(v)) {
        return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toUpperCase()
      }
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        return v.toUpperCase()
      }
      return null
    }

    var rgbMatch = /^rgba?\(([^)]+)\)$/.exec(v)
    if (!rgbMatch) return null

    var parts = rgbMatch[1].split(',').map(function (p) { return p.trim() })
    if (parts.length < 3) return null

    var r = parseInt(parts[0], 10)
    var g = parseInt(parts[1], 10)
    var b = parseInt(parts[2], 10)
    var a = parts.length > 3 ? parseFloat(parts[3]) : 1
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) || Number.isNaN(a) || a === 0) {
      return null
    }

    function toByte(n) {
      return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
    }

    return ('#' + toByte(r) + toByte(g) + toByte(b)).toUpperCase()
  }

  function addSetValues(value, target) {
    if (!value) return
    var values = value.split(',').map(function (v) { return v.trim() })
    for (var i = 0; i < values.length; i += 1) {
      if (values[i]) target.add(values[i])
    }
  }

  function addColor(colorMap, color, source) {
    if (!color) return
    var item = colorMap.get(color)
    if (!item) {
      item = { count: 0, sources: [] }
      colorMap.set(color, item)
    }
    item.count += 1
    if (item.sources.indexOf(source) === -1) item.sources.push(source)
  }

  function isRelevantTag(tagName) {
    return /^(H[1-6]|P|A|BUTTON|SPAN|LI|LABEL|INPUT|TEXTAREA|DIV|SECTION|ARTICLE|HEADER|FOOTER|TD|TH|CAPTION)$/i.test(tagName)
  }

  var colorMap = new Map()
  var spacingSet = new Set()
  var shadowSet = new Set()
  var radiusSet = new Set()
  var gapSet = new Set()
  var typographySet = new Map()

  var nodes = Array.from(document.querySelectorAll('*'))

  for (var i = 0; i < nodes.length; i += 1) {
    var node = nodes[i]
    var cs = getComputedStyle(node)
    var rect = node.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue

    addColor(colorMap, toHex(cs.backgroundColor), 'background')
    addColor(colorMap, toHex(cs.color), 'text')
    addColor(colorMap, toHex(cs.borderColor), 'border')

    if (cs.boxShadow && cs.boxShadow !== 'none') {
      shadowSet.add(cs.boxShadow)
    }

    addSetValues(cs.borderRadius, radiusSet)
    addSetValues(cs.gap, gapSet)

    addSetValues(cs.paddingTop, spacingSet)
    addSetValues(cs.paddingRight, spacingSet)
    addSetValues(cs.paddingBottom, spacingSet)
    addSetValues(cs.paddingLeft, spacingSet)
    addSetValues(cs.marginTop, spacingSet)
    addSetValues(cs.marginRight, spacingSet)
    addSetValues(cs.marginBottom, spacingSet)
    addSetValues(cs.marginLeft, spacingSet)
    addSetValues(cs.columnGap, spacingSet)
    addSetValues(cs.rowGap, spacingSet)

    var text = node.textContent && node.textContent.trim()
    if (!text) continue

    var key = [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.lineHeight, cs.letterSpacing].join('|')
    if (!typographySet.has(key) && isRelevantTag(node.tagName)) {
      typographySet.set(key, {
        tag: node.tagName,
        sample: text.slice(0, 40),
        family: cs.fontFamily,
        size: cs.fontSize,
        weight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
      })
    }
  }

  var colors = Array.from(colorMap.entries()).map(function (entry) {
    return {
      hex: entry[0],
      count: entry[1].count,
      sources: entry[1].sources,
    }
  })

  return {
    title: document.title,
    colors: colors,
    typography: Array.from(typographySet.values()),
    spacing: Array.from(spacingSet),
    shadows: Array.from(shadowSet),
    borderRadius: Array.from(radiusSet),
    gapValues: Array.from(gapSet),
  }
})()`

async function main() {
  const options = parseArgs(process.argv.slice(2))

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  })

  const context = await browser.newContext({
    viewport: options.viewport,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
  })

  const page = await context.newPage()

  try {
    await page.goto(options.url, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs,
    })

    try {
      await page.waitForLoadState('networkidle', { timeout: options.waitForNetworkIdleMs })
    } catch {
      // ignore: some pages keep background requests alive
    }

    if (options.extraRenderMs > 0) {
      await page.waitForTimeout(options.extraRenderMs)
    }

    const extracted = await page.evaluate<ExtractedPayload>(extractScript)

    const colors = extracted.colors
      .sort((a, b) => b.count - a.count)
      .slice(0, options.colorLimit)

    const spacing = Array.from(new Set(extracted.spacing))
      .filter((value) => /^\d+(\.\d+)?(px|rem|em)$/.test(value) || value.endsWith('px'))
      .filter((value) => value !== '0px' && value !== '0')
      .sort((a, b) => Number.parseFloat(b) - Number.parseFloat(a))
      .slice(0, options.spacingLimit)

    const result = {
      url: options.url,
      pageTitle: extracted.title,
      viewport: options.viewport,
      colors,
      typography: extracted.typography,
      spacing,
      shadows: extracted.shadows.filter((v) => v && v !== 'none').slice(0, 20),
      borderRadius: Array.from(new Set(extracted.borderRadius)).filter(Boolean).slice(0, 10),
      gapValues: Array.from(new Set(extracted.gapValues)).filter((v) => v && v !== 'normal').slice(0, 10),
    }

    const output = JSON.stringify(result, null, 2)
    if (options.output) {
      writeFileSync(options.output, output)
      console.log(`Wrote token snapshot: ${options.output}`)
    } else {
      console.log(output)
    }
  } finally {
    await page.close()
    await context.close()
    await browser.close()
  }
}

main().catch((error) => {
  console.error('Failed to extract tokens:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
