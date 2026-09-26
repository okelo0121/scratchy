/**
 * POST /api/relayer
 *
 * Server-side Stellar transaction submitter using PasskeyServer.
 * The browser sends { xdr: string } (signed transaction XDR).
 * This function uses PasskeyServer.send() to submit via the OZ Channels relayer,
 * keeping the relayer API key server-side.
 *
 * Returns { hash: string } on success or { error: string } on failure.
 */
import { PasskeyServer } from 'passkey-kit'
import { Networks } from '@stellar/stellar-sdk'

const STELLAR_RPC    = 'https://soroban-testnet.stellar.org'
const NETWORK_PHRASE = Networks.TESTNET

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request): Promise<Response> {
  const OZ_RELAYER_BASE    = process.env.OZ_RELAYER_BASE_URL ?? 'https://channels.openzeppelin.com/testnet'
  const OZ_RELAYER_API_KEY = process.env.OZ_RELAYER_API_KEY

  if (!OZ_RELAYER_API_KEY) {
    return Response.json(
      { error: 'Relayer not configured' },
      { status: 503, headers: CORS },
    )
  }

  let xdr: string
  try {
    const body = await req.json() as { xdr?: string }
    if (!body.xdr) throw new Error('missing xdr')
    xdr = body.xdr
  } catch {
    return Response.json({ error: 'Body must be { xdr: string }' }, { status: 400, headers: CORS })
  }

  try {
    const server = new PasskeyServer({
      rpcUrl: STELLAR_RPC,
      networkPassphrase: NETWORK_PHRASE,
      relayer: {
        baseUrl: OZ_RELAYER_BASE,
        apiKey:  OZ_RELAYER_API_KEY,
      },
    })

    const result = await server.send(xdr)

    if ('error' in result) {
      return Response.json(
        { error: `[${result.error.code}] ${result.error.message}` },
        { status: 400, headers: CORS },
      )
    }

    return Response.json({ hash: result.hash }, { headers: CORS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[relayer] error:', msg)
    return Response.json({ error: msg }, { status: 500, headers: CORS })
  }
}
