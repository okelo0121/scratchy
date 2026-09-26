/**
 * POST /api/claim
 *
 * Gasless gift claim — the server pays Arc gas from the EVM hot wallet.
 * Recipients need ZERO funds to claim their gift.
 *
 * Body: { ephemeralKeyHex: string, recipientAddress: string }
 * Returns: { txHash: string, amount: string }
 *
 * Chain: Arc Testnet (5042002). RPC from VITE_ALCHEMY_API_KEY env var.
 * Contract: VITE_SCRATCH_CONTRACT_V3 env var.
 * Hot wallet: EVM_HOT_WALLET_KEY env var (server-side only, no VITE_ prefix).
 */
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { defineChain } from 'viem'

// Arc Testnet — chain ID 5042002 // arc-studio-allow-onchain-literal
const ARC_TESTNET = defineChain({
  id: 5042002, // arc-studio-allow-onchain-literal
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.VITE_ALCHEMY_API_KEY
          ? `https://arc-testnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_API_KEY}`
          : 'https://rpc.testnet.arc.network', // arc-studio-allow-onchain-literal
      ],
    },
  },
})

const CONTRACT_ADDRESS = (
  process.env.VITE_SCRATCH_CONTRACT_V3 ??
  process.env.VITE_SCRATCH_CONTRACT
) as `0x${string}` | undefined

const CLAIM_ABI = parseAbi([
  'function claimGift(address recipient, address ephemeralSigner, uint64 deadline, bytes signature) external',
  'function getGift(address ephemeralSigner) external view returns (address sender, uint256 amount, uint64 expiresAt, bool claimed)',
])

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { ephemeralKeyHex, recipientAddress } = await req.json() as {
      ephemeralKeyHex?: string
      recipientAddress?: string
    }

    if (!ephemeralKeyHex || !recipientAddress) {
      return Response.json(
        { error: 'ephemeralKeyHex and recipientAddress are required' },
        { status: 400, headers: CORS }
      )
    }

    const hotWalletKey = process.env.EVM_HOT_WALLET_KEY as `0x${string}` | undefined
    if (!hotWalletKey) {
      return Response.json(
        { error: 'Server not configured (EVM_HOT_WALLET_KEY missing)' },
        { status: 503, headers: CORS }
      )
    }

    if (!CONTRACT_ADDRESS) {
      return Response.json(
        { error: 'Server not configured (VITE_SCRATCH_CONTRACT missing)' },
        { status: 503, headers: CORS }
      )
    }

    // Build the ephemeral key account (the gift's signer)
    const ephemeralKey = (ephemeralKeyHex.startsWith('0x')
      ? ephemeralKeyHex
      : `0x${ephemeralKeyHex}`) as `0x${string}`

    const ephemeralAccount = privateKeyToAccount(ephemeralKey)
    const hotAccount       = privateKeyToAccount(hotWalletKey)

    const publicClient = createPublicClient({ chain: ARC_TESTNET, transport: http() })
    const walletClient = createWalletClient({ chain: ARC_TESTNET, transport: http(), account: hotAccount })

    // Read gift details — amount + expiry + claimed status
    const [, amount, expiresAt, claimed] = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CLAIM_ABI,
      functionName: 'getGift',
      args: [ephemeralAccount.address],
    })

    if (claimed) {
      return Response.json(
        { error: 'Gift has already been claimed' },
        { status: 409, headers: CORS }
      )
    }

    // Sign the EIP-712 claim authorisation with the ephemeral key
    // The contract verifies: ECDSA.recover(hash, signature) == ephemeralSigner
    const domain = {
      name: 'ScratchAndSplit',
      version: '1',
      chainId: ARC_TESTNET.id,
      verifyingContract: CONTRACT_ADDRESS,
    } as const

    const types = {
      ClaimGift: [
        { name: 'recipient',       type: 'address' },
        { name: 'ephemeralSigner', type: 'address' },
        { name: 'deadline',        type: 'uint64'  },
      ],
    } as const

    const message = {
      recipient:       recipientAddress as `0x${string}`,
      ephemeralSigner: ephemeralAccount.address,
      deadline:        expiresAt,
    } as const

    const signature = await ephemeralAccount.signTypedData({
      domain, types, primaryType: 'ClaimGift', message,
    })

    // Submit from the hot wallet — hot wallet pays gas, recipient needs nothing
    const data = encodeFunctionData({
      abi: CLAIM_ABI,
      functionName: 'claimGift',
      args: [
        recipientAddress as `0x${string}`,
        ephemeralAccount.address,
        expiresAt,
        signature,
      ],
    })

    const txHash = await walletClient.sendTransaction({
      to:  CONTRACT_ADDRESS,
      data,
      gas: BigInt(0x2BF20), // 180 000 gas — enough for claimGift
    })

    // Wait for on-chain confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    // Arc native USDC has 18 decimals
    const amountUsdc = (Number(amount) / 1e18).toFixed(6)

    return Response.json({ txHash, amount: amountUsdc }, { status: 200, headers: CORS })

  } catch (err: unknown) {
    console.error('[claim] error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: msg }, { status: 500, headers: CORS })
  }
}
