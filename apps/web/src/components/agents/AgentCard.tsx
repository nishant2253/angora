'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { GlassCard } from '@/components/ui/GlassCard'
import { SignalBadge } from '@/components/ui/SignalBadge'
import { CountdownTimer } from './CountdownTimer'
import { IntervalSelector } from './IntervalSelector'
import type { Interval } from './IntervalSelector'
import { AGENT_REGISTRY_ABI } from '@/lib/abis'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface AgentData {
  id: string
  ownerAddress: string
  strategyType: string
  active: boolean
  cronInterval: string
  nextRunAt: string | null
  lastRunAt: string | null
  createdAt: string
  executions: Array<{
    signal: string
    confidence: number
    price: number
    createdAt: string
  }>
}

interface AgentCardProps {
  agent: AgentData
  onRefresh?: () => void
}

export function AgentCard({ agent, onRefresh }: AgentCardProps) {
  const router = useRouter()
  const { writeContractAsync } = useWriteContract()
  const [loading, setLoading] = useState(false)
  const [intervalLoading, setIntervalLoading] = useState(false)

  const latestExecution = agent.executions[0]

  const handleRunNow = async () => {
    setLoading(true)
    const toastId = toast.loading('Waiting for Phantom approval…')
    try {
      // 1. Sign logExecution on-chain (Phantom popup)
      const price = latestExecution?.price
        ? BigInt(Math.round(latestExecution.price * 1e8))
        : BigInt(0)

      const txHash = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_AGENT_REGISTRY as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'logExecution',
        args: [agent.id, latestExecution?.signal ?? 'HOLD', price],
      })

      // 2. Fire the backend trigger — pass txHash for optional on-chain verification (Section 4.2)
      const res = await fetch(`${API_URL}/api/agents/${agent.id}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      })
      const result = await res.json()

      toast.dismiss(toastId)

      if (result.signal) {
        const confidence = result.confidence ?? 0
        toast.success(`${result.signal} · ${confidence}% confidence`, {
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
      setLoading(false)
    }
  }

  const handleIntervalChange = async (interval: Interval) => {
    setIntervalLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/agents/${agent.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success(`Schedule updated to ${interval}`)
      onRefresh?.()
    } catch (err) {
      toast.error(`Failed to update schedule: ${(err as Error).message}`)
    } finally {
      setIntervalLoading(false)
    }
  }

  const handlePause = async () => {
    try {
      await fetch(`${API_URL}/api/agents/${agent.id}/pause`, { method: 'POST' })
      toast.info('Agent paused')
      onRefresh?.()
    } catch {
      toast.error('Failed to pause agent')
    }
  }

  const handleResume = async () => {
    try {
      await fetch(`${API_URL}/api/agents/${agent.id}/resume`, { method: 'POST' })
      toast.success('Agent resumed')
      onRefresh?.()
    } catch {
      toast.error('Failed to resume agent')
    }
  }

  return (
    <GlassCard hover className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full shrink-0 mt-0.5',
              agent.active ? 'bg-emerald-400 animate-pulse' : 'bg-angora-muted'
            )}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{agent.strategyType}</p>
            <p className="text-xs text-angora-muted font-mono truncate">{agent.id.slice(0, 16)}…</p>
          </div>
        </div>
        {latestExecution && (
          <SignalBadge signal={latestExecution.signal as 'BUY' | 'SELL' | 'HOLD'} />
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-angora-muted">
        {latestExecution && (
          <>
            <span>Confidence: <span className="text-white">{latestExecution.confidence}%</span></span>
            <span>Price: <span className="text-white">${latestExecution.price.toFixed(2)}</span></span>
          </>
        )}
        {agent.nextRunAt && (
          <span className="ml-auto flex items-center gap-1">
            Next: <CountdownTimer nextRunAt={agent.nextRunAt} />
          </span>
        )}
      </div>

      {/* Interval selector */}
      <IntervalSelector
        value={agent.cronInterval}
        onChange={handleIntervalChange}
        disabled={intervalLoading || !agent.active}
      />

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleRunNow}
          disabled={loading}
          className={cn(
            'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
            'bg-angora-primary hover:bg-angora-primary/90 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {loading ? 'Running…' : 'Run Now'}
        </button>

        {agent.active ? (
          <button
            onClick={handlePause}
            className="py-2 px-3 rounded-lg text-xs font-semibold border border-angora-border text-angora-muted hover:text-white hover:border-white/30 transition-all"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={handleResume}
            className="py-2 px-3 rounded-lg text-xs font-semibold border border-emerald-700 text-emerald-400 hover:bg-emerald-950 transition-all"
          >
            Resume
          </button>
        )}

        <button
          onClick={() => router.push(`/dashboard/${agent.id}`)}
          className="py-2 px-3 rounded-lg text-xs font-semibold border border-angora-border text-angora-muted hover:text-white hover:border-white/30 transition-all"
        >
          Dashboard →
        </button>
      </div>
    </GlassCard>
  )
}
