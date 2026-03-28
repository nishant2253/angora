'use client'
import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { formatUnits } from 'viem'
import { motion } from 'framer-motion'
import { monadTestnet } from '@/lib/wagmi'

export function PhantomConnectButton() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: balance } = useBalance({
    address,
    chainId: monadTestnet.id,
  })

  const isWrongNetwork = isConnected && chainId !== monadTestnet.id

  // Wrong network state
  if (isWrongNetwork) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => switchChain({ chainId: monadTestnet.id })}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-800 bg-red-950/60 backdrop-blur-sm hover:border-red-600/60 transition-all duration-200"
      >
        <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        <span className="text-red-400 font-mono text-sm">Wrong Network</span>
      </motion.button>
    )
  }

  // Connected state
  if (isConnected && address) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => disconnect()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2D1B69] bg-[#0D0020]/80 backdrop-blur-sm hover:border-[#836EF9]/50 transition-all duration-200"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[#C4B5FD] font-mono text-sm">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <span className="text-[#9CA3AF] text-xs">
          {balance ? parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(3) : '0.000'} MON
        </span>
      </motion.button>
    )
  }

  // Disconnected state
  return (
    <motion.button
      whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(131,110,249,0.3)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => connect({ connector: injected() })}
      disabled={isPending}
      className="relative px-5 py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-[#836EF9] to-[#5A4AB0] text-white hover:from-[#9B87FF] hover:to-[#6B5BC0] transition-all disabled:opacity-50 overflow-hidden"
    >
      <span className="relative z-10">
        {isPending ? 'Connecting...' : 'Connect Phantom'}
      </span>
      {/* Shimmer animation */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
        animate={{ x: [-200, 300] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
      />
    </motion.button>
  )
}
