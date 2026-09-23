/*
 *  ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗
 *  ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
 *  ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
 *  ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝
 *
 *  Built with Arc Studio
 *  https://studio.arc.io
 */

import './tracing'
import './console-capture'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { arcTestnet } from 'viem/chains'
import { config } from './config'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

// Studio logo SVG
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID as string}
      config={{
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        appearance: {
          theme: 'light',
          accentColor: '#A78BFA',
          logo: 'https://em-content.zobj.net/source/google/387/owl_1f989.png',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <App />
          <Toaster position="top-center" richColors />
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  </StrictMode>,
)
