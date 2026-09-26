/**
 * POST /api/onramp/sessions
 *
 * Mints a short-lived Circle Onramp Kit session.
 * Uses createSessionRouteHandler from @circle-fin/onramp-kit/server —
 * the canonical Vercel-compatible route handler factory.
 */

import {
  createOnrampServerKit,
  createSessionRouteHandler,
} from '@circle-fin/onramp-kit/server'

const server = createOnrampServerKit({
  apiKey: process.env.ONRAMP_API_KEY ?? '',
  referrerDomain: process.env.VERCEL_URL ?? 'scratchy.okelo.tech',
})

export const POST = createSessionRouteHandler(server)

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin' : '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
