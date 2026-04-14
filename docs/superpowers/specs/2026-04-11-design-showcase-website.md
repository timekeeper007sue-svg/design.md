# Design Spec: Awesome DESIGN.md Showcase Website

**Date**: 2026-04-11  
**Status**: Approved  
**Repo**: VoltAgent/awesome-design-md

---

## Overview

Build a documentation and showcase website for the awesome-design-md project. The site explains what DESIGN.md is, how to use it, and displays all 59 supported brand design systems as a browsable, searchable gallery.

---

## Goals

- Let developers quickly find and copy a DESIGN.md that matches their desired visual style
- Show each brand's design system through its actual website screenshot + extracted design tokens
- Provide clear usage instructions for new users

---

## Non-Goals

- Hosting or managing the DESIGN.md file content (that lives at getdesign.md)
- Auto-updating DESIGN.md content (community-maintained, manual PR process)
- Server-side rendering or user accounts

---

## Architecture

**Framework**: Astro 4 + TypeScript  
**Styling**: Tailwind CSS  
**Deployment**: Vercel (static output — `output: 'static'`)  
**Screenshots**: Playwright (one-time generation + monthly CI refresh)

---

## File Structure

```
0_awesome-design-md/
├── src/
│   ├── data/
│   │   └── brands.ts              # Structured data for all 59 brands
│   ├── pages/
│   │   └── index.astro            # Single page — all content rendered here
│   └── components/
│       ├── Hero.astro             # Hero section + 3-step usage guide
│       ├── Gallery.astro          # Gallery container with filter + search logic
│       ├── BrandCard.astro        # Individual brand card (screenshot + info)
│       └── BrandModal.astro       # Modal: screenshot + tokens + copy button
├── public/
│   └── screenshots/               # Brand website screenshots (committed to repo)
│       ├── claude.webp
│       ├── linear.webp
│       └── ...
├── scripts/
│   ├── capture-screenshots.ts     # Playwright script: screenshot all brands
│   └── diff-screenshots.ts        # Perceptual diff using sharp + pixelmatch
└── .github/
    └── workflows/
        └── update-screenshots.yml # Monthly CI: diff + update + create Issue
```

---

## Data Model

```ts
type Category =
  | 'ai-ml'
  | 'developer-tools'
  | 'infrastructure'
  | 'design-productivity'
  | 'fintech'
  | 'automotive'
  | 'enterprise'

// Tab display labels (must stay in sync with Category values above)
const CATEGORY_LABELS: Record<Category | 'all', string> = {
  all:                  'All (59)',
  'ai-ml':              'AI & ML',
  'developer-tools':    'Developer Tools',
  'infrastructure':     'Infrastructure',
  'design-productivity':'Design & Productivity',
  'fintech':            'Fintech',
  'automotive':         'Automotive',
  'enterprise':         'Enterprise',
}

type Brand = {
  id: string              // e.g. "ferrari" — matches public/screenshots/{id}.webp
                          // Constrained to pattern [a-z0-9.-] (matches repo directory names)
  name: string            // e.g. "Ferrari"
  category: Category
  tagline: string         // e.g. "Chiaroscuro black-white editorial, Ferrari Red"
  websiteUrl: string      // e.g. "https://www.ferrari.com"
  previewUrl: string      // HTML preview page, e.g. "https://getdesign.md/ferrari/design-md"
                          // Used for the "查看 preview →" link in the modal footer
  rawMdUrl: string        // Raw text URL of the DESIGN.md file, e.g.
                          // "https://getdesign.md/ferrari/design-md/raw"
                          // Must return Content-Type: text/plain and allow CORS
                          // Used by the copy button fetch
  tokens: {
    colors: { name: string; hex: string }[]  // 3–5 colors per brand; colors[0] is
                                              // the primary accent (used for card dot
                                              // and modal brand icon background)
    fontFamily: string    // e.g. "Ferrari Type / sans-serif"
    borderRadius: string  // Tailwind class name: "rounded-none", "rounded-md", "rounded-full"
    buttonStyle: string   // Human-readable description: "square uppercase", "rounded soft"
  }
}
```

### Populating `brands.ts`

All 59 entries are hand-authored based on:
- Brand names, categories, and taglines from the repo's `README.md` collection section
- Color tokens from each brand's DESIGN.md (available at `getdesign.md/{id}/design-md`)
- Font and button style extracted from the same DESIGN.md

This is a one-time authoring task. When a new brand is added to the repo, a corresponding entry is added to `brands.ts` manually.

