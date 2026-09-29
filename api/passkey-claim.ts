/**
 * POST /api/passkey-claim
 *
 * Full passkey gift claim flow (ScratchAndSplit v3):
 *   1. Sign an EIP-712 ClaimGift authorisation with the ephemeral key and submit
 *      claimGift() on Arc Testnet from the EVM hot wallet. The gift's USDC is
 *      released to the EVM hot wallet (recipient is bound inside the signature).
 *   2. Send the same USDC amount from the Stellar hot wallet to the recipient's
 *      Stellar passkey wallet. (The Stellar hot wallet is pre-funded; a CCTP
 *      bridge is a future upgrade.)
 *
 * The Arc claim is REQUIRED. If the gift can't be claimed on-chain (unknown,
 * already claimed, expired), nothing is paid out on Stellar — otherwise this
 * endpoint would be a free faucet for the Stellar hot wallet. The payout amount
 * is read from the on-chain gift, never trusted from the client.
 *
 * Body: {
 *   ephemeralKeyHex:  string   // 32-byte hex secret key (0x prefix optional)
 *   stellarRecipient: string   // C... or G... Stellar passkey wallet address
 *   amount?:          string   // client's display amount (informational only)
 *   giftId?:          string   // optional, used for the Stellar memo
 * }
 *
 * Returns: {
 *   success: true,
 *   txHash: string,             // Stellar payment tx hash
 *   stellarTxHash: string,      // same as txHash (client compatibility)
 *   arcTxHash: string,          // Arc claimGift tx hash
 *   stellarExplorerUrl: string,
 *   amount: string,             // USDC paid out (7dp)
 *   recipient: string,
 * }
 *
 * Env (server-side only):
 *   EVM_HOT_WALLET_SECRET | EVM_HOT_WALLET_KEY   — 0x private key, pays Arc gas + receives gift
 *   STELLAR_HOT_WALLET_SECRET                    — S... secret, pays out USDC on Stellar
 *   VITE_SCRATCH_CONTRACT_V3 | VITE_SCRATCH_CONTRACT — v3 contract (defaults to 0xB049…)
 *   VITE_ALCHEMY_API_KEY                         — optional Arc RPC
 *   STELLAR_USDC_ISSUER                          — optional, defaults to Circle testnet issuer
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
  Memo,
  Horizon,
} from '@stellar/stellar-sdk'
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  encodeFunctionData,
  parseAbi,
  formatUnits,
  decodeErrorResult,
  BaseError,
  ContractFunctionRevertedError,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// ── Arc Testnet chain config ─────────────────────────────────────────────────
const ARC_TESTNET = defineChain({
  id: 5042002, // arc-studio-allow-onchain-literal
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.VITE_ALCHEMY_API_KEY
          ? `https://arc-testnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_API_KEY}`
          : 'https://rpc.testnet.arc.io', // arc-studio-allow-onchain-literal
      ],
    },
  },
})

// ── Contract config (ScratchAndSplit v3) ─────────────────────────────────────
// arc-studio-allow-onchain-literal
const CONTRACT_ADDRESS = (
  process.env.VITE_SCRATCH_CONTRACT_V3 ??
  process.env.VITE_SCRATCH_CONTRACT ??
  '0xB049c84b48C0F57eD2FCa32131E16036eaDcE6A7'
) as `0x${string}`

const SCRATCH_V3_ABI = parseAbi([
  'function claimGift(address recipient, address ephemeralSigner, uint64 deadline, bytes signature) external',
  'function getGift(address ephemeralSigner) external view returns (address sender, uint256 amount, uint64 expiresAt, bool claimed)',
  'error Unauthorized()',
  'error ClaimDeadlinePassed()',
  'error GiftNotFound()',
  'error GiftAlreadyProcessed()',
  'error GiftExpired()',
  'error InvalidSignature()',
  'error TransferFailed()',
])

// Must match `EIP712("ScratchAndSplit", "3")` in ScratchAndSplitV3.sol
const EIP712_DOMAIN_NAME    = 'ScratchAndSplit'
const EIP712_DOMAIN_VERSION = '3'
const CLAIM_TYPES = {
  ClaimGift: [
    { name: 'recipient',       type: 'address' },
    { name: 'ephemeralSigner', type: 'address' },
    { name: 'deadline',        type: 'uint64'  },
  ],
} as const

// ── EVM hot wallet ───────────────────────────────────────────────────────────
const EVM_HOT_WALLET_SECRET =
  process.env.EVM_HOT_WALLET_SECRET ?? process.env.EVM_HOT_WALLET_KEY ?? ''

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

class ClaimError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

/** Map a viem revert into a human-readable, correctly-coded ClaimError. */
function describeRevert(err: unknown): ClaimError {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | undefined
    let name = revert?.data?.errorName
    if (!name && revert?.raw) {
      try { name = decodeErrorResult({ abi: SCRATCH_V3_ABI, data: revert.raw }).errorName } catch { /* unknown */ }
    }
    switch (name) {
      case 'GiftNotFound':         return new ClaimError('Gift not found on Arc — is the link correct?', 404)
      case 'GiftAlreadyProcessed': return new ClaimError('Gift has already been claimed or cancelled', 409)
      case 'GiftExpired':          return new ClaimError('Gift has expired', 410)
      case 'ClaimDeadlinePassed':  return new ClaimError('Claim signature expired, please retry', 409)
      case 'InvalidSignature':     return new ClaimError('Invalid gift key', 400)
    }
    return new ClaimError(err.shortMessage, 502)
  }
  return new ClaimError(err instanceof Error ? err.message : 'Arc claim failed', 502)
}

