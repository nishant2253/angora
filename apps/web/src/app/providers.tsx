'use client'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { wagmiConfig, queryClient } from '@/lib/wagmi'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster theme="dark" position="top-right" richColors closeButton />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
