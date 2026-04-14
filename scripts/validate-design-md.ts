/**
 * Validate local DESIGN.md files against the 9-section format and basic completeness rules.
 *
 * Usage:
 *   npm run design:validate -- <pathOrUrlOrId>
 *
 * Examples:
 *   npm run design:validate -- https://getdesign.md/linear.app/design-md
 *   npm run design:validate -- design-md/linear.app/README.md
 *   npm run design:validate -- linear.app
 */
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { chromium } from 'playwright'

const DEFAULT_URL_PREFIX = 'https://getdesign.md/'

const SECTION_TITLES: Record<number, string> = {
  1: 'Visual Theme & Atmosphere',
  2: 'Color Palette & Roles',
  3: 'Typography Rules',
  4: 'Component Stylings',
  5: 'Layout Principles',
  6: 'Depth & Elevation',
  7: "Do's and Don'ts",
  8: 'Responsive Behavior',
  9: 'Agent Prompt Guide',
}

const CHECKS: Array<{
  section: number
  name: string
  require: (body: string) => string[]
}> = [
  {
    section: 1,
    name: 'Visual Theme & Atmosphere',
    require(body) {
      const notes = ['mood', 'density', 'principle']
      return notes.filter((key) => !new RegExp(key, 'i').test(body))
    },
  },
  {
    section: 2,
    name: 'Color Palette & Roles',
    require(body) {
      const keys = ['primary', 'text', 'surface']
      return keys.filter((k) => {
        const hasHex = /#[0-9a-fA-F]{3,8}/.test(body)
        return !hasHex || !new RegExp(k, 'i').test(body)
      })
    },
  },
  {
    section: 3,
    name: 'Typography Rules',
    require(body) {
      const rules = ['font', 'weight', 'size']
      return rules.filter((key) => !new RegExp(key, 'i').test(body))
    },
  },
  {
    section: 4,
    name: 'Component Stylings',
    require(body) {
      const keys = ['button', 'card']
      return keys.filter((key) => !new RegExp(key, 'i').test(body))
    },
  },
  {
    section: 5,
    name: 'Layout Principles',
    require(body) {
      const keys = ['spacing', 'grid']
      return keys.filter((key) => !new RegExp(key, 'i').test(body))
    },
  },
  {
    section: 6,
    name: 'Depth & Elevation',
    require(body) {
      const keys = ['shadow']
      return keys.filter((key) => !new RegExp(key, 'i').test(body))
    },
  },
  {
    section: 7,
    name: "Do's and Don'ts",
    require(body) {
      const keys = ["don't", 'avoid']
      return keys.filter((key) => !new RegExp(key, 'i').test(body))
    },
  },
  {
    section: 8,
    name: 'Responsive Behavior',
    require(body) {
      const keys = ['breakpoint', 'mobile']
      return keys.filter((key) => !new RegExp(key, 'i').test(body))
    },
  },
  {
    section: 9,
    name: 'Agent Prompt Guide',
    require(body) {
      const keys = ['prompt']
      return keys.filter((key) => !new RegExp(key, 'i').test(body))
    },
  },
]

function usage() {
  return [
    'Usage:',
    '  npm run design:validate -- <pathOrUrlOrId>',
    '',
    'Examples:',
    '  npm run design:validate -- https://getdesign.md/linear.app/design-md',
    '  npm run design:validate -- design-md/linear.app/README.md',
    '  npm run design:validate -- linear.app',
  ].join('\n')
}

function isRemoteInput(input: string): boolean {
  return /^https?:\/\//i.test(input)
}

function normalizeToUrl(input: string): string {
  if (isRemoteInput(input)) return input

  if (input.endsWith('.md')) {
    return `${DEFAULT_URL_PREFIX}${input.replace(/^design-md\//, '').replace('/README.md', '')}/design-md`
  }

  if (!input.includes('/') && !input.includes('.')) {
    return `${DEFAULT_URL_PREFIX}${input}/design-md`
  }

  return input
}

