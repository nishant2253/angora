'use client'
import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { PhantomConnectButton } from '@/components/wallet/PhantomButton'
import { AgentCard } from '@/components/agents/AgentCard'
import { RunAllButton } from '@/components/agents/RunAllButton'
import type { AgentData } from '@/components/agents/AgentCard'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function AgentsPage() {
  const { address, isConnected } = useAccount()

  const { data: agents = [], refetch, isLoading } = useQuery<AgentData[]>({
    queryKey: ['agents', address],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/agents?owner=${address}`)
      if (!res.ok) throw new Error('Failed to fetch agents')
      return res.json()
    },
    enabled: !!address && isConnected,
    refetchInterval: 10_000,
  })

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Agent Control Panel</h1>
          <p className="text-angora-muted text-sm">Connect your Phantom wallet to manage your agents</p>
        </div>
        <PhantomConnectButton />
      </div>
    )
  }

  const activeCount = agents.filter((a) => a.active).length

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Control Panel</h1>
          <p className="text-angora-muted text-sm mt-1">
            {isLoading ? (
              'Loading…'
            ) : (
              <>
                <span className="text-white font-semibold">{agents.length}</span> agents ·{' '}
                <span className="text-emerald-400 font-semibold">{activeCount}</span> active
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {agents.length > 0 && (
            <RunAllButton agents={agents} onRefresh={() => refetch()} />
          )}
          <Link
            href="/create"
            className="py-2 px-4 rounded-lg text-sm font-semibold border border-angora-border text-angora-muted hover:text-white hover:border-white/30 transition-all"
          >
            + New Agent
          </Link>
        </div>
      </div>

      {/* Agent grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl bg-angora-surface/40 animate-pulse border border-angora-border"
            />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-angora-surface border border-angora-border flex items-center justify-center text-2xl">
            🤖
          </div>
          <div>
            <p className="text-white font-semibold">No agents yet</p>
            <p className="text-angora-muted text-sm mt-1">Deploy your first AI trading agent to get started</p>
          </div>
          <Link
            href="/create"
            className="py-2 px-6 rounded-lg text-sm font-semibold bg-angora-primary hover:bg-angora-primary/90 text-white transition-all"
          >
            Create Agent
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3 }}
            >
              <AgentCard agent={agent} onRefresh={() => refetch()} />
            </motion.div>
          ))}
        </div>
      )}
    </main>
  )
}
