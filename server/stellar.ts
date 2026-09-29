/**
 * server/stellar.ts — Stellar USDC payout from the hot wallet.
 *
 * Shared by api/passkey-claim.ts (Vercel function) and scripts/stellar-payout.ts
 * (manual recovery). Server-side only: never import from src/.
 *
 * Two recipient kinds:
 *   G... classic account  → Operation.payment (recipient needs a USDC trustline)
 *   C... Soroban contract → invoke the USDC Stellar Asset Contract (SAC)
 *                           `transfer(from, to, amount)` via Soroban RPC.
 *                           Passkey smart wallets are contracts, so this is the
 *                           path every passkey claim takes. Contract balances
 *                           need no trustline.
 *
 * Amounts are handled as stroops (bigint, 7 decimals) end to end so nothing is
 * rounded between Arc's 18-decimal USDC and Stellar's 7-decimal USDC.
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
  rpc,
  Contract,
  Address,
  StrKey,
  nativeToScVal,
  type Transaction,
} from '@stellar/stellar-sdk'

// ── Config ───────────────────────────────────────────────────────────────────
export const STELLAR_HORIZON = process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org'
export const SOROBAN_RPC     = process.env.STELLAR_RPC_URL     ?? 'https://soroban-testnet.stellar.org'
export const STELLAR_NETWORK = Networks.TESTNET
export const USDC_ISSUER     = process.env.STELLAR_USDC_ISSUER ?? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
export const USDC_ASSET      = new Asset('USDC', USDC_ISSUER)
/** Stellar Asset Contract address for USDC on this network (deterministic). */
export const USDC_SAC_ID     = USDC_ASSET.contractId(STELLAR_NETWORK)

export const STROOPS_PER_USDC = BigInt(10_000_000)

// ── Errors ───────────────────────────────────────────────────────────────────
export type StellarPayoutCode =
  | 'not_configured'
  | 'invalid_recipient'
  | 'recipient_missing'
  | 'no_trustline'
  | 'insufficient_funds'
  | 'simulation_failed'
  | 'submit_failed'

export class StellarPayoutError extends Error {
  constructor(message: string, public code: StellarPayoutCode) {
    super(message)
    this.name = 'StellarPayoutError'
  }
}

// ── Amount helpers ───────────────────────────────────────────────────────────
/** Arc 18-decimal native USDC → stroops, truncated (never over-pay). */
export function weiToStroops(amountWei: bigint): bigint {
  return (amountWei * STROOPS_PER_USDC) / BigInt(10) ** BigInt(18)
}

/** "1.5" → 15000000n. Rejects more than 7 decimals. */
export function usdcToStroops(amount: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount.trim())
  if (!m) throw new StellarPayoutError(`Invalid USDC amount: ${amount}`, 'invalid_recipient')
  return BigInt(m[1]) * STROOPS_PER_USDC + BigInt((m[2] ?? '').padEnd(7, '0'))
}

/** 15000000n → "1.5000000" (Horizon/classic-payment amount format). */
export function formatStroops(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_USDC
  const frac  = (stroops % STROOPS_PER_USDC).toString().padStart(7, '0')
  return `${whole}.${frac}`
}

// ── Recipient classification ─────────────────────────────────────────────────
export type RecipientKind = 'account' | 'contract'

export function classifyRecipient(address: string): RecipientKind {
  if (StrKey.isValidEd25519PublicKey(address)) return 'account'
  if (StrKey.isValidContract(address))         return 'contract'
  throw new StellarPayoutError(
    'stellarRecipient must be a valid G... account or C... contract address',
    'invalid_recipient',
  )
}

// ── Internals ────────────────────────────────────────────────────────────────
function hotKeypair(secret: string): Keypair {
  if (!secret) throw new StellarPayoutError('STELLAR_HOT_WALLET_SECRET not configured', 'not_configured')
  try { return Keypair.fromSecret(secret) }
  catch { throw new StellarPayoutError('STELLAR_HOT_WALLET_SECRET is not a valid S... secret', 'not_configured') }
}

function usdcBalanceStroops(account: Horizon.AccountResponse): bigint | null {
  const line = account.balances.find(
    (b) => 'asset_code' in b && b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER,
  )
  return line ? usdcToStroops(line.balance) : null
}

/** Ensure the hot wallet holds at least `stroops` USDC. */
async function assertHotWalletFunded(horizon: Horizon.Server, kp: Keypair, stroops: bigint): Promise<void> {
  const account = await horizon.loadAccount(kp.publicKey())
  const balance = usdcBalanceStroops(account)
  if (balance === null) {
    throw new StellarPayoutError('Payout wallet has no USDC trustline', 'not_configured')
  }
  if (balance < stroops) {
    console.error(`[stellar] hot wallet ${kp.publicKey()} has ${formatStroops(balance)} USDC, needs ${formatStroops(stroops)}`)
    throw new StellarPayoutError('Payout wallet has insufficient USDC — please contact support', 'insufficient_funds')
  }
}

