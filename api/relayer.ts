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

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request): Promise<Response> {

  if (!OZ_RELAYER_API_KEY) {
    return new Response(JSON.stringify({ error: 'Relayer not configured' }), {
      status: 500, headers: CORS,
    })
  }

  try {
    // The browser sends { func, auth } or { xdr } — OZ Channels expects { params: <body> }
    const body = await req.json() as Record<string, unknown>

    // baseUrl is already stripped of trailing slash in the env var; append '/' for the API root
    const endpoint = OZ_RELAYER_BASE.replace(/\/$/, '') + '/'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${OZ_RELAYER_API_KEY}`,
      },
      body: JSON.stringify({ params: body }),
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
