/**
 * setup-stellar-wallet.ts
 *
 * Run ONCE to generate a Stellar hot wallet keypair,
 * fund it via Friendbot, and establish a USDC trustline.
 *
 * Usage:
 *   bun scripts/setup-stellar-wallet.ts
 *
 * Output: prints G... and S... — add them to .env and Netlify dashboard.
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from '@stellar/stellar-sdk'
import { Horizon } from '@stellar/stellar-sdk'

// Circle-issued USDC on Stellar Testnet
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const USDC_ASSET = new Asset('USDC', USDC_ISSUER)
const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const FRIENDBOT_URL = 'https://friendbot.stellar.org'

async function main() {
  // ── 1. Generate keypair ──────────────────────────────────────────────────
  const keypair = Keypair.random()
  const publicKey = keypair.publicKey()
  const secretKey = keypair.secret()

  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║   Stellar Hot Wallet Keypair Generated   ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log(`\nPublic key : ${publicKey}`)
  console.log(`Secret key : ${secretKey}`)
  console.log('\n─── Add these to your .env AND Netlify dashboard ───')
  console.log(`STELLAR_HOT_WALLET_PUBLIC=${publicKey}`)
  console.log(`STELLAR_HOT_WALLET_SECRET=${secretKey}`)

  // ── 2. Fund via Friendbot ────────────────────────────────────────────────
  console.log('\nFunding via Friendbot (testnet XLM)...')
  const fbRes = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`)
  if (!fbRes.ok) {
    const body = await fbRes.text()
    if (!body.includes('createAccountAlreadyExist')) {
      throw new Error(`Friendbot failed: ${body}`)
    }
    console.log('  Already funded — continuing.')
  } else {
    console.log('  ✓ Funded with 10,000 testnet XLM.')
  }

  // ── 3. Establish USDC trustline ──────────────────────────────────────────
  console.log('Establishing USDC trustline...')
  const horizon = new Horizon.Server(HORIZON_URL)
  const account = await horizon.loadAccount(publicKey)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset: USDC_ASSET,
        limit: '999999999',
      })
    )
    .setTimeout(30)
    .build()

  tx.sign(keypair)
  const result = await horizon.submitTransaction(tx)
  console.log(`  ✓ USDC trustline established. Tx: ${result.hash}`)

  // ── 4. Summary ───────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║                  Done!                   ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log(`\nStellar Expert: https://stellar.expert/explorer/testnet/account/${publicKey}`)
  console.log('\nNext steps:')
  console.log('  1. Copy STELLAR_HOT_WALLET_PUBLIC and STELLAR_HOT_WALLET_SECRET into .env')
  console.log('  2. Add both to Netlify dashboard → Site settings → Environment variables')
  console.log('  3. Also add OZ_RELAYER_API_KEY to Netlify dashboard (server-side only)')
}

main().catch((err) => {
  console.error('Setup failed:', err)
  process.exit(1)
})