// ── Step 1: Claim gift on Arc (v3, EIP-712) ─────────────────────────────────
/**
 * Signs a ClaimGift authorisation with the ephemeral key naming the EVM hot
 * wallet as recipient, then submits it from the hot wallet (which pays gas).
 * Returns the Arc tx hash and the gift amount in 18-decimal native USDC.
 */
async function claimOnArc(ephemeralKeyHex: string): Promise<{ arcTxHash: `0x${string}`; amountWei: bigint }> {
  if (!EVM_HOT_WALLET_SECRET) {
    throw new ClaimError('Server not configured (EVM_HOT_WALLET_SECRET missing)', 503)
  }

  const cleanHex = ephemeralKeyHex.replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    throw new ClaimError('ephemeralKeyHex must be a 32-byte hex string', 400)
  }

  const ephemeralAccount = privateKeyToAccount(`0x${cleanHex}`)
  const hotAccount       = privateKeyToAccount(EVM_HOT_WALLET_SECRET as `0x${string}`)

  const publicClient = createPublicClient({ chain: ARC_TESTNET, transport: http() })
  const walletClient = createWalletClient({ chain: ARC_TESTNET, transport: http(), account: hotAccount })

  // Read the gift so we can reject early with a precise error and learn the amount.
  const [sender, amountWei, expiresAt, claimed] = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: SCRATCH_V3_ABI,
    functionName: 'getGift',
    args: [ephemeralAccount.address],
  })

  if (sender === '0x0000000000000000000000000000000000000000') {
    throw new ClaimError('Gift not found on Arc — is the link correct?', 404)
  }
  if (claimed) throw new ClaimError('Gift has already been claimed or cancelled', 409)
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (now > expiresAt) throw new ClaimError('Gift has expired', 410)

  // Sign the EIP-712 claim with the ephemeral key. Recipient = hot wallet.
  const deadline = now + BigInt(3600)
  const signature = await ephemeralAccount.signTypedData({
    domain: {
      name: EIP712_DOMAIN_NAME,
      version: EIP712_DOMAIN_VERSION,
      chainId: BigInt(ARC_TESTNET.id),
      verifyingContract: CONTRACT_ADDRESS,
    },
    types: CLAIM_TYPES,
    primaryType: 'ClaimGift',
    message: {
      recipient:       hotAccount.address,
      ephemeralSigner: ephemeralAccount.address,
      deadline,
    },
  })

  const args = [hotAccount.address, ephemeralAccount.address, deadline, signature] as const

  // Simulate first so reverts surface as decoded custom errors rather than a mined failure.
  try {
    await publicClient.simulateContract({
      address: CONTRACT_ADDRESS,
      abi: SCRATCH_V3_ABI,
      functionName: 'claimGift',
      args,
      account: hotAccount,
    })
  } catch (err) {
    throw describeRevert(err)
  }

  const data = encodeFunctionData({ abi: SCRATCH_V3_ABI, functionName: 'claimGift', args })
  const arcTxHash = await walletClient.sendTransaction({
    to:  CONTRACT_ADDRESS,
    data,
    gas: BigInt(180_000),
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: arcTxHash })
  if (receipt.status !== 'success') {
    throw new ClaimError(`Arc claim tx reverted: ${arcTxHash}`, 502)
  }

  console.log(`[passkey-claim] Arc claim tx: ${arcTxHash} (${formatUnits(amountWei, 18)} USDC)`)
  return { arcTxHash, amountWei }
}

