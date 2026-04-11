export type Category =
  | 'ai-ml'
  | 'developer-tools'
  | 'infrastructure'
  | 'design-productivity'
  | 'fintech'
  | 'automotive'
  | 'enterprise'

export const CATEGORY_LABELS: Record<Category | 'all', string> = {
  all:                   'All',
  'ai-ml':               'AI & ML',
  'developer-tools':     'Developer Tools',
  'infrastructure':      'Infrastructure',
  'design-productivity': 'Design & Productivity',
  'fintech':             'Fintech',
  'automotive':          'Automotive',
  'enterprise':          'Enterprise',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as (Category | 'all')[]

export type ColorToken = {
  name: string   // e.g. "Ferrari Red"
  hex: string    // e.g. "#CC0000"
}

export type Brand = {
  id: string              // [a-z0-9.-] — matches public/screenshots/{id}.webp
  name: string
  category: Category
  tagline: string
  websiteUrl: string
  previewUrl: string      // HTML design system preview page
  rawMdUrl: string        // Raw text DESIGN.md URL (text/plain + CORS required)
  tokens: {
    colors: ColorToken[]  // 3–5 entries; [0] is primary accent
    fontFamily: string    // e.g. "Inter, sans-serif"
    borderRadius: string  // Tailwind class: "rounded-none" | "rounded-sm" | "rounded-md" | "rounded-full"
    buttonStyle: string   // Human-readable: "square uppercase" | "rounded soft"
  }
}
