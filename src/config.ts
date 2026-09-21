/**
 * wagmi configuration — Privy-compatible
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, fallback } from 'wagmi'
import { createConfig } from '@privy-io/wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet, arc } from 'viem/chains'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs for trace events
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
const arcMainnetRpc = (arc.rpcUrls.default.http as readonly string[])[0] ?? 'https://rpc.mainnet.arc.io'
registerChain(arc.id, arcMainnetRpc)

const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined

// Alchemy primary + fallback providers for both Arc Testnet and Arc Mainnet
export const config = createConfig({
  chains: [arcTestnet, arc, mainnet],
  transports: {
    [arcTestnet.id]: fallback([
      ...(alchemyKey ? [http(`https://arc-testnet.g.alchemy.com/v2/${alchemyKey}`)] : []),
      http('https://rpc.drpc.testnet.arc.io'),
      http('https://rpc.quicknode.testnet.arc.io'),
      http('https://rpc.blockdaemon.testnet.arc.io'),
      http('https://rpc.testnet.arc.io'),
    ]),
    [arc.id]: fallback([
      ...(alchemyKey ? [http(`https://arc-mainnet.g.alchemy.com/v2/${alchemyKey}`)] : []),
      http('https://rpc.mainnet.arc.io'),
    ]),
    [mainnet.id]: http(),
  },
})
