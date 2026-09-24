/**
 * relayer-proxy — Netlify serverless function
 *
 * Thin proxy that forwards passkey wallet transactions to the OpenZeppelin
 * Relayer Channels service, keeping the API key server-side only.
 *
 * POST /api/relayer-proxy
 * Body: { func?: string, auth?: string[], xdr?: string }
 */

import type { Handler } from '@netlify/functions'

const OZ_RELAYER_BASE = process.env.OZ_RELAYER_BASE_URL ?? 'https://channels.openzeppelin.com/testnet'
const OZ_RELAYER_API_KEY = process.env.OZ_RELAYER_API_KEY ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!OZ_RELAYER_API_KEY) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Relayer not configured' }),
    }
  }

  try {
    const body = JSON.parse(event.body ?? '{}')

    // Determine which relayer endpoint to call
    // func+auth = Soroban wallet invocation
    // xdr = fee-bump envelope (deploys)
    const isInvocation = Boolean(body.func || body.auth)
    const endpoint = isInvocation
      ? `${OZ_RELAYER_BASE}/submit`
      : `${OZ_RELAYER_BASE}/submit`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OZ_RELAYER_API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json() as unknown

    return {
      statusCode: response.status,
      headers: CORS,
      body: JSON.stringify(data),
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[relayer-proxy] Error:', message)
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: message }),
    }
  }
}
