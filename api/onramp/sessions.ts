/**
 * POST /api/onramp/sessions
 *
 * Mints a short-lived Circle Onramp Kit session for the requesting user.
 * The ONRAMP_API_KEY (Kit Key) lives only here — never in the frontend bundle.
 *
 * NOTE: @circle-fin/onramp-kit is in private beta.
 * Install once you have a Cloudsmith key from your Circle contact:
 *   bun add @circle-fin/onramp-kit
 * Until then this function returns a clear 503 so the UI degrades gracefully.
 */

const ONRAMP_API_KEY  = process.env.ONRAMP_API_KEY  ?? ''
const WIDGET_BASE_URL = 'https://onramp.arc.io'

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request): Promise<Response> {

  if (!ONRAMP_API_KEY) {
    return new Response(JSON.stringify({ error: 'ONRAMP_API_KEY not configured' }), {
      status: 503, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body: { appUserId?: string; destinationAddress?: string; amount?: string; currency?: string } = {}
  try {
    body = await req.json() as typeof body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { appUserId, destinationAddress, amount, currency } = body

  if (!appUserId || !destinationAddress) {
    return new Response(JSON.stringify({ error: 'appUserId and destinationAddress are required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Dynamic import — missing module is a runtime error, not a build error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { createOnrampServerKit } = await import('@circle-fin/onramp-kit/server')

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const server = createOnrampServerKit({
      apiKey: ONRAMP_API_KEY,
      referrerDomain: new URL(req.headers.get('origin') ?? WIDGET_BASE_URL).hostname,
    })

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const session = await server.createSession({
      appUserId,
      destinationAddress,
      destinationChain: 'ARC',
      ...(amount ? { amount: parseFloat(amount) } : {}),
      ...(currency ? { currency } : { currency: 'USD' }),
      assets: { tokens: ['USDC'] },
    })

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    if (msg.includes('Cannot find module') || msg.includes('ERR_MODULE_NOT_FOUND') || msg.includes('MODULE_NOT_FOUND')) {
      return new Response(
        JSON.stringify({
          error: 'onramp_not_available',
          detail: '@circle-fin/onramp-kit not installed. Ask your Circle contact for the Cloudsmith key.',
        }),
        { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    console.error('[onramp-sessions] error:', msg)
    return new Response(JSON.stringify({ error: 'Failed to create onramp session', detail: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}
