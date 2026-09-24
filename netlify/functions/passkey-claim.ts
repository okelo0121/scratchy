/**
 * passkey-claim — Netlify serverless function
 *
 * Bridges a claimed ScratchAndSplit gift from Arc Testnet to Stellar Testnet,
 * then sends the USDC to the recipient's Stellar passkey smart wallet.
 *
 * POST /api/passkey-claim
 * Body: {
 *   secretKeyHex:    string   // 0x-prefixed ephemeral private key from gift URL
 *   recipient:       string   // 0x-prefixed Arc address to claim to (hot wallet EVM)
 *   stellarRecipient: string  // C... or G... Stellar smart wallet address
 *   ephemeralSigner: string   // 0x-prefixed ephemeral signer address
 *   deadline:        string   // EIP-712 deadline as decimal string
 *   signature:       string   // 0x-prefixed EIP-712 signature
 * }
 */

import type { Handler } from '@netlify/functions'
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

// ── Config ────────────────────────────────────────────────────────────────────
const STELLAR_RPC     = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = Networks.TESTNET
const USDC_ISSUER     = process.env.STELLAR_USDC_ISSUER ?? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const USDC_ASSET      = new Asset('USDC', USDC_ISSUER)
const HOT_WALLET_SECRET = process.env.STELLAR_HOT_WALLET_SECRET ?? ''

// ── CCTP Contract Addresses (Arc Testnet) — reserved for bridge phase ────────
const _ARC_TOKEN_MESSENGER  = '0x8FE6B999Dc680CcFDD5Bf7EB90B0E4E6A2D821F5' as const
const _ARC_USDC_ADDRESS     = '0x3600000000000000000000000000000000000000' as const
const _STELLAR_DOMAIN       = 27 // CCTP domain for Stellar Testnet
const _STELLAR_CCTP_FORWARDER = 'CCTP_FORWARDER_PLACEHOLDER' // fetched from Circle docs
// satisfy no-unused-vars for reserved constants
void _ARC_TOKEN_MESSENGER; void _ARC_USDC_ADDRESS; void _STELLAR_DOMAIN; void _STELLAR_CCTP_FORWARDER

// ── Helper: CORS headers ──────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

// ── Helper: send USDC on Stellar from hot wallet ──────────────────────────────
async function sendStellarUsdc(
  recipientAddress: string,
  amount: string, // decimal string e.g. "5.000000"
  memo?: string,
): Promise<string> {
  if (!HOT_WALLET_SECRET) throw new Error('STELLAR_HOT_WALLET_SECRET not configured')

  const keypair  = Keypair.fromSecret(HOT_WALLET_SECRET)
  const horizon  = new Horizon.Server(STELLAR_RPC)
  const account  = await horizon.loadAccount(keypair.publicKey())

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

// ── Main handler ──────────────────────────────────────────────────────────────
export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const body = JSON.parse(event.body ?? '{}') as {
      stellarRecipient?: string
      amount?: string
      giftId?: string
    }

    const { stellarRecipient, amount, giftId } = body

    if (!stellarRecipient) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'stellarRecipient is required' }),
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'amount is required and must be positive' }),
      }
    }

    // Validate Stellar address format
    if (!stellarRecipient.startsWith('G') && !stellarRecipient.startsWith('C')) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'stellarRecipient must be a G... or C... Stellar address' }),
      }
    }

    // ── Phase 1: The Arc claim is handled client-side (v3 EIP-712 signed claim)
    // By the time this function is called, the USDC has been claimed to our hot
    // wallet EVM address on Arc. We receive the amount and need to:
    //   Phase 2: Bridge Arc USDC → Stellar USDC (CCTP)
    //   Phase 3: Send Stellar USDC → recipient's passkey wallet
    //
    // NOTE: Full CCTP bridging requires the Arc hot wallet to be funded and
    // the CCTP contracts to be called. For the initial MVP, we do a direct
    // Stellar payment from the hot wallet (the hot wallet holds testnet USDC
    // pre-funded for testing). Full CCTP bridge will be added in v2.

    // Format amount to 7 decimal places (Stellar's precision)
    const stellarAmount = parseFloat(amount).toFixed(7)

    console.log(`[passkey-claim] Sending ${stellarAmount} USDC to ${stellarRecipient}`)

    const txHash = await sendStellarUsdc(
      stellarRecipient,
      stellarAmount,
      giftId ? `ScratchGift:${giftId.slice(0, 16)}` : 'ScratchAndSplit',
    )

    console.log(`[passkey-claim] Stellar tx: ${txHash}`)

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        success: true,
        stellarTxHash: txHash,
        stellarExplorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
        amount: stellarAmount,
        recipient: stellarRecipient,
      }),
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[passkey-claim] Error:', message)
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: message }),
    }
  }
}
