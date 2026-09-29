/**
 * stellar-payout.ts — manually send USDC from the Stellar hot wallet.
 *
 * Use this to complete a payout that /api/passkey-claim logged as
 * PAYOUT_FAILED (gift already released on Arc, recipient got nothing).
 * Works for both C... passkey smart wallets and G... classic accounts.
 *
 * Usage:
 *   bun scripts/stellar-payout.ts <recipient C...|G...> <amount USDC> [memo]
 *
 * Reads STELLAR_HOT_WALLET_SECRET from the environment (.env.local is
 * auto-loaded by bun). Optional: STELLAR_RPC_URL, STELLAR_HORIZON_URL,
 * STELLAR_USDC_ISSUER.
 *
 * Example:
 *   bun scripts/stellar-payout.ts CABC…XYZ 1.00 "ScratchGift:recovery"
 */

import {
  preflightUsdcPayout,
  sendUsdcPayout,
  usdcToStroops,
  formatStroops,
  StellarPayoutError,
  USDC_SAC_ID,
} from '../server/stellar.js'

async function main() {
  const [recipient, amount, memo] = process.argv.slice(2)
  if (!recipient || !amount) {
    console.error('Usage: bun scripts/stellar-payout.ts <recipient C...|G...> <amount USDC> [memo]')
    process.exit(1)
  }

  const secret = process.env.STELLAR_HOT_WALLET_SECRET ?? ''
  if (!secret) {
    console.error('STELLAR_HOT_WALLET_SECRET is not set')
    process.exit(1)
  }

  const stroops = usdcToStroops(amount)
  console.log(`Recipient : ${recipient}`)
  console.log(`Amount    : ${formatStroops(stroops)} USDC`)
  console.log(`USDC SAC  : ${USDC_SAC_ID}`)

  const kind = await preflightUsdcPayout(secret, recipient, stroops)
  console.log(`Preflight : ok (${kind})`)

  const hash = await sendUsdcPayout(secret, recipient, stroops, memo)
  console.log(`Tx hash   : ${hash}`)
  console.log(`Explorer  : https://stellar.expert/explorer/testnet/tx/${hash}`)
}

main().catch((err: unknown) => {
  if (err instanceof StellarPayoutError) {
    console.error(`Payout failed [${err.code}]: ${err.message}`)
  } else {
    console.error('Payout failed:', err instanceof Error ? err.message : err)
  }
  process.exit(1)
})