---

## Page Structure

### 1. Navigation

- Logo ("Awesome DESIGN.md") + green badge showing brand count (hard-coded from `brands.ts` length)
- Links: "Gallery" (anchor `#gallery`), GitHub (repo URL), "Contributing" (repo `/CONTRIBUTING.md`)
- Sticky on scroll (CSS `position: sticky`, no JS needed)

### 2. Hero Section

- Headline: "让 AI 生成像素级精准的 UI"
- Sub-headline: one sentence explaining DESIGN.md concept
- CTAs: "Browse Gallery →" (scrolls to `#gallery`), "What is DESIGN.md?" (scrolls to how-to strip), "⭐ GitHub" (opens repo)
- Subtle green radial gradient background glow (CSS only)

### 3. How-to Strip

Three steps in a horizontal band below the hero:
1. **Pick a style** — browse 59 brand design systems
2. **Copy DESIGN.md** — one click, drops into project root
3. **Tell your AI agent** — "build a page that looks like this"

### 4. Brand Gallery

**Controls row**:
- Category tabs (one per `CATEGORY_LABELS` entry, in order shown above)
- Keyword search input (`input` event, no debounce needed at 59 items) — filters by `name` and `tagline` substring, case-insensitive
- Both filters compose: selected category AND search query both apply simultaneously
- Live result count badge (e.g., "12 styles")
- No URL hash updates — this is a shallow browse, not deep-link content

**Card grid**: 6 columns at ≥1280px, 5 at ≥1024px, 3 at ≥768px, 2 below 768px.

**Brand card anatomy**:
- Screenshot area: 16:9 aspect ratio container, `object-fit: cover; object-position: top center` CSS — screenshot files are saved at full 1280×720, cropping is done purely in CSS
- Hover: translucent overlay with "查看设计系统 →" button (CSS transition)
- Below screenshot: brand name (11px semibold), tagline (9px, 1 line truncated), category badge, accent color dot (`tokens.colors[0].hex`)
- Active state (modal open for this card): green border + glow

### 5. Footer

- "Awesome DESIGN.md · MIT License"
- Links: GitHub, Contributing (`/CONTRIBUTING.md`), "Request a style" (`https://getdesign.md/request`)
- Community note: "DESIGN.md files are community-maintained. Spotted an outdated one? [Open an issue](repo issues URL)"

---

## Brand Modal

Triggered by clicking any brand card. Implemented with native `<dialog>` element.

**Close triggers**: Esc key (native `<dialog>` behavior), click on `::backdrop`, × button.

### Modal layout

**Header**:
- Brand icon: colored square (background = `tokens.colors[0].hex`, letter = `name[0]`), no external image or logo asset required
- Brand name (16px bold) + tagline (11px muted)
- Category badge
- × close button

**Body (2-column)**:

Left column — **Website screenshot**:
- `<img>` tag loading `public/screenshots/{id}.webp`, same CSS crop as card but larger (full column width)
- `loading="lazy"` attribute
- Skeleton placeholder shown via CSS (`background: #1a1a1a`) until image loads — prevents layout shift
- Caption: "Screenshot of [websiteUrl hostname] · Updated monthly"

Right column — **Design tokens**:
- **Colors**: `tokens.colors` array rendered as swatches (28×28px squares) + hex labels below
- **Typography**: `tokens.fontFamily` label + three text samples (H1 bold uppercase, body regular, label small uppercase) rendered with `font-family: tokens.fontFamily, sans-serif`
- **Component style**: two `<button>` elements styled with inline CSS from `tokens.borderRadius` and `tokens.buttonStyle` description as a plain text label below

**Footer**:
- "查看 preview →" — links to `brand.previewUrl`, opens new tab (HTML design system preview page)
- "复制 DESIGN.md" primary CTA — see Copy Flow below

### Copy Flow

1. User clicks "复制 DESIGN.md"
2. `fetch(brand.rawMdUrl)` — expects `text/plain` response
3. **Success**: `navigator.clipboard.writeText(text)` → show "已复制! ✓" toast (green, bottom-center, auto-dismiss after 2.5s)
4. **Fetch error** (network, 404, CORS block): show "复制失败，请手动访问链接" toast (red, same position/duration) + change button to open `brand.rawMdUrl` in new tab as fallback
5. **Clipboard permission denied**: same fallback as fetch error

---

## Filter + Search

Implemented as a single client-side JS `<script>` island inside `Gallery.astro`. No framework needed — plain DOM manipulation.