/** Classic path: recipient account must exist and trust USDC. */
async function assertAccountCanReceive(horizon: Horizon.Server, recipient: string): Promise<void> {
  let account: Horizon.AccountResponse
  try {
    account = await horizon.loadAccount(recipient)
  } catch {
    throw new StellarPayoutError('Recipient Stellar account does not exist yet', 'recipient_missing')
  }
  if (usdcBalanceStroops(account) === null) {
    throw new StellarPayoutError('Recipient Stellar account has no USDC trustline', 'no_trustline')
  }
}

/** Build + simulate a SAC `transfer(from, to, amount)` ready to sign. */
async function buildSacTransfer(
  server: rpc.Server,
  kp: Keypair,
  recipient: string,
  stroops: bigint,
): Promise<Transaction> {
  const source   = await server.getAccount(kp.publicKey())
  const contract = new Contract(USDC_SAC_ID)

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK,
  })
    .addOperation(
      contract.call(
        'transfer',
        new Address(kp.publicKey()).toScVal(),
        new Address(recipient).toScVal(),
        nativeToScVal(stroops, { type: 'i128' }),
      ),
    )
    .setTimeout(60)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    const detail = sim.error ?? 'unknown simulation error'
    console.error('[stellar] SAC transfer simulation failed:', detail)
    if (/balance is not sufficient|insufficient/i.test(detail)) {
      throw new StellarPayoutError('Payout wallet has insufficient USDC — please contact support', 'insufficient_funds')
    }
    if (/does not exist|MissingValue|nonexistent/i.test(detail)) {
      throw new StellarPayoutError('Recipient smart wallet is not deployed yet', 'recipient_missing')
    }
    throw new StellarPayoutError(`Stellar transfer simulation failed: ${detail}`, 'simulation_failed')
  }

  return rpc.assembleTransaction(tx, sim).build()
}

/** Submit a signed Soroban tx and wait for it to land. Returns the tx hash. */
async function submitSoroban(server: rpc.Server, tx: Transaction): Promise<string> {
  const sent = await server.sendTransaction(tx)
  if (sent.status === 'ERROR') {
    const detail = sent.errorResult ? sent.errorResult.toXDR('base64') : 'unknown'
    throw new StellarPayoutError(`Stellar RPC rejected transaction: ${detail}`, 'submit_failed')
  }
  if (sent.status === 'TRY_AGAIN_LATER') {
    throw new StellarPayoutError('Stellar RPC is busy, please retry', 'submit_failed')
  }

  const result = await server.pollTransaction(sent.hash, { attempts: 30 })
  if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash
  if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new StellarPayoutError(`Stellar transfer failed on-chain: ${sent.hash}`, 'submit_failed')
  }
  // NOT_FOUND after polling — it may still land; surface the hash so ops can check.
  throw new StellarPayoutError(`Stellar transfer not confirmed yet: ${sent.hash}`, 'submit_failed')
}

// ── Public API ───────────────────────────────────────────────────────────────
/**
 * Cheap checks that the payout WILL succeed, without sending anything.
 * Call this before any irreversible step (e.g. the Arc claim).
 */
export async function preflightUsdcPayout(
  hotSecret: string,
  recipient: string,
  stroops: bigint,
): Promise<RecipientKind> {
  if (stroops <= BigInt(0)) throw new StellarPayoutError('Amount must be positive', 'invalid_recipient')
  const kind    = classifyRecipient(recipient)
  const kp      = hotKeypair(hotSecret)
  const horizon = new Horizon.Server(STELLAR_HORIZON)

  await assertHotWalletFunded(horizon, kp, stroops)

  if (kind === 'account') {
    await assertAccountCanReceive(horizon, recipient)
  } else {
    // Simulation validates the destination contract and the hot wallet balance.
    await buildSacTransfer(new rpc.Server(SOROBAN_RPC), kp, recipient, stroops)
  }
  return kind
}

/**
 * Send `stroops` USDC from the hot wallet to `recipient`. Returns the tx hash.
 * `memo` is only applied on the classic (G...) path.
 */
export async function sendUsdcPayout(
  hotSecret: string,
  recipient: string,
  stroops: bigint,
  memo?: string,
): Promise<string> {
  const kind = classifyRecipient(recipient)
  const kp   = hotKeypair(hotSecret)

  if (kind === 'contract') {
    const server = new rpc.Server(SOROBAN_RPC)
    const tx     = await buildSacTransfer(server, kp, recipient, stroops)
    tx.sign(kp)
    return submitSoroban(server, tx)
  }

  const horizon = new Horizon.Server(STELLAR_HORIZON)
  const account = await horizon.loadAccount(kp.publicKey())
  const builder = new TransactionBuilder(account, {
    fee: (parseInt(BASE_FEE) * 10).toString(),
    networkPassphrase: STELLAR_NETWORK,
  }).addOperation(
    Operation.payment({
      destination: recipient,
      asset: USDC_ASSET,
      amount: formatStroops(stroops),
    }),
  )
  if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)))
  builder.setTimeout(60)

  const tx = builder.build()
  tx.sign(kp)
  try {
    const result = await horizon.submitTransaction(tx)
    return result.hash
  } catch (err: unknown) {
    const codes = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
      .response?.data?.extras?.result_codes
    throw new StellarPayoutError(
      `Stellar payment failed: ${codes ? JSON.stringify(codes) : (err instanceof Error ? err.message : 'unknown')}`,
      'submit_failed',
    )
  }
}
