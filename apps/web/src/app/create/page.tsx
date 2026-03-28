'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useWriteContract } from 'wagmi'
import { useWallet } from '@/hooks/useWallet'
import { GlassCard } from '@/components/ui/GlassCard'
import { AGENT_REGISTRY_ABI } from '@/lib/abis'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentConfig {
  name: string
  strategyType: string
  asset: string
  timeframe: string
  indicators: {
    ema?: { fast: number; slow: number }
    rsi?: { period: number; oversold: number; overbought: number }
  }
  risk: {
    maxPositionPct: number
    stopLossPct: number
    takeProfitPct: number
  }
}

interface BuildResult {
  config: AgentConfig
  configHash: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const EXAMPLE_STRATEGIES = [
  'EMA crossover 20/60 on MON/USDT, 3% stop loss, 8% take profit',
  'RSI mean reversion — buy below 30, sell above 70, 1h timeframe',
  'Momentum breakout BTC/USDT daily, 5% position, tight 2% stop',
]

const STEP_LABELS = ['Describe', 'Review', 'Done']

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 ${
              step === i ? 'text-angora-primary' : 'text-angora-muted'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full border text-xs grid place-items-center font-bold transition-colors ${
                step === i
                  ? 'border-angora-primary text-angora-primary'
                  : step > i
                  ? 'border-angora-success bg-angora-success/10 text-angora-success'
                  : 'border-angora-border text-angora-muted'
              }`}
            >
              {step > i ? '✓' : i + 1}
            </div>
            <span className="text-sm hidden sm:block">{label}</span>
          </div>
          {i < 2 && <div className="w-8 h-px bg-angora-border" />}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const [step, setStep] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [agentId, setAgentId] = useState('')
  const [txHash, setTxHash] = useState('')
  const [building, setBuilding] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState('')

  const { isConnected, address } = useWallet()
  const { writeContractAsync } = useWriteContract()

  // ── Step 1: Build config with Gemini ────────────────────────────────────────

  const handleBuild = async () => {
    if (!prompt.trim()) return
    setBuilding(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/agents/build-from-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data: BuildResult = await res.json()
      setBuildResult(data)
      setStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build config')
    } finally {
      setBuilding(false)
    }
  }

  // ── Step 2: Deploy on-chain via Phantom + persist to DB ──────────────────────

  const handleDeploy = async () => {
    if (!buildResult || !address) return
    setDeploying(true)
    setError('')

    // Generate the agent ID here so the same ID is used both on-chain
    // (Phantom registerAgent call) and in the DB (backend /deploy call).
    const newAgentId = crypto.randomUUID()

    try {
      // 1. Sign + submit registerAgent via Phantom
      const hash = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_AGENT_REGISTRY as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'registerAgent',
        args: [
          newAgentId,
          buildResult.configHash as `0x${string}`,
          buildResult.config.strategyType,
        ],
      })

      // 2. Persist to DB — AWAITED so we catch failures, and we send the
      //    same newAgentId so the DB record matches the on-chain ID.
      const deployRes = await fetch(`${API_URL}/api/agents/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: newAgentId,
          prompt,
          ownerAddress: address,
          txHash: hash,
        }),
      })

      if (!deployRes.ok) {
        const err = await deployRes.json().catch(() => ({}))
        throw new Error(err.error ?? `Backend deploy failed (${deployRes.status})`)
      }

      const deployData = await deployRes.json()
      console.log('[Create] agent saved to DB:', deployData.agentId, '— txHash:', hash)

      setAgentId(newAgentId)
      setTxHash(hash)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setDeploying(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-angora-bg px-6 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-angora-primary/30 bg-angora-primary/10 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-angora-cyan animate-pulse" />
            <span className="text-angora-accent text-xs font-mono tracking-wider">
              AGENT DEPLOYMENT
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">Create Trading Agent</h1>
          <p className="text-angora-muted mt-2 text-sm">
            Describe your strategy in plain English — Gemini 2.5 Flash builds the config.
          </p>
        </motion.div>

        <StepIndicator step={step} />

        <AnimatePresence mode="wait">
          {/* ── Step 0: Prompt ─────────────────────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-6">
                <h2 className="text-xl font-bold text-white mb-2">
                  Describe Your Strategy
                </h2>
                <p className="text-angora-muted text-sm mb-5">
                  Gemini 2.5 Flash will parse your natural language into a
                  production trading config with indicators and risk params.
                </p>

                {/* Example chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {EXAMPLE_STRATEGIES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setPrompt(ex)}
                      className="text-xs px-3 py-1.5 rounded-full border border-angora-border text-angora-muted hover:border-angora-primary/50 hover:text-white transition-all"
                    >
                      {ex.slice(0, 42)}…
                    </button>
                  ))}
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. EMA crossover strategy on MON/USDT with RSI confirmation, 3% stop loss…"
                  rows={4}
                  className="w-full bg-angora-card border border-angora-border rounded-lg p-3 text-sm text-white resize-none focus:border-angora-primary/50 focus:outline-none placeholder:text-angora-muted"
                />

                {error && (
                  <p className="text-red-400 text-xs mt-2">{error}</p>
                )}

                <button
                  onClick={handleBuild}
                  disabled={!prompt.trim() || !isConnected || building}
                  className="mt-4 w-full py-3 bg-angora-primary text-white rounded-lg font-semibold hover:bg-angora-primary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {building ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Building with Gemini…
                    </>
                  ) : (
                    'Build Agent with Gemini →'
                  )}
                </button>

                {!isConnected && (
                  <p className="text-angora-muted text-xs text-center mt-3">
                    Connect your Phantom wallet to enable deployment
                  </p>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* ── Step 1: Review ─────────────────────────────────────────────── */}
          {step === 1 && buildResult && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Review Config</h2>
                  <span className="text-xs px-2 py-1 rounded bg-angora-primary/20 text-angora-accent font-mono border border-angora-primary/30">
                    {buildResult.config.strategyType}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <ConfigRow label="Name" value={buildResult.config.name} />
                  <ConfigRow label="Asset" value={buildResult.config.asset} />
                  <ConfigRow label="Timeframe" value={buildResult.config.timeframe} />
                  {buildResult.config.indicators.ema && (
                    <ConfigRow
                      label="EMA"
                      value={`Fast ${buildResult.config.indicators.ema.fast} / Slow ${buildResult.config.indicators.ema.slow}`}
                    />
                  )}
                  {buildResult.config.indicators.rsi && (
                    <ConfigRow
                      label="RSI"
                      value={`Period ${buildResult.config.indicators.rsi.period} · Oversold ${buildResult.config.indicators.rsi.oversold} · OB ${buildResult.config.indicators.rsi.overbought}`}
                    />
                  )}
                  <ConfigRow
                    label="Risk"
                    value={`${buildResult.config.risk.maxPositionPct}% pos · ${buildResult.config.risk.stopLossPct}% SL · ${buildResult.config.risk.takeProfitPct}% TP`}
                  />
                  <div className="pt-2 border-t border-angora-border">
                    <p className="text-angora-muted text-xs mb-1">Config Hash</p>
                    <p className="text-angora-accent font-mono text-xs break-all">
                      {buildResult.configHash}
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-xs mb-3">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep(0); setError('') }}
                    className="flex-1 py-2.5 border border-angora-border text-angora-muted rounded-lg text-sm hover:border-angora-primary/40 hover:text-white transition-all"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleDeploy}
                    disabled={deploying || !isConnected}
                    className="flex-[2] py-2.5 bg-angora-primary text-white rounded-lg font-semibold text-sm hover:bg-angora-primary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {deploying ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Awaiting Phantom…
                      </>
                    ) : (
                      'Deploy On-Chain →'
                    )}
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* ── Step 2: Done ───────────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
            >
              <GlassCard glow className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                  className="w-16 h-16 rounded-full bg-angora-success/20 border border-angora-success/40 grid place-items-center mx-auto mb-6"
                >
                  <span className="text-2xl text-angora-success">✓</span>
                </motion.div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Agent Deployed
                </h2>
                <p className="text-angora-muted text-sm mb-6">
                  Your trading agent is live on Monad Testnet.
                </p>

                <div className="text-left space-y-3 mb-6">
                  <div>
                    <p className="text-angora-muted text-xs mb-1">Agent ID</p>
                    <p className="text-white font-mono text-xs break-all bg-angora-card border border-angora-border rounded px-3 py-2">
                      {agentId}
                    </p>
                  </div>
                  <div>
                    <p className="text-angora-muted text-xs mb-1">Transaction</p>
                    <a
                      href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-angora-primary font-mono text-xs break-all hover:underline block bg-angora-card border border-angora-border rounded px-3 py-2"
                    >
                      {txHash}
                    </a>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep(0); setPrompt(''); setBuildResult(null); setError('') }}
                    className="flex-1 py-2.5 border border-angora-border text-angora-muted rounded-lg text-sm hover:border-angora-primary/40 hover:text-white transition-all"
                  >
                    Create Another
                  </button>
                  <Link
                    href={`/dashboard/${agentId}`}
                    className="flex-[2] py-2.5 bg-white text-black font-semibold text-sm rounded-lg hover:bg-white/90 transition-all flex items-center justify-center gap-2"
                  >
                    View Dashboard →
                  </Link>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-angora-muted text-xs shrink-0 w-20">{label}</span>
      <span className="text-white text-xs text-right font-mono">{value}</span>
    </div>
  )
}
