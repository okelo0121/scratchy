import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const scratchContract = env.VITE_SCRATCH_CONTRACT || '0xB049c84b48C0F57eD2FCa32131E16036eaDcE6A7'

  return {
    define: {
      'import.meta.env.VITE_SCRATCH_CONTRACT': JSON.stringify(scratchContract),
      'import.meta.env.VITE_SCRATCH_CONTRACT_V3': JSON.stringify(scratchContract),
    },
    plugins: [react(), nodePolyfills()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@tanstack/react-query',
        'wagmi',
        'wagmi/chains',
        'wagmi/connectors',
        'viem',
        'viem/chains',
        'connectkit',
        'framer-motion',
        'lucide-react',
        'sonner',
        'clsx',
        'tailwind-merge',
        'vite-plugin-node-polyfills/shims/buffer',
        'vite-plugin-node-polyfills/shims/global',
        'vite-plugin-node-polyfills/shims/process',
      ],
    },
    server: {
      allowedHosts: true,
      cors: true,
      proxy: {
        '/api/arc-explorer': {
          target: 'https://explorer.testnet.arc.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/arc-explorer/, ''),
        },
      },
    },
  }
})
