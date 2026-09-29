/**
 * api/relayer.ts — Vercel serverless function
 *
 * Submits a passkey-signed Stellar XDR transaction via PasskeyServer
 * (which uses the OZ Channels relayer for fee sponsorship).
 *
 * POST { action: 'submit', xdr: string } → { hash: string }
 */

import { PasskeyServer } from 'passkey-kit/server'
import { Networks } from '@stellar/stellar-sdk'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
}

const WASM_HASH   = 'b2e858176fab112cc9afbe54590e13d12192ba7fa32dd83cf565d21f2f13179a'
const OZ_BASE_URL = process.env.OZ_RELAYER_BASE_URL ?? 'https://channels.openzeppelin.com/testnet'
const OZ_API_KEY  = process.env.OZ_RELAYER_API_KEY  ?? ''

function getServer(): PasskeyServer {
  return new PasskeyServer({
    rpcUrl:            'https://soroban-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET,
    walletWasmHash:    WASM_HASH,
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
    const hash   = (result as { hash?: string }).hash ?? ''

    return new Response(
      JSON.stringify({ hash }),
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
