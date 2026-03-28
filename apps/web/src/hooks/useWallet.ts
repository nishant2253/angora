'use client'
import { useAccount, useBalance, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { monadTestnet } from '@/lib/wagmi'

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export function useWallet() {
  const { address, isConnected, chainId } = useAccount()

  const { data: monBalance } = useBalance({
    address,
    chainId: monadTestnet.id,
  })

  const { data: usdtRaw } = useReadContract({
    address: process.env.NEXT_PUBLIC_MOCK_USDT as `0x${string}`,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: monadTestnet.id,
    query: { enabled: !!address && isConnected },
  })

  return {
    address,
    isConnected,
    chainId,
    isOnMonad: chainId === monadTestnet.id,
    monBalance: monBalance
      ? parseFloat(formatUnits(monBalance.value, monBalance.decimals)).toFixed(4)
      : '0.0000',
    usdtBalance: usdtRaw
      ? parseFloat(formatUnits(usdtRaw as bigint, 6)).toFixed(2)
      : '0.00',
  }
}
