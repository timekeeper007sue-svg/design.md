import type { ExtractedTokens } from './extractor'

export function generateDesignMd(url: string, tokens: ExtractedTokens): string {
  const domain = new URL(url).hostname
  const primary = tokens.colors[0]?.hex ?? '#10b981'
  const surface = tokens.colors.find(c => isDark(c.hex))?.hex ?? '#0F0F13'
  const textColor = tokens.colors.find(c => isLight(c.hex))?.hex ?? '#FFFFFF'
  const fonts = tokens.fontFamily.length ? tokens.fontFamily : ['system-ui']
  const mainFont = fonts[0]

  const topColors = tokens.colors.slice(0, 8)
  const topSizes = tokens.fontSize.slice(0, 5)
  const topWeights = tokens.fontWeight.slice(0, 4)
  const topRadius = tokens.borderRadius.slice(0, 4)
  const topSpacing = tokens.spacing.slice(0, 6)

  return `# ${domain} — DESIGN.md

> Visual design system extracted from ${url}

## 1. Visual Theme & Atmosphere

${describeAtmosphere(tokens)}

## 2. Color Palette & Roles

| Role     | Value     | Usage              |
|----------|-----------|--------------------|
${topColors.map((c, i) => `| ${i === 0 ? 'Primary' : i === 1 ? 'Surface' : i === 2 ? 'Text' : `Accent ${i - 2}`}  | ${c.hex}   | ${c.sources.join(', ')} |`).join('\n')}

## 3. Typography Rules

**Font Stack:** ${fonts.join(', ')}

| Level | Size | Weight |
|-------|------|--------|
${topSizes.map((s, i) => {
    const level = i === 0 ? 'H1' : i === 1 ? 'H2' : i === 2 ? 'Body' : i === 3 ? 'Small' : 'Caption'
    return `| ${level}    | ${s.value} | ${topWeights[Math.min(i, topWeights.length - 1)]?.value ?? '400'}  |`
  }).join('\n')}

## 4. Component Stylings

**Button (Primary):**
- Background: ${primary}
- Text: ${isLight(primary) ? '#000000' : '#FFFFFF'}
- Border-radius: ${topRadius[0]?.value ?? '6px'}
- Padding: 8px 16px

**Button (Ghost):**
- Background: transparent
- Text: ${textColor}
- Border: 1px solid #333
- Border-radius: ${topRadius[0]?.value ?? '6px'}

**Card:**
- Background: ${surface}
- Border: 1px solid #1E1E1E
- Border-radius: ${topRadius[0]?.value ?? '8px'}
- Shadow: ${tokens.shadows[0] ?? 'none'}

## 5. Layout Principles

- Spacing scale: ${topSpacing.map(s => s.value).join(', ')}
- Border-radius scale: ${topRadius.map(r => r.value).join(', ')}
- Layout: Responsive, content-max-width 1200px

## 6. Depth & Elevation

${tokens.shadows.length
    ? tokens.shadows.map((s, i) => `- Level ${i}: \`${s}\``).join('\n')
    : '- No shadows detected'}

## 7. Do's and Don'ts

**Do:**
- Use ${primary} as the primary accent color
- Maintain consistent spacing using the extracted scale
- Use ${mainFont} for all text elements
- Keep ${surface} as the base surface color

**Don't:**
- Don't introduce new colors outside the extracted palette
- Don't mix different border-radius values beyond the defined scale
- Don't use inline styles when design tokens are available
- Don't override the font stack with system fonts

## 8. Responsive Behavior

- Primary breakpoint: 768px (tablet), 1024px (desktop)
- Mobile-first approach
- Content area: max-width 1200px, centered
- Touch targets: minimum 44×44px

## 9. Agent Prompt Guide

\`\`\`
"Build a page using ${domain} style: ${surface} surfaces, ${primary} accent, ${mainFont} font, ${describeDensity(tokens)} feel."
\`\`\`

**Quick Reference:**
- Primary: ${primary}
- Surface: ${surface}
- Text: ${textColor}
- Font: ${mainFont}
- Radius: ${topRadius[0]?.value ?? '6px'}
- Shadow: ${tokens.shadows[0] ?? 'none'}
`
}

function describeAtmosphere(tokens: ExtractedTokens): string {
  const hasDarkBg = tokens.colors.some(c => isDark(c.hex))
  const colorCount = tokens.colors.length
  const vibe = hasDarkBg ? 'Dark' : 'Light'

  let density = 'moderate'
  if (tokens.fontSize.length > 4) density = 'rich'
  if (tokens.fontSize.length <= 2) density = 'compact'

  return `${vibe} theme with ${density} visual density. ${colorCount} distinct colors extracted. Primary accent: ${tokens.colors[0]?.hex ?? 'N/A'}. Clean, modern aesthetic with consistent spacing and typography hierarchy.`
}

function describeDensity(tokens: ExtractedTokens): string {
  if (tokens.fontSize.length > 4) return 'information-rich'
  if (tokens.spacing.length > 4) return 'spacious'
  return 'compact'
}

function isLight(hex: string): boolean {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

function isDark(hex: string): boolean {
  return !isLight(hex)
}
