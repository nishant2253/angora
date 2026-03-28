'use client'
import { useState } from 'react'
import { useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { CountdownTimer } from './CountdownTimer'
import { AGENT_REGISTRY_ABI } from '@/lib/abis'
import type { AgentData } from './AgentCard'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AgentTriggerPanelProps {
  agentId: string
  agent?: AgentData | null
  onRefresh?: () => void
}

export function AgentTriggerPanel({ agentId, agent, onRefresh }: AgentTriggerPanelProps) {
  const { writeContractAsync } = useWriteContract()
  const [isTriggering, setIsTriggering] = useState(false)

  const handleRunNow = async () => {
    setIsTriggering(true)
    const toastId = toast.loading('Waiting for Phantom approval…')
    try {
      const latestExecution = agent?.executions?.[0]
      const price = latestExecution?.price
        ? BigInt(Math.round(latestExecution.price * 1e8))
        : BigInt(0)

      const txHash = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_AGENT_REGISTRY as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'logExecution',
        args: [agentId, latestExecution?.signal ?? 'HOLD', price],
      })

      // Pass txHash for optional on-chain verification (Section 4.2)
      const res = await fetch(`${API_URL}/api/agents/${agentId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      })
      const result = await res.json()

      toast.dismiss(toastId)

      if (result.signal) {
        toast.success(`${result.signal} · ${result.confidence ?? 0}% confidence`, {
          description: result.reasoning?.slice(0, 80) ?? '',
          duration: 6000,
        })
      } else {
        toast.success(`Triggered · tx: ${txHash.slice(0, 10)}…`)
      }

      onRefresh?.()
    } catch (err: unknown) {
      toast.dismiss(toastId)
      const msg = (err as Error)?.message ?? String(err)
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied')) {
        toast.error('Transaction rejected in Phantom')
      } else {
        toast.error(`Error: ${msg.slice(0, 80)}`)
      }
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Countdown — only when agent is active and has a scheduled next run */}
      {agent?.active && agent?.nextRunAt && (
        <div className="text-right">
          <p className="text-xs text-angora-muted">Next auto-run</p>
          <CountdownTimer nextRunAt={agent.nextRunAt} />
        </div>
      )}

      <button
        onClick={handleRunNow}
        disabled={isTriggering}
        className="px-4 py-2 bg-angora-primary text-white rounded-lg text-sm font-semibold hover:bg-angora-primary-dim disabled:opacity-50 transition-all flex items-center gap-2"
      >
        {isTriggering ? (
          <>
            <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            Waiting...
          </>
        ) : (
          'Run Now'
        )}
      </button>
    </div>
  )
}
