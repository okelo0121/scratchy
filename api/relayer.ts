/**
 * POST /api/relayer
 *
 * Thin proxy that forwards passkey wallet transactions to the OpenZeppelin
 * Relayer Channels service, keeping the API key server-side only.
 */

const OZ_RELAYER_BASE    = process.env.OZ_RELAYER_BASE_URL ?? 'https://channels.openzeppelin.com/testnet'
const OZ_RELAYER_API_KEY = process.env.OZ_RELAYER_API_KEY  ?? ''

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: CORS,
    })
  }

  if (!OZ_RELAYER_API_KEY) {
    return new Response(JSON.stringify({ error: 'Relayer not configured' }), {
      status: 500, headers: CORS,
    })
  }

  try {
    const body = await req.json() as Record<string, unknown>

    const response = await fetch(`${OZ_RELAYER_BASE}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${OZ_RELAYER_API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json() as unknown

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: CORS,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[relayer] Error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: CORS,
    })
  }
}
