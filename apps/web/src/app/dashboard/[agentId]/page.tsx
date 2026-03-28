'use client'
import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { GlassCard } from '@/components/ui/GlassCard'
import { SignalBadge } from '@/components/ui/SignalBadge'
import { AgentTriggerPanel } from '@/components/agents/AgentTriggerPanel'
import type { AgentData } from '@/components/agents/AgentCard'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Execution {
  id: string
  agentId: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  price: number
  confidence: number
  reasoning: string
  txHash: string | null
  pnlPct: number | null
  createdAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const EXPLORER = 'https://testnet.monadexplorer.com'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function truncate(str: string, n = 60) {
  return str.length > n ? str.slice(0, n) + '…' : str
}

function computeStats(executions: Execution[]) {
  if (!executions.length) return { winRate: 0, total: 0, avgConf: 0, latestPrice: 0 }
  const wins = executions.filter((e) => (e.pnlPct ?? 0) > 0).length
  const avgConf = executions.reduce((s, e) => s + e.confidence, 0) / executions.length
  const latestPrice = executions[0]?.price ?? 0
  return {
    winRate: (wins / executions.length) * 100,
    total: executions.length,
    avgConf,
    latestPrice,
  }
}

// ── Stat Pill ─────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  unit,
  color = '#836EF9',
}: {
  label: string
  value: string
  unit?: string
  color?: string
}) {
  return (
    <div className="relative p-4 rounded-xl border border-angora-border bg-gradient-to-br from-angora-surface to-angora-card overflow-hidden">
      <div
        className="absolute -top-3 -right-3 w-12 h-12 rounded-full opacity-20 blur-xl"
        style={{ background: color }}
      />
      <p className="text-angora-muted text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-white font-mono">
        {value}
        {unit && <span className="text-sm font-normal text-angora-muted ml-1">{unit}</span>}
      </p>
    </div>
  )
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = use(params)

  const { data: rawData, isLoading, refetch: refetchExecutions } = useQuery({
    queryKey: ['executions', agentId],
    queryFn: () =>
      fetch(`${API_URL}/api/agents/${agentId}/executions`).then((r) => r.json()),
    refetchInterval: 10000,
  })
  // Guard: API may return an error object if DB is unavailable — fall back to []
  const executions: Execution[] = Array.isArray(rawData) ? rawData : []

  const { data: agentData } = useQuery<AgentData>({
    queryKey: ['agent', agentId],
    queryFn: () =>
      fetch(`${API_URL}/api/agents/${agentId}`).then((r) => r.json()),
    refetchInterval: 15000,
  })

  const stats = computeStats(executions)
  const latest = executions[0]

  // PnL chart data: cumulative pnl across executions (oldest → newest)
  const chartData = [...executions]
    .reverse()
    .map((e, i) => ({
      time: formatTime(e.createdAt),
      pnl: executions
        .slice(executions.length - 1 - i)
        .reduce((sum, x) => sum + (x.pnlPct ?? 0), 0),
    }))

  return (
    <div className="min-h-screen bg-angora-bg px-6 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header + Trigger Panel (Section 9 spec: flex items-center justify-between) */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-angora-cyan text-xs font-mono">● LIVE DASHBOARD</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Agent Monitor</h1>
            <p className="text-angora-muted text-xs font-mono mt-0.5 break-all">{agentId}</p>
          </div>
          {/* Run Now + countdown — side by side */}
          <AgentTriggerPanel
            agentId={agentId}
            agent={agentData}
            onRefresh={() => refetchExecutions()}
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatPill
            label="Win Rate"
            value={stats.winRate.toFixed(1)}
            unit="%"
            color="#34D399"
          />
          <StatPill
            label="Total Trades"
            value={String(stats.total)}
            color="#836EF9"
          />
          <StatPill
            label="Avg Confidence"
            value={stats.avgConf.toFixed(1)}
            unit="%"
            color="#22D3EE"
          />
          <StatPill
            label="Latest Price"
            value={stats.latestPrice.toFixed(2)}
            unit="$"
            color="#FBBF24"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Latest signal card */}
          <GlassCard className="p-6 lg:col-span-1">
            <p className="text-angora-muted text-xs uppercase tracking-widest mb-4">
              Latest Signal
            </p>
            {latest ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <SignalBadge signal={latest.signal} />
                  <span className="text-angora-muted text-xs">
                    {formatTime(latest.createdAt)}
                  </span>
                </div>
                {/* Confidence bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-angora-muted mb-1">
                    <span>Confidence</span>
                    <span className="text-white font-mono">{latest.confidence}%</span>
                  </div>
                  <div className="h-1.5 bg-angora-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-angora-primary rounded-full transition-all duration-500"
                      style={{ width: `${latest.confidence}%` }}
                    />
                  </div>
                </div>
                <p className="text-angora-muted text-xs leading-relaxed mb-4">
                  {latest.reasoning}
                </p>
                {latest.txHash && (
                  <a
                    href={`${EXPLORER}/tx/${latest.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-angora-primary text-xs font-mono hover:underline break-all"
                  >
                    {latest.txHash.slice(0, 20)}…
                  </a>
                )}
              </>
            ) : (
              <p className="text-angora-muted text-sm">
                {isLoading ? 'Loading…' : 'No executions yet'}
              </p>
            )}
          </GlassCard>

          {/* PnL chart */}
          <GlassCard className="p-6 lg:col-span-2">
            <p className="text-angora-muted text-xs uppercase tracking-widest mb-4">
              Cumulative PnL
            </p>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#836EF9" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#836EF9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0D0020',
                      border: '1px solid #2D1B69',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${Number(v).toFixed(2)}%`, 'PnL']}
                  />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="#836EF9"
                    strokeWidth={2}
                    fill="url(#pnlGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center">
                <p className="text-angora-muted text-sm">
                  {isLoading ? 'Loading chart…' : 'Not enough data yet'}
                </p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Execution history table */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-angora-muted text-xs uppercase tracking-widest">
              Execution History
            </p>
            <span className="text-angora-muted text-xs">
              Auto-refresh every 30s
            </span>
          </div>

          {executions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-angora-muted text-sm">
                No executions yet — trigger the agent to see results.
              </p>
              <p className="text-angora-muted text-xs mt-2 font-mono">
                POST /api/agents/{agentId}/trigger
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-angora-muted text-xs border-b border-angora-border">
                    <th className="text-left pb-3 font-normal">Time</th>
                    <th className="text-left pb-3 font-normal">Signal</th>
                    <th className="text-right pb-3 font-normal">Price</th>
                    <th className="text-right pb-3 font-normal">Conf</th>
                    <th className="text-left pb-3 font-normal hidden md:table-cell">Reasoning</th>
                    <th className="text-right pb-3 font-normal">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((ex) => (
                    <tr
                      key={ex.id}
                      className="border-b border-angora-border/40 hover:bg-angora-surface/30 transition-colors"
                    >
                      <td className="py-3 text-angora-muted text-xs font-mono">
                        {formatTime(ex.createdAt)}
                      </td>
                      <td className="py-3">
                        <SignalBadge signal={ex.signal} />
                      </td>
                      <td className="py-3 text-right text-white font-mono text-xs">
                        ${ex.price.toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-mono text-xs">
                        <span
                          className={
                            ex.confidence >= 70
                              ? 'text-angora-success'
                              : ex.confidence >= 55
                              ? 'text-angora-warning'
                              : 'text-angora-danger'
                          }
                        >
                          {ex.confidence}%
                        </span>
                      </td>
                      <td className="py-3 text-angora-muted text-xs hidden md:table-cell max-w-xs">
                        {truncate(ex.reasoning, 55)}
                      </td>
                      <td className="py-3 text-right">
                        {ex.txHash ? (
                          <a
                            href={`${EXPLORER}/tx/${ex.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-angora-primary text-xs font-mono hover:underline"
                          >
                            {ex.txHash.slice(0, 8)}…
                          </a>
                        ) : (
                          <span className="text-angora-muted text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