// ── Step 2: Send USDC on Stellar ─────────────────────────────────────────────
async function sendStellarUsdc(
  recipientAddress: string,
  amount: string,
  memo?: string,
): Promise<string> {
  if (!HOT_WALLET_SECRET) {
    throw new ClaimError('Server not configured (STELLAR_HOT_WALLET_SECRET missing)', 503)
  }

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

/** 18-decimal native USDC → Stellar 7-decimal string, truncated (never over-pay). */
function toStellarAmount(amountWei: bigint): string {
  const STROOPS_PER_USDC = BigInt(10_000_000)
  const stroops = (amountWei * STROOPS_PER_USDC) / BigInt(10) ** BigInt(18)
  const whole = stroops / STROOPS_PER_USDC
  const frac  = (stroops % STROOPS_PER_USDC).toString().padStart(7, '0')
  return `${whole}.${frac}`
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

    const { ephemeralKeyHex, stellarRecipient, amount: clientAmount, giftId } = body

    if (!stellarRecipient) {
      return json({ error: 'stellarRecipient is required' }, 400)
    }
    if (!ephemeralKeyHex) {
      return json({ error: 'ephemeralKeyHex is required' }, 400)
    }
    if (!stellarRecipient.startsWith('G') && !stellarRecipient.startsWith('C')) {
      return json({ error: 'stellarRecipient must be a G... or C... Stellar address' }, 400)
    }

    // Step 1: Claim on Arc. Required — this both proves the caller holds a real,
    // unclaimed gift and tells us how much to pay out.
    const { arcTxHash, amountWei } = await claimOnArc(ephemeralKeyHex)
    if (amountWei <= BigInt(0)) {
      return json({ error: 'Gift amount is zero' }, 409)
    }

    const stellarAmount = toStellarAmount(amountWei)
    if (clientAmount && Math.abs(parseFloat(clientAmount) - parseFloat(stellarAmount)) > 0.000001) {
      console.warn(`[passkey-claim] client amount ${clientAmount} != on-chain ${stellarAmount}; using on-chain`)
    }

    // Step 2: Send USDC from Stellar hot wallet to passkey wallet
    console.log(`[passkey-claim] Sending ${stellarAmount} USDC to ${stellarRecipient}`)
    const stellarTxHash = await sendStellarUsdc(
      stellarRecipient,
      stellarAmount,
      giftId ? `ScratchGift:${giftId.slice(0, 16)}` : 'ScratchAndSplit',
    )
    console.log(`[passkey-claim] Stellar tx: ${stellarTxHash}`)

    return json({
      success: true,
      txHash: stellarTxHash,
      stellarTxHash,
      arcTxHash,
      stellarExplorerUrl: `https://stellar.expert/explorer/testnet/tx/${stellarTxHash}`,
      amount: stellarAmount,
      recipient: stellarRecipient,
    })
  } catch (err: unknown) {
    if (err instanceof ClaimError) {
      console.error(`[passkey-claim] ${err.status}: ${err.message}`)
      return json({ error: err.message }, err.status)
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[passkey-claim] Error:', message)
    return json({ error: message }, 500)
  }
}