function normalizeToLocalPath(input: string): string | null {
  if (isRemoteInput(input)) {
    return null
  }

  if (input.endsWith('.md')) return input

  if (input.match(/^design-md\//)) {
    return `${input}`
  }

  return `design-md/${input}/README.md`
}

function parseSections(markdown: string) {
  const lines = markdown.split('\n')
  const sections = new Map<number, string>()
  let currentSection = 0
  let buffer: string[] = []

  for (const line of lines) {
    const sectionMatch = /^##\s+([0-9]+)\.\s+/.exec(line)
    if (sectionMatch) {
      if (currentSection > 0) {
        sections.set(currentSection, buffer.join('\n').trim())
      }
      currentSection = Number.parseInt(sectionMatch[1], 10)
      buffer = []
      continue
    }

    if (currentSection > 0) {
      buffer.push(line)
    }
  }

  if (currentSection > 0) {
    sections.set(currentSection, buffer.join('\n').trim())
  }

  return sections
}

async function fetchRemoteText(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    })

    const raw = await page.locator('pre,article,main,body').first().innerText()
    if (!raw) {
      throw new Error('No content extracted from remote source')
    }
    return raw
  } finally {
    await page.close()
    await browser.close()
  }
}

function validate(markdown: string, source: string) {
  const issues: string[] = []
  const warnings: string[] = []

  if (!/^#/.test(markdown.trim())) {
    warnings.push('File should start with a top-level title')
  }

  const sections = parseSections(markdown)

  for (const idx of Object.keys(SECTION_TITLES)) {
    const section = Number.parseInt(idx, 10)
    const body = sections.get(section)

    if (!body || !body.trim()) {
      issues.push(`Missing section ${section}: ${SECTION_TITLES[section]}`)
      continue
    }

    const check = CHECKS.find(item => item.section === section)
    if (!check) continue

    const missing = check.require(body)
    if (missing.length) {
      warnings.push(
        `Section ${section} (${check.name}) may be incomplete: missing expected signals ${missing.join(', ')}`,
      )
    }
  }

  const requiredSections = Array.from({ length: 9 }, (_, i) => i + 1)
  const missingSections = requiredSections.filter(section => !sections.has(section))

  return {
    source,
    issues,
    warnings,
    totalSections: sections.size,
    missingSections,
    sectionCoverage: `${sections.size}/9`,
  }
}

async function main() {
  const arg = process.argv.slice(2)[0]

  if (!arg) {
    console.error(usage())
    process.exit(1)
  }

  const remote = isRemoteInput(arg) || /^\w[\w.-]*$/.test(arg)

  let markdown = ''
  let source = arg

  if (arg.endsWith('.md') || arg.startsWith('design-md/')) {
    const localPath = normalizeToLocalPath(arg)
    if (!localPath) {
      throw new Error('Failed to resolve local path')
    }
    markdown = await readFile(localPath, 'utf8')
    source = localPath
  } else if (remote) {
    const url = normalizeToUrl(arg)
    source = url
    markdown = await fetchRemoteText(url)
  } else {
    throw new Error(`Unsupported input: ${arg}`)
  }

  const result = validate(markdown, source)

  if (result.issues.length) {
    console.error('design:validate failed')
    console.error(`source: ${result.source}`)
    console.error(`coverage: ${result.sectionCoverage}`)
    for (const item of result.issues) {
      console.error(`- issue: ${item}`)
    }

    if (result.warnings.length) {
      console.warn('warnings:')
      for (const item of result.warnings) {
        console.warn(`- ${item}`)
      }
    }

    process.exit(1)
  }

  if (result.warnings.length) {
    console.log(`design:validate passed with warnings (${result.sectionCoverage})`)
    for (const item of result.warnings) {
      console.warn(`- ${item}`)
    }
  } else {
    console.log(`design:validate passed (${result.sectionCoverage})`)
  }

  console.log(`source: ${result.source}`)
}

main().catch((error) => {
  console.error('design:validate failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
