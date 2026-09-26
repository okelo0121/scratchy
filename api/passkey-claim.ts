/**
 * POST /api/passkey-claim
 *
 * Full passkey gift claim flow:
 *   1. Call claimGift() on Arc Testnet ScratchAndSplit contract
 *      — uses the ephemeral secretKey to release USDC to the EVM hot wallet
 *   2. Send USDC from the Stellar hot wallet to the recipient's Stellar passkey wallet
 *      (The Stellar hot wallet is pre-funded; CCTP bridge is a future v2 upgrade)
 *
 * Body: {
 *   ephemeralKeyHex: string   // 32-byte hex secret key (no 0x prefix)
 *   stellarRecipient: string  // C... or G... Stellar passkey wallet address
 *   amount:           string  // decimal USDC e.g. "5.00"
 *   giftId?:          string  // optional for memo
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
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseGwei } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// ── Arc Testnet chain config ─────────────────────────────────────────────────
const ARC_TESTNET = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.drpc.testnet.arc.io'] } },
} as const

// ── Contract config ──────────────────────────────────────────────────────────
// arc-studio-allow-onchain-literal
const CONTRACT_ADDRESS = (process.env.VITE_CONTRACT_ADDRESS ?? '0x0b612a742aab5ed55b84c181af4258204e0d6dfc') as `0x${string}`

const CLAIM_GIFT_ABI = [{
  type: 'function',
  name: 'claimGift',
  inputs: [
    { name: 'secretKey', type: 'bytes32' },
    { name: 'recipient', type: 'address' },
  ],
  outputs: [],
  stateMutability: 'nonpayable',
}] as const

// ── EVM hot wallet ───────────────────────────────────────────────────────────
const EVM_HOT_WALLET_SECRET = process.env.EVM_HOT_WALLET_SECRET ?? ''

// ── Stellar config ───────────────────────────────────────────────────────────
const STELLAR_HORIZON    = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK    = Networks.TESTNET
const USDC_ISSUER        = process.env.STELLAR_USDC_ISSUER ?? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const USDC_ASSET         = new Asset('USDC', USDC_ISSUER)
const HOT_WALLET_SECRET  = process.env.STELLAR_HOT_WALLET_SECRET ?? ''

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

// ── Step 1: Claim gift on Arc ─────────────────────────────────────────────────
async function claimOnArc(ephemeralKeyHex: string): Promise<string> {
  if (!EVM_HOT_WALLET_SECRET) throw new Error('EVM_HOT_WALLET_SECRET not configured')

  const secretKeyBytes = `0x${ephemeralKeyHex.replace(/^0x/, '')}` as `0x${string}`
  const account = privateKeyToAccount(EVM_HOT_WALLET_SECRET as `0x${string}`)

  const publicClient = createPublicClient({
    chain: ARC_TESTNET,
    transport: http(),
  })
  const walletClient = createWalletClient({
    account,
    chain: ARC_TESTNET,
    transport: http(),
  })

  const data = encodeFunctionData({
    abi: CLAIM_GIFT_ABI,
    functionName: 'claimGift',
    args: [secretKeyBytes as `0x${string}`, account.address],
  })

  const hash = await walletClient.sendTransaction({
    to: CONTRACT_ADDRESS,
    data,
    gas: BigInt(0x2BF20), // 180,000
    maxFeePerGas: parseGwei('0.001'),
    maxPriorityFeePerGas: parseGwei('0.001'),
  })

  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Arc claim tx reverted: ${hash}`)

  console.log(`[passkey-claim] Arc claim tx: ${hash}`)
  return hash
}

// ── Step 2: Send USDC on Stellar ─────────────────────────────────────────────
async function sendStellarUsdc(
  recipientAddress: string,
  amount: string,
  memo?: string,
): Promise<string> {
  if (!HOT_WALLET_SECRET) throw new Error('STELLAR_HOT_WALLET_SECRET not configured')

  const keypair = Keypair.fromSecret(HOT_WALLET_SECRET)
  const horizon = new Horizon.Server(STELLAR_HORIZON)
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

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as {
      ephemeralKeyHex?: string
      stellarRecipient?: string
      amount?: string
      giftId?: string
    }

    const { ephemeralKeyHex, stellarRecipient, amount, giftId } = body

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
    if (!ephemeralKeyHex) {
      return new Response(JSON.stringify({ error: 'ephemeralKeyHex is required' }), {
        status: 400, headers: CORS,
      })
    }
    if (!stellarRecipient.startsWith('G') && !stellarRecipient.startsWith('C')) {
      return new Response(JSON.stringify({ error: 'stellarRecipient must be a G... or C... Stellar address' }), {
        status: 400, headers: CORS,
      })
    }

    // Step 1: Claim on Arc (if EVM hot wallet is configured)
    let arcTxHash: string | null = null
    if (EVM_HOT_WALLET_SECRET) {
      try {
        arcTxHash = await claimOnArc(ephemeralKeyHex)
      } catch (err) {
        console.error('[passkey-claim] Arc claim failed, continuing to Stellar send:', err)
        // Don't block — Stellar send proceeds from hot wallet balance
      }
    } else {
      console.warn('[passkey-claim] EVM_HOT_WALLET_SECRET not set — skipping Arc claim')
    }

    // Step 2: Send USDC from Stellar hot wallet to passkey wallet
    const stellarAmount = parseFloat(amount).toFixed(7)
    console.log(`[passkey-claim] Sending ${stellarAmount} USDC to ${stellarRecipient}`)

    const stellarTxHash = await sendStellarUsdc(
      stellarRecipient,
      stellarAmount,
      giftId ? `ScratchGift:${giftId.slice(0, 16)}` : 'ScratchAndSplit',
    )

    console.log(`[passkey-claim] Stellar tx: ${stellarTxHash}`)

    return new Response(
      JSON.stringify({
        success: true,
        txHash: stellarTxHash,
        arcTxHash,
        stellarExplorerUrl: `https://stellar.expert/explorer/testnet/tx/${stellarTxHash}`,
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
