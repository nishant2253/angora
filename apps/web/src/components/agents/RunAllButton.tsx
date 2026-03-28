'use client'
import { useState } from 'react'
import { useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { AGENT_REGISTRY_ABI } from '@/lib/abis'
import { cn } from '@/lib/utils'
import type { AgentData } from './AgentCard'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface RunAllButtonProps {
  agents: AgentData[]
  onRefresh?: () => void
  className?: string
}

export function RunAllButton({ agents, onRefresh, className }: RunAllButtonProps) {
  const { writeContractAsync } = useWriteContract()
  const [loading, setLoading] = useState(false)

  const activeAgents = agents.filter((a) => a.active)

  const handleRunAll = async () => {
    if (activeAgents.length === 0) {
      toast.info('No active agents to run')
      return
    }

    setLoading(true)
    const toastId = toast.loading(`Approve in Phantom to run ${activeAgents.length} agents…`)

    try {
      // Single on-chain approval using first active agent
      const first = activeAgents[0]
      const price = first.executions[0]?.price
        ? BigInt(Math.round(first.executions[0].price * 1e8))
        : BigInt(0)

      // Single Phantom approval — batch marker tx (Section 4, Run All flow)
      const batchTxHash = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_AGENT_REGISTRY as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'logExecution',
        args: [first.id, first.executions[0]?.signal ?? 'HOLD', price],
      })

      // Trigger all agents in parallel — pass batch txHash so the API can audit the trigger (Section 4.2)
      const results = await Promise.allSettled(
        activeAgents.map((agent) =>
          fetch(`${API_URL}/api/agents/${agent.id}/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txHash: batchTxHash }),
          }).then((r) => r.json())
        )
      )

      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - succeeded

      toast.dismiss(toastId)
      toast.success(`${succeeded}/${activeAgents.length} agents executed`, {
        description: failed > 0 ? `${failed} failed` : undefined,
        duration: 5000,
      })

      onRefresh?.()
    } catch (err: unknown) {
      toast.dismiss(toastId)
      const msg = (err as Error)?.message ?? String(err)
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied')) {
        toast.error('Transaction rejected in Phantom')
      } else {
        toast.error(`Run All failed: ${msg.slice(0, 80)}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRunAll}
      disabled={loading || activeAgents.length === 0}
      className={cn(
        'py-2 px-4 rounded-lg text-sm font-semibold transition-all',
        'bg-angora-primary hover:bg-angora-primary/90 text-white',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'shadow-glow-primary',
        className
      )}
    >
      {loading ? 'Running…' : `Run All (${activeAgents.length})`}
    </button>
  )
}