All 59 brand objects are serialized into the page as a JSON array (Astro `define:vars`). On tab click or search input, filter the in-memory array and toggle `hidden` attribute on card elements. This avoids any server round-trips.

---

## Screenshot System

### Initial generation

```bash
npm run screenshots   # runs scripts/capture-screenshots.ts via tsx
```

Playwright visits each brand's `websiteUrl` in headless Chromium, sets viewport to 1280×720, waits for `networkidle`, takes a full-viewport screenshot, saves as **WebP at 80% quality** to `public/screenshots/{id}.webp`. Target file size: ≤200 KB per screenshot. Images are committed to the repo.

**Error handling**: if a page fails to load (network error, timeout after 15s, HTTP ≥400), the script logs `WARN: failed to screenshot {id} — {error}`, skips that brand, and continues. At the end it prints a summary: `N succeeded, M failed`. Failed brands retain their previous screenshot (or no screenshot if first run, in which case the card shows a grey placeholder).

### Monthly CI

`.github/workflows/update-screenshots.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 1 * *'   # 1st of each month at 02:00 UTC
  workflow_dispatch:        # allow manual trigger

permissions:
  contents: write    # needed to commit updated screenshots
  issues: write      # needed to create the change-report issue

jobs:
  update-screenshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install chromium --with-deps
      - name: Stash previous screenshots for diffing
        run: cp -r public/screenshots public/screenshots-prev
      - run: npm run screenshots          # overwrites public/screenshots/*.webp
      - name: Perceptual diff
        id: diff
        run: |
          # scripts/diff-screenshots.ts: for each brand, load prev + new WebP via sharp,
          # compare RGBA buffers with pixelmatch (threshold: 0.1 per-pixel noise tolerance).
          # Flag brand as changed only if differing pixels > 5% of total pixels.
          # Outputs changed brand IDs as JSON array to stdout.
          CHANGED_JSON=$(npx tsx scripts/diff-screenshots.ts)
          echo "changed_json=$CHANGED_JSON" >> $GITHUB_OUTPUT
          # Also produce comma-separated string for commit message
          CHANGED=$(echo "$CHANGED_JSON" | npx tsx -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).join(','))")
          echo "changed=$CHANGED" >> $GITHUB_OUTPUT
      - name: Cleanup stash
        run: rm -rf public/screenshots-prev
      - name: Commit updated screenshots
        if: steps.diff.outputs.changed != ''
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/screenshots/
          git commit -m "chore: update screenshots (monthly) — ${{ steps.diff.outputs.changed }}"
          git push
      - name: Create change-report issue
        if: steps.diff.outputs.changed != ''
        uses: actions/github-script@v7
        with:
          script: |
            const changed = JSON.parse('${{ steps.diff.outputs.changed_json }}')
            const lines = changed.map(id => `- \`${id}\` — visual change detected (>5% pixels differ)`)
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `📸 Monthly screenshot update — ${changed.length} brand(s) changed`,
              body: [
                '## Brands with visual changes',
                '',
                ...lines,
                '',
                'These brands may have redesigned their websites.',
                'Please check if their `DESIGN.md` needs updating and open a PR if so.',
              ].join('\n'),
              labels: ['screenshot-update'],
            })
```

**Failure handling**: if `npm run screenshots` exits non-zero (all brands failed), the workflow fails and no commit or issue is created. Individual brand failures are logged but do not fail the workflow (see script error handling above).

---

## Responsiveness

| Breakpoint | Card columns | Modal |
|------------|-------------|-------|
| ≥1280px    | 6           | centered dialog, max-width 720px |
| ≥1024px    | 5           | same |
| ≥768px     | 3           | full-width dialog with 16px horizontal padding |
| <768px     | 2           | full-screen bottom sheet (`height: 95dvh`, slides up) |

---

## Performance

- 59 WebP screenshots at ≤200 KB each — total ≤11.8 MB in `public/`
- Modal token data comes from in-page JSON (brands serialized by Astro) — zero network requests on open
- Screenshot image uses `loading="lazy"` — only fetched when modal opens
- Only network call: "复制 DESIGN.md" fetch on button click
- JS islands: Gallery filter+search + modal open/close. Navigation is CSS-only (sticky).

---

## Out of Scope

- Dark/light theme toggle
- Individual brand detail pages (all content in modal)
- DESIGN.md content editing or preview rendering
- i18n (UI in Chinese, brand content in English)
- URL hash deep-linking to specific brands or filter states

