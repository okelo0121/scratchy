/**
 * POST /api/passkey-claim
 *
 * Bridges a claimed ScratchAndSplit gift from Arc Testnet to Stellar Testnet,
 * then sends the USDC to the recipient's Stellar passkey smart wallet.
 *
 * Body: {
 *   stellarRecipient: string   // C... or G... Stellar smart wallet address
 *   amount:           string   // decimal USDC amount e.g. "5.00"
 *   giftId?:          string   // optional gift identifier for memo
 * }
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
  Memo,
} from '@stellar/stellar-sdk'
import { Horizon } from '@stellar/stellar-sdk'

const STELLAR_RPC       = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK   = Networks.TESTNET
const USDC_ISSUER       = process.env.STELLAR_USDC_ISSUER ?? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const USDC_ASSET        = new Asset('USDC', USDC_ISSUER)
const HOT_WALLET_SECRET = process.env.STELLAR_HOT_WALLET_SECRET ?? ''

// CCTP contract addresses — reserved for bridge phase v2 (not called yet)
// arc-studio-allow-onchain-literal
const _ARC_TOKEN_MESSENGER    = process.env.VITE_ARC_TOKEN_MESSENGER    ?? '0x8FE6B999Dc680CcFDD5Bf7EB90B0E4E6A2D821F5'
const _ARC_USDC_ADDRESS       = process.env.VITE_CONTRACT_ADDRESS        ?? '0x3600000000000000000000000000000000000000'
const _STELLAR_DOMAIN         = 27
const _STELLAR_CCTP_FORWARDER = 'CCTP_FORWARDER_PLACEHOLDER'
void _ARC_TOKEN_MESSENGER; void _ARC_USDC_ADDRESS; void _STELLAR_DOMAIN; void _STELLAR_CCTP_FORWARDER

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

async function sendStellarUsdc(
  recipientAddress: string,
  amount: string,
  memo?: string,
): Promise<string> {
  if (!HOT_WALLET_SECRET) throw new Error('STELLAR_HOT_WALLET_SECRET not configured')

  const keypair = Keypair.fromSecret(HOT_WALLET_SECRET)
  const horizon = new Horizon.Server(STELLAR_RPC)
  const account = await horizon.loadAccount(keypair.publicKey())

  const builder = new TransactionBuilder(account, {
    fee: (parseInt(BASE_FEE) * 10).toString(),
    networkPassphrase: STELLAR_NETWORK,
  })

  builder.addOperation(
    Operation.payment({
      destination: recipientAddress,
      asset: USDC_ASSET,
      amount,
    })
  )

  if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)))
  builder.setTimeout(60)

  const tx = builder.build()
  tx.sign(keypair)

  const result = await horizon.submitTransaction(tx)
  return result.hash
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

  try {
    const body = await req.json() as {
      stellarRecipient?: string
      amount?: string
      giftId?: string
    }

    const { stellarRecipient, amount, giftId } = body

    if (!stellarRecipient) {
      return new Response(JSON.stringify({ error: 'stellarRecipient is required' }), {
        status: 400, headers: CORS,
      })
    }

    if (!amount || parseFloat(amount) <= 0) {
      return new Response(JSON.stringify({ error: 'amount must be a positive number' }), {
        status: 400, headers: CORS,
      })
    }

    if (!stellarRecipient.startsWith('G') && !stellarRecipient.startsWith('C')) {
      return new Response(JSON.stringify({ error: 'stellarRecipient must be a G... or C... Stellar address' }), {
        status: 400, headers: CORS,
      })
    }

    const stellarAmount = parseFloat(amount).toFixed(7)
    console.log(`[passkey-claim] Sending ${stellarAmount} USDC to ${stellarRecipient}`)

    const txHash = await sendStellarUsdc(
      stellarRecipient,
      stellarAmount,
      giftId ? `ScratchGift:${giftId.slice(0, 16)}` : 'ScratchAndSplit',
    )

    console.log(`[passkey-claim] Stellar tx: ${txHash}`)

    return new Response(
      JSON.stringify({
        success: true,
        stellarTxHash: txHash,
        stellarExplorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
        amount: stellarAmount,
        recipient: stellarRecipient,
      }),
      { status: 200, headers: CORS },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[passkey-claim] Error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: CORS,
    })
  }
}
