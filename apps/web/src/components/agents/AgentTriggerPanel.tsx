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

type Step =
  | 'idle'
  | 'phantom'
  | 'ai'
  | 'saving'

const STEP_LABELS: Record<Step, string> = {
  idle: 'Run Now',
  phantom: '1/3 Phantom signing…',
  ai: '2/3 AI thinking…',
  saving: '3/3 Saving…',
}

export function AgentTriggerPanel({ agentId, agent, onRefresh }: AgentTriggerPanelProps) {
  const { writeContractAsync } = useWriteContract()
  const [step, setStep] = useState<Step>('idle')

  const handleRunNow = async () => {
    setStep('phantom')
    const toastId = toast.loading('Step 1/3 — Waiting for Phantom approval…')

    try {
      // ── Step 1: Phantom signs the on-chain logExecution ───────────────────
      const latestExecution = agent?.executions?.[0]
      const price = latestExecution?.price
        ? BigInt(Math.round(latestExecution.price * 1e8))
        : BigInt(0)

      console.log('[RunNow] Step 1: requesting Phantom signature…', {
        agentId,
        signal: latestExecution?.signal ?? 'HOLD',
        price: price.toString(),
      })

      const txHash = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_AGENT_REGISTRY as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'logExecution',
        args: [agentId, latestExecution?.signal ?? 'HOLD', price],
      })

      console.log('[RunNow] Step 1: Phantom confirmed ✓ txHash=', txHash)
      toast.dismiss(toastId)

      // ── Step 2: Backend AI cycle ──────────────────────────────────────────
      setStep('ai')
      const aiToastId = toast.loading('Step 2/3 — AI agent thinking…', {
        description: 'Fetching live price + running Gemini decision…',
      })

      console.log('[RunNow] Step 2: calling backend trigger API…')
      const res = await fetch(`${API_URL}/api/agents/${agentId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      })

      toast.dismiss(aiToastId)

      const result = await res.json()
      console.log('[RunNow] Step 2: backend response →', result)

      if (!res.ok) {
        throw new Error(result.error ?? `HTTP ${res.status}`)
      }

      // ── Step 3: Refresh dashboard ─────────────────────────────────────────
      setStep('saving')
      const saveToastId = toast.loading('Step 3/3 — Refreshing dashboard…')
      console.log('[RunNow] Step 3: refreshing executions…')

      onRefresh?.()

      toast.dismiss(saveToastId)

      // ── Done ──────────────────────────────────────────────────────────────
      const signalEmoji = result.signal === 'BUY' ? '🟢' : result.signal === 'SELL' ? '🔴' : '🟡'
      toast.success(
        `${signalEmoji} ${result.signal ?? 'Done'} · ${result.confidence ?? 0}% confidence`,
        {
          description: result.reasoning?.slice(0, 100) ?? `price $${result.price?.toFixed(2) ?? '—'}`,
          duration: 8000,
        }
      )

      console.log('[RunNow] Complete ✓', {
        signal: result.signal,
        confidence: result.confidence,
        price: result.price,
        txHash: result.txHash,
      })
    } catch (err: unknown) {
      toast.dismiss()
      const msg = (err as Error)?.message ?? String(err)
      console.error('[RunNow] Error:', msg)

      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('user rejected')) {
        toast.error('Transaction rejected in Phantom')
      } else if (msg.toLowerCase().includes('inactive')) {
        toast.error('Agent is paused — activate it first')
      } else if (msg.toLowerCase().includes('not found')) {
        toast.error('Agent not found — try refreshing the page')
      } else {
        toast.error(`Run Now failed: ${msg.slice(0, 100)}`)
      }
    } finally {
      setStep('idle')
    }
  }

  const isRunning = step !== 'idle'

  return (
    <div className="flex items-center gap-4">
      {/* Countdown — only when agent is active and has a scheduled next run */}
      {agent?.active && agent?.nextRunAt && (
        <div className="text-right">
          <p className="text-xs text-angora-muted">Next auto-run</p>
          <CountdownTimer nextRunAt={agent.nextRunAt} />
        </div>
      )}

      <div className="flex flex-col items-end gap-1">
        <button
          onClick={handleRunNow}
          disabled={isRunning}
          className="px-4 py-2 bg-angora-primary text-white rounded-lg text-sm font-semibold hover:bg-angora-primary-dim disabled:opacity-50 transition-all flex items-center gap-2 min-w-[160px] justify-center"
        >
          {isRunning ? (
            <>
              <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              {STEP_LABELS[step]}
            </>
          ) : (
            'Run Now'
          )}
        </button>
        {isRunning && (
          <p className="text-xs text-angora-muted font-mono">
            {step === 'phantom' && 'Check Phantom wallet…'}
            {step === 'ai' && 'AI cycle running (~5–10 s)…'}
            {step === 'saving' && 'Saving result…'}
          </p>
        )}
      </div>
    </div>
  )
}
