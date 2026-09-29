/**
 * POST /api/passkey-claim
 *
 * Full passkey gift claim flow (ScratchAndSplit v3):
 *   1. Read the gift on Arc to learn the amount and confirm it's claimable.
 *   2. Preflight the Stellar payout (recipient valid + reachable, hot wallet
 *      funded, SAC transfer simulates) BEFORE anything irreversible happens.
 *   3. Sign an EIP-712 ClaimGift authorisation with the ephemeral key and submit
 *      claimGift() on Arc from the EVM hot wallet. The gift's USDC is released
 *      to the EVM hot wallet (recipient is bound inside the signature).
 *   4. Send the same USDC amount from the Stellar hot wallet to the recipient's
 *      Stellar passkey wallet. Passkey wallets are Soroban contracts (C...), so
 *      this invokes the USDC Stellar Asset Contract — a classic payment cannot
 *      deliver to a contract address. See server/stellar.ts.
 *
 * The Arc claim is REQUIRED. If the gift can't be claimed on-chain (unknown,
 * already claimed, expired), nothing is paid out on Stellar — otherwise this
 * endpoint would be a free faucet for the Stellar hot wallet. The payout amount
 * is read from the on-chain gift, never trusted from the client.
 *
 * If step 4 still fails after a successful Arc claim, the response is a 502
 * that includes `arcTxHash` and the exact payout details are logged with the
 * marker PAYOUT_FAILED so ops can complete it with `scripts/stellar-payout.ts`.
 *
 * Body: {
 *   ephemeralKeyHex:  string   // 32-byte hex secret key (0x prefix optional)
 *   stellarRecipient: string   // C... or G... Stellar passkey wallet address
 *   amount?:          string   // client's display amount (informational only)
 *   giftId?:          string   // optional, used for the Stellar memo (G... only)
 * }
 *
 * Returns: {
 *   success: true,
 *   txHash: string,             // Stellar payout tx hash
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
 *   STELLAR_RPC_URL / STELLAR_HORIZON_URL / STELLAR_USDC_ISSUER — optional overrides
 */

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
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import {
  preflightUsdcPayout,
  sendUsdcPayout,
  weiToStroops,
  formatStroops,
  StellarPayoutError,
} from '../server/stellar'

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

// ── Secrets ──────────────────────────────────────────────────────────────────
const EVM_HOT_WALLET_SECRET =
  process.env.EVM_HOT_WALLET_SECRET ?? process.env.EVM_HOT_WALLET_KEY ?? ''
const STELLAR_HOT_WALLET_SECRET = process.env.STELLAR_HOT_WALLET_SECRET ?? ''

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

class ClaimError extends Error {
  constructor(message: string, public status: number, public extra: Record<string, unknown> = {}) {
    super(message)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

const STELLAR_STATUS: Record<StellarPayoutError['code'], number> = {
  not_configured:     503,
  invalid_recipient:  400,
  recipient_missing:  400,
  no_trustline:       400,
  insufficient_funds: 503,
  simulation_failed:  502,
  submit_failed:      502,
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

function parseEphemeralKey(ephemeralKeyHex: string): PrivateKeyAccount {
  const cleanHex = ephemeralKeyHex.replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    throw new ClaimError('ephemeralKeyHex must be a 32-byte hex string', 400)
  }
  return privateKeyToAccount(`0x${cleanHex}`)
}

const publicClient = createPublicClient({ chain: ARC_TESTNET, transport: http() })

// ── Step 1: Read gift on Arc ─────────────────────────────────────────────────
async function readGift(ephemeralSigner: `0x${string}`): Promise<{ amountWei: bigint; expiresAt: bigint }> {
  const [sender, amountWei, expiresAt, claimed] = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: SCRATCH_V3_ABI,
    functionName: 'getGift',
    args: [ephemeralSigner],
  })

  if (sender === '0x0000000000000000000000000000000000000000') {
    throw new ClaimError('Gift not found on Arc — is the link correct?', 404)
  }
  if (claimed) throw new ClaimError('Gift has already been claimed or cancelled', 409)
  if (BigInt(Math.floor(Date.now() / 1000)) > expiresAt) throw new ClaimError('Gift has expired', 410)
  if (amountWei <= BigInt(0)) throw new ClaimError('Gift amount is zero', 409)

