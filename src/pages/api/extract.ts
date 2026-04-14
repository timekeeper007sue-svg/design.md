import type { APIRoute } from 'astro'
import { extractTokens } from '../../lib/extractor'
import { generateDesignMd } from '../../lib/generator'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const url = body.url

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid url' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validate URL
    let parsed: URL
    try {
      parsed = new URL(url)
      if (!parsed.protocol.startsWith('http')) throw new Error()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const tokens = await extractTokens(url)
    const markdown = generateDesignMd(url, tokens)
    const domain = parsed.hostname

    return new Response(
      JSON.stringify({
        domain,
        url,
        tokens,
        markdown,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (err: any) {
    const message = err?.message ?? 'Unknown error'
    console.error('Extract failed:', message)

    return new Response(
      JSON.stringify({
        error: message.includes('timeout')
          ? 'Request timed out. The website may be too slow or blocking automated access.'
          : message.includes('HTTP')
            ? message
            : `Failed to extract tokens: ${message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
