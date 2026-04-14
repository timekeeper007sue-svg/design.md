import * as cheerio from 'cheerio'
import * as csstree from 'css-tree'

export interface ExtractedTokens {
  colors: { hex: string; count: number; sources: string[] }[]
  fontFamily: string[]
  fontSize: { value: string; count: number }[]
  fontWeight: { value: string; count: number }[]
  borderRadius: { value: string; count: number }[]
  spacing: { value: string; count: number }[]
  shadows: string[]
}

export async function extractTokens(url: string): Promise<ExtractedTokens> {
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  // Extract inline styles + <style> blocks
  const allCss = gatherCss($)

  // Parse CSS
  const ast = csstree.parse(allCss, { parseValue: false })

  const colorMap = new Map<string, { count: number; sources: Set<string> }>()
  const fontSizeMap = new Map<string, number>()
  const fontWeightMap = new Map<string, number>()
  const radiusMap = new Map<string, number>()
  const spacingMap = new Map<string, number>()
  const shadows: Set<string> = new Set()

  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node) {
      if (node.property && node.value) {
        const prop = node.property.toLowerCase()
        const val = csstree.generate(node.value)

        if (isColorProp(prop)) {
          const hexColors = extractHexColors(val)
          const rgbColors = extractRgbColors(val)
          const hslColors = extractHslColors(val)
          const allColors = [...hexColors, ...rgbColors, ...hslColors]
          for (const c of allColors) {
            const existing = colorMap.get(c)
            if (existing) {
              existing.count++
              existing.sources.add(prop)
            } else {
              colorMap.set(c, { count: 1, sources: new Set([prop]) })
            }
          }
        }

        if (prop === 'font-size') {
          const v = normalizeValue(val)
          fontSizeMap.set(v, (fontSizeMap.get(v) || 0) + 1)
        }

        if (prop === 'font-weight') {
          fontWeightMap.set(val.trim(), (fontWeightMap.get(val.trim()) || 0) + 1)
        }

        if (prop === 'border-radius') {
          const v = normalizeValue(val)
          radiusMap.set(v, (radiusMap.get(v) || 0) + 1)
        }

        if (prop === 'box-shadow' || prop === 'text-shadow') {
          if (val.trim()) shadows.add(val.trim())
        }

        if (prop === 'gap' || prop === 'margin' || prop === 'padding') {
          const v = normalizeValue(val)
          spacingMap.set(v, (spacingMap.get(v) || 0) + 1)
        }
      }
    },
  })

  // Also extract font-family from inline styles and <style>
  const fontFamilySet = new Set<string>()
  $('*').each((_, el) => {
    const style = $(el).attr('style') || ''
    const m = style.match(/font-family\s*:\s*([^;]+)/i)
    if (m) fontFamilySet.add(m[1].trim().replace(/['"]/g, ''))
  })
  const ffMatch = allCss.match(/font-family\s*:\s*([^;}{]+)/gi) || []
  for (const f of ffMatch) {
    const cleaned = f.replace(/font-family\s*:\s*/i, '').trim()
    cleaned.split(',').forEach(s => fontFamilySet.add(s.trim().replace(/['"]/g, '')))
  }

  return {
    colors: [...colorMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 12)
      .map(([hex, { count, sources }]) => ({
        hex,
        count,
        sources: [...sources],
      })),
    fontFamily: [...fontFamilySet].slice(0, 5),
    fontSize: sortAndSlice(fontSizeMap, 8).map(([value, count]) => ({ value, count })),
    fontWeight: sortAndSlice(fontWeightMap, 6).map(([value, count]) => ({ value, count })),
    borderRadius: sortAndSlice(radiusMap, 6).map(([value, count]) => ({ value, count })),
    spacing: sortAndSlice(spacingMap, 8).map(([value, count]) => ({ value, count })),
    shadows: [...shadows].slice(0, 6),
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

function gatherCss($: cheerio.CheerioAPI): string {
  const chunks: string[] = []

  // <style> blocks
  $('style').each((_, el) => {
    chunks.push($(el).html() || '')
  })

  // Inline styles
  $('[style]').each((_, el) => {
    chunks.push(`selector { ${$(el).attr('style')} }`)
  })

  return chunks.join('\n')
}

const COLOR_PROPS = new Set([
  'color', 'background-color', 'background', 'border-color', 'border',
  'outline-color', 'text-decoration-color', 'fill', 'stroke',
  'box-shadow', 'text-shadow', 'caret-color', 'column-rule-color',
])

function isColorProp(prop: string): boolean {
  return COLOR_PROPS.has(prop) || prop.endsWith('-color')
}

function extractHexColors(val: string): string[] {
  const matches = val.matchAll(/#([0-9a-fA-F]{3,8})\b/g)
  return [...matches].map(m => {
    const raw = m[1]
    // Normalize to 6-char hex
    if (raw.length === 3) {
      return '#' + raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2]
    }
    return '#' + raw.toUpperCase()
  })
}

function extractRgbColors(val: string): string[] {
  const matches = val.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi)
  return [...matches].map(m => {
    const r = parseInt(m[1]).toString(16).padStart(2, '0')
    const g = parseInt(m[2]).toString(16).padStart(2, '0')
    const b = parseInt(m[3]).toString(16).padStart(2, '0')
    return ('#' + r + g + b).toUpperCase()
  })
}

function extractHslColors(val: string): string[] {
  const matches = val.matchAll(/hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%/gi)
  return [...matches].map(m => {
    const h = parseInt(m[1]) / 360
    const s = parseInt(m[2]) / 100
    const l = parseInt(m[3]) / 100
    const [r, g, b] = hslToRgb(h, s, l)
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
  })
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function normalizeValue(val: string): string {
  return val.trim().replace(/\s+/g, ' ')
}

function sortAndSlice<T>(map: Map<T, { count: number } | number>, limit: number): [T, any][] {
  return [...map.entries()]
    .map(([k, v]) => [k, typeof v === 'number' ? v : v.count] as [T, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}
