'use client'
import { createConfig, http, injected } from 'wagmi'
import { defineChain } from 'viem'
import { QueryClient } from '@tanstack/react-query'

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
})

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()], // Phantom auto-detected via EIP-6963
  transports: { [monadTestnet.id]: http() },
  ssr: true,
})

export const queryClient = new QueryClient()