  return { amountWei, expiresAt }
}

// ── Step 3: Claim gift on Arc (v3, EIP-712) ─────────────────────────────────
/**
 * Signs a ClaimGift authorisation with the ephemeral key naming the EVM hot
 * wallet as recipient, then submits it from the hot wallet (which pays gas).
 */
async function claimOnArc(ephemeralAccount: PrivateKeyAccount): Promise<`0x${string}`> {
  if (!EVM_HOT_WALLET_SECRET) {
    throw new ClaimError('Server not configured (EVM_HOT_WALLET_SECRET missing)', 503)
  }
  const hotAccount   = privateKeyToAccount(EVM_HOT_WALLET_SECRET as `0x${string}`)
  const walletClient = createWalletClient({ chain: ARC_TESTNET, transport: http(), account: hotAccount })

  const deadline  = BigInt(Math.floor(Date.now() / 1000) + 3600)
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
  return arcTxHash
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

    if (!stellarRecipient) return json({ error: 'stellarRecipient is required' }, 400)
    if (!ephemeralKeyHex)  return json({ error: 'ephemeralKeyHex is required' }, 400)

    const ephemeralAccount = parseEphemeralKey(ephemeralKeyHex)

    // Step 1: read the gift — amount is the on-chain truth.
    const { amountWei } = await readGift(ephemeralAccount.address)
    const stroops       = weiToStroops(amountWei)
    const stellarAmount = formatStroops(stroops)
    if (stroops <= BigInt(0)) return json({ error: 'Gift amount is below Stellar precision' }, 409)

    if (clientAmount && Math.abs(parseFloat(clientAmount) - parseFloat(stellarAmount)) > 0.000001) {
      console.warn(`[passkey-claim] client amount ${clientAmount} != on-chain ${stellarAmount}; using on-chain`)
    }

    // Step 2: preflight the Stellar payout before doing anything irreversible.
    const kind = await preflightUsdcPayout(STELLAR_HOT_WALLET_SECRET, stellarRecipient, stroops)
    console.log(`[passkey-claim] preflight ok: ${stellarAmount} USDC → ${stellarRecipient} (${kind})`)

    // Step 3: claim on Arc — releases the gift to the EVM hot wallet.
    const arcTxHash = await claimOnArc(ephemeralAccount)
    console.log(`[passkey-claim] Arc claim tx: ${arcTxHash} (${formatUnits(amountWei, 18)} USDC)`)

    // Step 4: pay out on Stellar.
    let stellarTxHash: string
    try {
      stellarTxHash = await sendUsdcPayout(
        STELLAR_HOT_WALLET_SECRET,
        stellarRecipient,
        stroops,
        giftId ? `ScratchGift:${giftId.slice(0, 16)}` : 'ScratchAndSplit',
      )
    } catch (err) {
      // Funds are already released on Arc. Log everything ops needs to finish manually:
      //   bun scripts/stellar-payout.ts <recipient> <amount>
      const detail = err instanceof Error ? err.message : String(err)
      console.error(
        `[passkey-claim] PAYOUT_FAILED recipient=${stellarRecipient} amount=${stellarAmount} ` +
        `arcTxHash=${arcTxHash} ephemeralSigner=${ephemeralAccount.address} error=${detail}`,
      )
      throw new ClaimError(
        `Your gift was released on Arc but the Stellar payout failed (${detail}). ` +
        `Keep this reference and contact support: ${arcTxHash}`,
        502,
        { arcTxHash, recipient: stellarRecipient, amount: stellarAmount, payoutPending: true },
      )
    }
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
      return json({ error: err.message, ...err.extra }, err.status)
    }
    if (err instanceof StellarPayoutError) {
      console.error(`[passkey-claim] stellar ${err.code}: ${err.message}`)
      return json({ error: err.message, code: err.code }, STELLAR_STATUS[err.code])
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[passkey-claim] Error:', message)
    return json({ error: message }, 500)
  }
}
