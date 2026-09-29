/**
 * api/relayer.ts — Vercel serverless function
 *
 * Submits a passkey-signed Stellar XDR transaction via PasskeyServer
 * (which uses the OZ Channels relayer for fee sponsorship).
 *
 * POST { action: 'submit', xdr: string } → { hash: string }
 *
 * PasskeyServer.send() never throws — it returns a discriminated
 * TransactionResult { success: true, hash } | { success: false, error }.
 * We surface the relayer's real error to the client instead of an empty hash.
 */

import { PasskeyServer } from 'passkey-kit/server'
import { Networks } from '@stellar/stellar-sdk'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
}

const OZ_BASE_URL = process.env.OZ_RELAYER_BASE_URL ?? 'https://channels.openzeppelin.com/testnet'
const OZ_API_KEY  = process.env.OZ_RELAYER_API_KEY  ?? ''

function getServer(): PasskeyServer {
  return new PasskeyServer({
    rpcUrl:            'https://soroban-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET,
    relayer: {
      baseUrl: OZ_BASE_URL,
      apiKey:  OZ_API_KEY,
    },
  })
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as { action?: string; xdr?: string }

    if (!body.xdr) {
      return new Response(
        JSON.stringify({ error: 'Missing xdr' }),
        { status: 400, headers: CORS },
      )
    }

    const server = getServer()
    const result = await server.send(body.xdr)

    if (!result.success) {
      console.error('[relayer] submission failed:', result.error.code, result.error.message)
      return new Response(
        JSON.stringify({
          error: result.error.message,
          code:  result.error.code,
          ...(result.hash ? { hash: result.hash } : {}),
        }),
        { status: 502, headers: CORS },
      )
    }

    return new Response(
      JSON.stringify({ hash: result.hash }),
      { status: 200, headers: CORS },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[relayer] error:', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: CORS },
    )
  }
}
