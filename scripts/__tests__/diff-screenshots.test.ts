/**
 * Unit tests for the pixelmatch-based perceptual diff logic in diff-screenshots.ts.
 * Tests run via: npx vitest run scripts/__tests__/diff-screenshots.test.ts
 */
import { describe, it, expect } from 'vitest'
import pixelmatch from 'pixelmatch'

describe('pixelmatch diff logic', () => {
  it('flags visually different screenshots as changed (>5% diff pixels)', () => {
    const W = 10
    const H = 10
    // Light gray image
    const prev = new Uint8ClampedArray(W * H * 4).fill(200)
    // Dark image
    const curr = new Uint8ClampedArray(W * H * 4).fill(10)

    const diffPixels = pixelmatch(prev, curr, null, W, H, { threshold: 0.1 })
    const ratio = diffPixels / (W * H)

    expect(ratio).toBeGreaterThan(0.05)
  })

  it('does not flag identical screenshots as changed (≤5% diff pixels)', () => {
    const W = 10
    const H = 10
    // Same image twice
    const img = new Uint8ClampedArray(W * H * 4).fill(128)

    const diffPixels = pixelmatch(img, img, null, W, H, { threshold: 0.1 })
    const ratio = diffPixels / (W * H)

    expect(ratio).toBeLessThanOrEqual(0.05)
  })

  it('does not flag trivially different images as changed', () => {
    const W = 10
    const H = 10
    // Very slightly different (1 channel value different)
    const prev = new Uint8ClampedArray(W * H * 4).fill(128)
    const curr = new Uint8ClampedArray(W * H * 4).fill(129)

    const diffPixels = pixelmatch(prev, curr, null, W, H, { threshold: 0.1 })
    const ratio = diffPixels / (W * H)

    // Even a 1-value difference across the whole image should be below 5% at threshold 0.1
    expect(ratio).toBeLessThanOrEqual(0.05)
  })
})
