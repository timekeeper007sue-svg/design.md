/**
 * Brand data validation script.
 *
 * NOTE: The design-md/*.README.md files are redirect stubs only.
 * Token data in src/data/brands.ts is manually curated.
 * Run this script to validate the brands array is well-formed.
 *
 * Run: npm run gen:brands
 */
import { brands, brandCount } from '../src/data/brands.ts'

console.log(`brands.ts: ${brandCount} brands`)

let errors = 0
for (const brand of brands) {
  if (!brand.id.match(/^[a-z0-9.\-]+$/)) {
    console.error(`  ERROR: ${brand.id} — id contains invalid characters`)
    errors++
  }
  if (!brand.tokens.colors.length || brand.tokens.colors.length > 5) {
    console.error(`  ERROR: ${brand.id} — expected 1-5 colors, got ${brand.tokens.colors.length}`)
    errors++
  }
  for (const c of brand.tokens.colors) {
    if (!c.hex.match(/^#[0-9A-F]{6}$/i)) {
      console.error(`  ERROR: ${brand.id} — invalid hex "${c.hex}" for "${c.name}"`)
      errors++
    }
  }
  const validRadius = ['rounded-none', 'rounded-sm', 'rounded-md', 'rounded-full']
  if (!validRadius.includes(brand.tokens.borderRadius)) {
    console.error(`  ERROR: ${brand.id} — invalid borderRadius "${brand.tokens.borderRadius}"`)
    errors++
  }
}

if (errors === 0) {
  console.log('All brands valid ✓')
} else {
  console.error(`${errors} validation error(s)`)
  process.exit(1)
}
