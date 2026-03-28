'use client'
import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { GlassCard } from '@/components/ui/GlassCard'
import { StatCard } from '@/components/ui/StatCard'
import { MOCK_USDT_ABI } from '@/lib/abis'
import { PhantomConnectButton } from '@/components/wallet/PhantomButton'
import { toast } from 'sonner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface TxRecord {
  hash: string
  from: string
  to: string
  value: string
  timeStamp: string
  isError: string
  functionName?: string
}

function TxHistoryTable({ txs }: { txs: TxRecord[] }) {
  if (!txs.length) {
    return (
      <p className="text-angora-muted text-sm text-center py-8">
        No transactions found for this wallet on Monad Testnet.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-angora-border text-left">
            <th className="pb-3 text-angora-muted font-medium text-xs uppercase tracking-wider">Hash</th>
            <th className="pb-3 text-angora-muted font-medium text-xs uppercase tracking-wider">To</th>
            <th className="pb-3 text-angora-muted font-medium text-xs uppercase tracking-wider">Value</th>
            <th className="pb-3 text-angora-muted font-medium text-xs uppercase tracking-wider">Status</th>
            <th className="pb-3 text-angora-muted font-medium text-xs uppercase tracking-wider">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-angora-border/50">
          {txs.slice(0, 20).map((tx) => (
            <tr key={tx.hash} className="hover:bg-angora-surface/30 transition-colors">
              <td className="py-3 pr-4">
                <a
                  href={`https://testnet.monadexplorer.com/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[#836EF9] hover:text-[#836EF9]/80 transition-colors"
                >
                  {tx.hash.slice(0, 10)}...
                </a>
              </td>
              <td className="py-3 pr-4">
                <span className="font-mono text-xs text-angora-muted">
                  {tx.to ? `${tx.to.slice(0, 8)}...` : '—'}
                </span>
              </td>
              <td className="py-3 pr-4">
                <span className="font-mono text-xs text-white">
                  {(parseFloat(tx.value) / 1e18).toFixed(4)} MON
                </span>
              </td>
              <td className="py-3 pr-4">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    tx.isError === '0'
                      ? 'bg-emerald-400/10 text-emerald-400'
                      : 'bg-red-400/10 text-red-400'
                  }`}
                >
                  {tx.isError === '0' ? 'OK' : 'Fail'}
                </span>
              </td>
              <td className="py-3">
                <span className="text-xs text-angora-muted">
                  {new Date(parseInt(tx.timeStamp) * 1000).toLocaleDateString()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function WalletPage() {
  const { address, isConnected } = useAccount()
  const { monBalance, usdtBalance, isOnMonad } = useWallet()
  const { writeContractAsync } = useWriteContract()
  const [isClaiming, setIsClaiming] = useState(false)

  const { data: txHistory = [], isLoading: txLoading } = useQuery<TxRecord[]>({
    queryKey: ['txHistory', address],
    queryFn: () =>
      fetch(`${API_URL}/api/wallet/history?address=${address}`).then((r) => r.json()),
    enabled: !!address && isConnected,
    refetchInterval: 30_000,
  })

  const handleFaucet = async () => {
    if (!address) return
    setIsClaiming(true)
    try {
      await writeContractAsync({
        address: process.env.NEXT_PUBLIC_MOCK_USDT as `0x${string}`,
        abi: MOCK_USDT_ABI,
        functionName: 'faucet',
        args: [address, BigInt(10_000 * 10 ** 6)],
      })
      toast.success('10,000 mUSDT claimed successfully!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('User rejected')) {
        toast.error('Transaction rejected in Phantom')
      } else {
        toast.error('Faucet failed — check console')
      }
    } finally {
      setIsClaiming(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Wallet</h1>
          <p className="text-angora-muted text-sm">Connect your Phantom wallet to view balances</p>
        </div>
        <PhantomConnectButton />
      </div>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-[#836EF9] uppercase tracking-widest">Wallet</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Wallet Dashboard</h1>
        <p className="text-angora-muted text-sm font-mono mt-1 break-all">{address}</p>
        {!isOnMonad && (
          <p className="text-yellow-400 text-xs mt-2">
            Switch to Monad Testnet (chain ID 10143) to see correct balances.
          </p>
        )}
      </div>

      {/* Balance Cards — StatCard with animated count-up + color glow (Section 5 spec) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 gap-4 mb-8"
      >
        <StatCard
          label="MON Balance"
          value={monBalance}
          unit="MON"
          color="#836EF9"
        />
        <StatCard
          label="mUSDT Balance"
          value={usdtBalance}
          unit="mUSDT"
          color="#34D399"
        />
      </motion.div>

      {/* Faucet Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <GlassCard className="p-5">
          <h2 className="text-white font-bold mb-1">Get Test Tokens</h2>
          <p className="text-angora-muted text-sm mb-4">
            Claim 10,000 mUSDT from the testnet faucet. Requires Phantom approval.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleFaucet}
              disabled={isClaiming}
              className="px-4 py-2 bg-[#836EF9] text-white rounded-lg text-sm font-semibold hover:bg-[#836EF9]/80 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isClaiming ? (
                <>
                  <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  Waiting for Phantom...
                </>
              ) : (
                'Claim 10k mUSDT → Phantom'
              )}
            </button>
            <a
              href="https://faucet.monad.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-angora-border rounded-lg text-angora-muted text-sm hover:border-[#836EF9]/50 hover:text-white transition-all"
            >
              Get MON ↗
            </a>
          </div>
        </GlassCard>
      </motion.div>

      {/* TX History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold">Transaction History</h2>
            <a
              href={`https://testnet.monadexplorer.com/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#836EF9] hover:text-[#836EF9]/80 transition-colors"
            >
              View on Explorer ↗
            </a>
          </div>
          {txLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-angora-surface/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <TxHistoryTable txs={Array.isArray(txHistory) ? txHistory : []} />
          )}
        </GlassCard>
      </motion.div>

      {/* Quick links */}
      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/agents" className="text-angora-muted hover:text-white transition-colors">
          ← My Agents
        </Link>
        <Link href="/create" className="text-angora-muted hover:text-white transition-colors">
          + New Agent
        </Link>
      </div>
    </main>
  )
}
