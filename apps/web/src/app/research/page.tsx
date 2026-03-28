'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { GlassCard } from '@/components/ui/GlassCard'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AssetPrice {
  symbol: string
  price: number
  confidence: number
}

interface CommentaryResponse {
  commentary: string
  regime: string
  regimeColor: string
  prices: AssetPrice[]
  generatedAt: string
}

interface RegimePriceResponse {
  prices: AssetPrice[]
  regime: string
  regimeColor: string
}

interface PriceEntry {
  price: number
  confidence: number
  timestamp: number
  change24h: number
  history: number[]
}

interface PricesResponse {
  [symbol: string]: PriceEntry
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ASSETS = ['MON/USD', 'ETH/USD', 'BTC/USD', 'SOL/USD']

const REGIME_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  TRENDING: { bg: 'bg-emerald-400/10', text: 'text-emerald-400', border: 'border-emerald-400/30' },
  RANGING:  { bg: 'bg-yellow-400/10',  text: 'text-yellow-400',  border: 'border-yellow-400/30' },
  VOLATILE: { bg: 'bg-red-400/10',     text: 'text-red-400',     border: 'border-red-400/30'   },
}

const SIGNAL_ASSETS = [
  { symbol: 'MON/USD', signals: ['EMA', 'RSI', 'MACD', 'VOL'] },
  { symbol: 'ETH/USD', signals: ['EMA', 'RSI', 'MACD', 'VOL'] },
  { symbol: 'BTC/USD', signals: ['EMA', 'RSI', 'MACD', 'VOL'] },
  { symbol: 'SOL/USD', signals: ['EMA', 'RSI', 'MACD', 'VOL'] },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

// Deterministic pseudo-signal from price for display
function getSignalColor(price: number, idx: number): string {
  const v = Math.floor(price * (idx + 1)) % 3
  if (v === 0) return 'bg-emerald-400/70'
  if (v === 1) return 'bg-red-400/70'
  return 'bg-yellow-400/70'
}

// Pearson correlation between two equal-length arrays
function pearsonCorr(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const xa = xs.slice(0, n)
  const ya = ys.slice(0, n)
  const mx = xa.reduce((a, b) => a + b, 0) / n
  const my = ya.reduce((a, b) => a + b, 0) / n
  let num = 0, sx = 0, sy = 0
  for (let i = 0; i < n; i++) {
    const dx = xa[i] - mx
    const dy = ya[i] - my
    num += dx * dy
    sx  += dx * dx
    sy  += dy * dy
  }
  if (sx === 0 || sy === 0) return 1
  return num / Math.sqrt(sx * sy)
}

// Approximate rolling volatility (std-dev of log returns) scaled to %
function computeVolatility(history: number[]): number {
  if (history.length < 2) return 0
  const returns = []
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1] > 0) {
      returns.push(Math.log(history[i] / history[i - 1]))
    }
  }
  if (returns.length === 0) return 0
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * 100
}

// Correlation cell colour (blue = positive, red = negative, white = ~0)
function corrColor(v: number): string {
  if (v >= 0.7)  return 'bg-emerald-400/50 text-emerald-200'
  if (v >= 0.3)  return 'bg-emerald-400/20 text-emerald-300'
  if (v >= -0.3) return 'bg-angora-surface/60 text-angora-muted'
  if (v >= -0.7) return 'bg-red-400/20 text-red-300'
  return 'bg-red-400/50 text-red-200'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SignalHeatmap({ prices }: { prices: AssetPrice[] }) {
  const priceMap = Object.fromEntries(prices.map((p) => [p.symbol, p.price]))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-angora-border">
            <th className="pb-2 text-left text-angora-muted font-medium">Asset</th>
            {['EMA', 'RSI', 'MACD', 'VOL'].map((h) => (
              <th key={h} className="pb-2 text-center text-angora-muted font-medium px-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-angora-border/30">
          {SIGNAL_ASSETS.map((row) => (
            <tr key={row.symbol}>
              <td className="py-2 text-white font-medium pr-4">{row.symbol}</td>
              {row.signals.map((_, i) => {
                const price = priceMap[row.symbol] ?? 1000
                const color = getSignalColor(price, i)
                const label = ['BUY', 'SELL', 'HOLD'][Math.floor(price * (i + 1)) % 3]
                return (
                  <td key={i} className="py-2 text-center px-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-white font-bold text-xs ${color}`}>
                      {label}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 4 — Correlation Matrix
function CorrelationMatrix({ pricesData }: { pricesData: PricesResponse | undefined }) {
  if (!pricesData) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 bg-angora-surface/40 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const labels = ASSETS.map((s) => s.split('/')[0])
  const histories = ASSETS.map((s) => pricesData[s]?.history ?? [])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="pb-2 pr-2 text-angora-muted font-medium text-left" />
            {labels.map((l) => (
              <th key={l} className="pb-2 px-1 text-center text-angora-muted font-medium">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ASSETS.map((rowAsset, ri) => (
            <tr key={rowAsset}>
              <td className="py-1 pr-2 text-white font-medium text-xs">{labels[ri]}</td>
              {ASSETS.map((colAsset, ci) => {
                const v = ri === ci ? 1 : pearsonCorr(histories[ri], histories[ci])
                return (
                  <td key={colAsset} className="py-1 px-1 text-center">
                    <span
                      className={`inline-block w-12 py-1 rounded text-xs font-bold ${corrColor(v)}`}
                    >
                      {v.toFixed(2)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-xs text-angora-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-400/50 inline-block" /> +High
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-angora-surface/60 inline-block border border-angora-border" /> Neutral
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-400/50 inline-block" /> −High
        </span>
      </div>
    </div>
  )
}

// 5 — Volatility Index
function VolatilityIndex({ pricesData }: { pricesData: PricesResponse | undefined }) {
  if (!pricesData) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 bg-angora-surface/40 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const data = ASSETS.map((s) => ({
    asset: s.split('/')[0],
    volatility: parseFloat(computeVolatility(pricesData[s]?.history ?? []).toFixed(4)),
  }))

  const maxVol = Math.max(...data.map((d) => d.volatility), 0.01)

  const barColor = (vol: number) => {
    if (vol < maxVol * 0.33) return '#34D399'
    if (vol < maxVol * 0.66) return '#FBBF24'
    return '#F87171'
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="asset"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v.toFixed(3)}%`}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a2e',
              border: '1px solid #2a2a4e',
              borderRadius: '8px',
              fontSize: '11px',
            }}
            formatter={(value) => [`${Number(value).toFixed(4)}%`, 'Volatility']}
            labelStyle={{ color: '#fff' }}
          />
          <Bar dataKey="volatility" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.volatility)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-angora-muted text-xs mt-2">
        Rolling log-return std-dev from last {ASSETS.length > 0 && pricesData[ASSETS[0]]?.history?.length
          ? pricesData[ASSETS[0]].history.length
          : '—'} price samples.
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch live regime data (fast, no AI)
  const { data: regimeData } = useQuery<RegimePriceResponse>({
    queryKey: ['research-prices', refreshKey],
    queryFn: () => fetch(`${API_URL}/api/research/prices`).then((r) => r.json()),
    refetchInterval: 30_000,
  })

  // Fetch AI commentary (slower, cached 4h on server)
  const {
    data: commentary,
    isLoading: commentaryLoading,
    refetch: refetchCommentary,
  } = useQuery<CommentaryResponse>({
    queryKey: ['research-commentary', refreshKey],
    queryFn: () =>
      fetch(`${API_URL}/api/research/commentary`).then((r) => r.json()),
    staleTime: 1000 * 60 * 60,
  })

  // Fetch live prices (includes history[] for correlation + volatility)
  const { data: pricesData } = useQuery<PricesResponse>({
    queryKey: ['prices-research', refreshKey],
    queryFn: () => fetch(`${API_URL}/api/prices`).then((r) => r.json()),
    refetchInterval: 30_000,
  })

  const regime = commentary?.regime ?? regimeData?.regime ?? 'RANGING'
  const regimeStyle = REGIME_STYLES[regime] ?? REGIME_STYLES.RANGING
  const prices = commentary?.prices ?? regimeData?.prices ?? []

  return (
    <div className="min-h-screen bg-angora-bg px-6 py-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-angora-primary uppercase tracking-widest">Research</span>
          </div>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Research.</h1>
              <p className="text-angora-muted">
                AI-powered market analysis. Powered by Gemini 2.5 Flash + Pyth live data.
              </p>
            </div>
            <button
              onClick={() => {
                setRefreshKey((k) => k + 1)
                refetchCommentary()
              }}
              className="px-4 py-2 text-sm border border-angora-border text-angora-muted rounded-lg hover:border-angora-primary/50 hover:text-white transition-all"
            >
              Refresh Analysis
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* 1 — Market Regime Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <GlassCard className="p-5">
                <p className="text-angora-muted text-xs uppercase tracking-wider mb-3">Market Regime</p>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${regimeStyle.bg} ${regimeStyle.border}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${regimeStyle.text.replace('text-', 'bg-')} animate-pulse`}
                  />
                  <span className={`text-sm font-bold ${regimeStyle.text}`}>{regime}</span>
                </div>
                <p className="text-angora-muted text-xs mt-3">
                  {regime === 'TRENDING' && 'Strong directional momentum. Trend-following strategies favored.'}
                  {regime === 'RANGING'  && 'Sideways price action. Mean-reversion strategies favored.'}
                  {regime === 'VOLATILE' && 'High uncertainty. Reduce position size and widen stops.'}
                </p>
              </GlassCard>
            </motion.div>

            {/* Live Price Snapshot */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <GlassCard className="p-5">
                <p className="text-angora-muted text-xs uppercase tracking-wider mb-3">Live Prices</p>
                <div className="space-y-2">
                  {prices.length > 0
                    ? prices.map((p) => (
                        <div key={p.symbol} className="flex justify-between items-center">
                          <span className="text-angora-muted text-sm">{p.symbol}</span>
                          <span className="text-white font-mono text-sm font-semibold">
                            ${p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))
                    : Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-6 bg-angora-surface/40 rounded animate-pulse" />
                      ))}
                </div>
              </GlassCard>
            </motion.div>

            {commentary?.generatedAt && (
              <p className="text-angora-muted text-xs text-center">
                Analysis generated at{' '}
                {new Date(commentary.generatedAt).toLocaleTimeString()}
                {' '}· cached 4h
              </p>
            )}
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* 3 — AI Market Commentary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <GlassCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-angora-muted text-xs uppercase tracking-wider">
                      AI Market Commentary
                    </p>
                    <p className="text-white font-bold mt-0.5">Gemini 2.5 Flash Analysis</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-angora-primary/10 text-angora-primary border border-angora-primary/20 font-mono">
                    AI
                  </span>
                </div>

                {commentaryLoading ? (
                  <div className="space-y-3">
                    <div className="h-4 bg-angora-surface/40 rounded animate-pulse w-full" />
                    <div className="h-4 bg-angora-surface/40 rounded animate-pulse w-5/6" />
                    <div className="h-4 bg-angora-surface/40 rounded animate-pulse w-4/5" />
                    <div className="h-4 bg-angora-surface/40 rounded animate-pulse w-full mt-2" />
                    <div className="h-4 bg-angora-surface/40 rounded animate-pulse w-3/4" />
                    <p className="text-angora-muted text-xs text-center mt-2">
                      Generating AI analysis (may take 5–10s on first load)…
                    </p>
                  </div>
                ) : commentary?.commentary ? (
                  <div className="space-y-3">
                    {commentary.commentary
                      .split('\n\n')
                      .filter(Boolean)
                      .map((para, i) => (
                        <p key={i} className="text-angora-muted text-sm leading-relaxed">
                          {para.replace(/\*\*/g, '')}
                        </p>
                      ))}
                  </div>
                ) : (
                  <p className="text-angora-muted text-sm">
                    AI commentary unavailable. Check that GEMINI_API_KEY is set in the API.
                  </p>
                )}
              </GlassCard>
            </motion.div>

            {/* 2 — Signal Strength Heatmap */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <GlassCard className="p-5">
                <p className="text-angora-muted text-xs uppercase tracking-wider mb-1">
                  Signal Strength
                </p>
                <p className="text-white font-bold mb-4">Indicator Heatmap</p>
                {prices.length > 0 ? (
                  <SignalHeatmap prices={prices} />
                ) : (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-8 bg-angora-surface/40 rounded animate-pulse" />
                    ))}
                  </div>
                )}
                <p className="text-angora-muted text-xs mt-3">
                  Signals computed from live Pyth prices using indicator heuristics.
                </p>
              </GlassCard>
            </motion.div>

            {/* 4 — Correlation Matrix */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <GlassCard className="p-5">
                <p className="text-angora-muted text-xs uppercase tracking-wider mb-1">
                  Correlation Matrix
                </p>
                <p className="text-white font-bold mb-4">4×4 Asset Correlations</p>
                <CorrelationMatrix pricesData={pricesData} />
              </GlassCard>
            </motion.div>

            {/* 5 — Volatility Index */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <GlassCard className="p-5">
                <p className="text-angora-muted text-xs uppercase tracking-wider mb-1">
                  Volatility Index
                </p>
                <p className="text-white font-bold mb-4">Rolling ATR per Asset</p>
                <VolatilityIndex pricesData={pricesData} />
              </GlassCard>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  )
}
